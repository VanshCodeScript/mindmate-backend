const express = require('express');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const optionalAuth = require('../../../middleware/optionalAuth');
const getDistance = require('../../../utils/distance');
const User = require('../../../models/User');
const { sendAlertEmail } = require('../../../services/emailService');
const twilioSms = require('../../../services/twilioSmsService');
const { emitGeofenceAlert } = require('../../../socket/callSignaling');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Track last alert times to avoid SMS spam
const lastSmsAlertTime = new Map();
const SMS_COOLDOWN_MS = 30 * 1000; // 30 seconds (short for testing)

// Dev mode: in-memory store when auth is disabled (for testing without JWT/MongoDB)
const devLocationStore = new Map();
const isDevMode = () => String(process.env.DISABLE_AUTHENTICATION || '').toLowerCase() === 'true';

function isHttpsRequest(req) {
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string' && proto.toLowerCase().includes('https')) return true;
  return false;
}

function validateLatLng(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, message: 'Latitude/longitude must be numbers' };
  if (lat < -90 || lat > 90) return { ok: false, message: 'Latitude out of range' };
  if (lng < -180 || lng > 180) return { ok: false, message: 'Longitude out of range' };
  return { ok: true, lat, lng };
}

const updateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many location updates, please slow down.' },
  skip: () => String(process.env.DISABLE_RATE_LIMITING || '').toLowerCase() === 'true',
});

// POST /api/location/update
router.post('/update', updateLimiter, optionalAuth, async (req, res) => {
  try {
    if ((process.env.NODE_ENV || 'development') === 'production' && !isHttpsRequest(req)) {
      return res.status(403).json({ success: false, message: 'HTTPS is required' });
    }

    const { latitude, longitude, userId: bodyUserId } = req.body || {};
    const parsed = validateLatLng(latitude, longitude);
    if (!parsed.ok) {
      return res.status(400).json({ success: false, message: parsed.message });
    }

    // Dev mode: no JWT → use in-memory store with userId from body
    if (isDevMode() && !req.user) {
      const devUserId = String(bodyUserId || '1').trim();
      if (!devUserId) {
        return res.status(400).json({ success: false, message: 'userId required when auth is disabled' });
      }
      const accuracy = Number(req.body.accuracy) || null;
      const distance  = Number(req.body.distance)  || 0;
      devLocationStore.set(devUserId, {
        userId: devUserId,
        latitude: parsed.lat,
        longitude: parsed.lng,
        accuracy,
        distance: Math.round(distance * 10) / 10,
        outsideRadius: !!req.body.outsideRadius,
        timestamp: new Date().toISOString(),
      });
      return res.json({ success: true, message: 'Location updated (dev mode)', alertActive: !!req.body.outsideRadius });
    }

    // ── Authenticated mode (JWT present) ─────────────────────────────────────
    const user = req.user;

    // Fallback: if no JWT but also not dev mode, accept userId from body
    // (supports the debug-login / no-auth frontend flow)
    if (!user) {
      const fallbackId = String(bodyUserId || '1').trim();
      const existing = devLocationStore.get(fallbackId);

      // ── GPS jitter filter ──────────────────────────────────────────────
      // WiFi / IP-based geolocation can report ~76 m accuracy but wobble
      // by 5-10 m between readings even when the device is stationary.
      // We only accept a new position as "real movement" when it exceeds
      // a noise threshold derived from the reported accuracy.
      const accuracy = Number(req.body.accuracy) || 100;
      const JITTER_FACTOR = 0.3;          // 30 % of reported accuracy
      const MIN_JITTER_THRESHOLD = 3;     // never less than 3 m
      // Skip jitter filter when accuracy is excellent (≤ 5 m) – e.g. simulation mode or real GPS
      const noiseThreshold = accuracy <= 5 ? 0 : Math.max(accuracy * JITTER_FACTOR, MIN_JITTER_THRESHOLD);

      // If we already have a position, check if the new reading is real
      // movement or just GPS noise.
      let acceptedLat = parsed.lat;
      let acceptedLng = parsed.lng;
      if (existing) {
        const movementFromLast = getDistance(
          existing.latitude, existing.longitude,
          parsed.lat, parsed.lng,
        );
        if (movementFromLast < noiseThreshold) {
          // Noise — keep the previously accepted (stable) position
          acceptedLat = existing.latitude;
          acceptedLng = existing.longitude;
          console.log(`[Location] User ${fallbackId}: jitter ${movementFromLast.toFixed(1)}m < threshold ${noiseThreshold.toFixed(1)}m (acc=${accuracy}m) → kept stable position`);
        } else {
          console.log(`[Location] User ${fallbackId}: real move ${movementFromLast.toFixed(1)}m ≥ threshold ${noiseThreshold.toFixed(1)}m → position updated`);
        }
      }

      // ── Geofence detection ─────────────────────────────────────────────
      let outsideRadius = false;
      let dist = 0;
      const FALLBACK_RADIUS = 5; // metres – low for easy testing
      if (existing) {
        // Use the very first stored location as the "home" reference
        if (!existing._homeLat) {
          existing._homeLat = existing.latitude;
          existing._homeLng = existing.longitude;
        }
        dist = getDistance(existing._homeLat, existing._homeLng, acceptedLat, acceptedLng);
        outsideRadius = dist > FALLBACK_RADIUS;

        console.log(`[Location] User ${fallbackId}: lat=${acceptedLat.toFixed(6)} lng=${acceptedLng.toFixed(6)} acc=${accuracy}m | dist=${dist.toFixed(1)}m, radius=${FALLBACK_RADIUS}m, outside=${outsideRadius}, wasOutside=${existing.outsideRadius}`);

        // Trigger alerts: on first breach OR repeatedly while outside (with SMS cooldown)
        if (outsideRadius) {
          // Socket alert on boundary crossing (inside → outside)
          if (!existing.outsideRadius) {
            const io = req.app.get('io');
            const alertId = uuidv4();
            emitGeofenceAlert(io, {
              alertId,
              userId: fallbackId,
              patientName: `Patient #${fallbackId}`,
              distance: Math.round(dist),
              safeRadius: FALLBACK_RADIUS,
              latitude: acceptedLat,
              longitude: acceptedLng,
            });
          }

          // SMS with cooldown (sends on first breach AND repeats after cooldown)
          const lastSms = lastSmsAlertTime.get(fallbackId) || 0;
          if (Date.now() - lastSms > SMS_COOLDOWN_MS) {
            lastSmsAlertTime.set(fallbackId, Date.now());
            console.log(`[Location] Sending SMS for user ${fallbackId}, distance ${dist.toFixed(1)}m`);
            twilioSms.sendGeofenceAlert({
              patientName: `Patient #${fallbackId}`,
              distance: dist,
              safeRadius: FALLBACK_RADIUS,
              latitude: acceptedLat,
              longitude: acceptedLng,
            }).catch((err) => console.error('[Location] SMS error:', err.message));
          }
        }
      }

      devLocationStore.set(fallbackId, {
        ...existing,
        userId: fallbackId,
        latitude: acceptedLat,
        longitude: acceptedLng,
        accuracy,
        distance: Math.round(dist),
        outsideRadius,
        timestamp: new Date().toISOString(),
      });
      return res.json({ success: true, message: 'Location updated (fallback)', alertActive: outsideRadius });
    }

    user.currentLocation = { latitude: parsed.lat, longitude: parsed.lng };

    // If homeLocation not set, initialize it once and avoid false alerts.
    if (
      !user.homeLocation ||
      typeof user.homeLocation.latitude !== 'number' ||
      typeof user.homeLocation.longitude !== 'number'
    ) {
      user.homeLocation = { latitude: parsed.lat, longitude: parsed.lng };
      user.alertActive = false;
      await user.save();
      return res.json({ success: true, message: 'Home location initialized', alertActive: false });
    }

    const distance = getDistance(
      user.homeLocation.latitude,
      user.homeLocation.longitude,
      parsed.lat,
      parsed.lng
    );

    const safeRadius = Number(user.safeRadiusInMeters || 200);

    if (distance > safeRadius && !user.alertActive) {
      user.alertActive = true;
      await user.save();

      const alertId = uuidv4();

      // 1) Socket.io alert → all online caregivers
      const io = req.app.get('io');
      emitGeofenceAlert(io, {
        alertId,
        userId: String(user._id),
        patientName: user.name || 'Patient',
        distance: Math.round(distance),
        safeRadius,
        latitude: parsed.lat,
        longitude: parsed.lng,
      });

      // 2) Twilio SMS (with cooldown)
      const uid = String(user._id);
      const lastSms = lastSmsAlertTime.get(uid) || 0;
      if (Date.now() - lastSms > SMS_COOLDOWN_MS) {
        lastSmsAlertTime.set(uid, Date.now());
        twilioSms.sendGeofenceAlert({
          patientName: user.name || 'Patient',
          distance,
          safeRadius,
          latitude: parsed.lat,
          longitude: parsed.lng,
        }).catch((err) => console.error('[Location] SMS error:', err.message));
      }

      // 3) Email alert (existing)
      try {
        await sendAlertEmail(user, distance);
      } catch (emailErr) {
        console.error('[Location] Email alert failed:', emailErr.message);
      }

      return res.json({
        success: true,
        alertActive: true,
        alertId,
        distanceMeters: Math.round(distance),
        message: 'Location updated; geofence alert triggered (socket + SMS + email)',
      });
    }

    if (distance <= safeRadius) {
      if (user.alertActive) {
        user.alertActive = false;
        await user.save();
      } else {
        await user.save();
      }
      return res.json({
        success: true,
        alertActive: false,
        distanceMeters: Math.round(distance),
        message: 'Location updated; inside safe zone',
      });
    }

    // Outside radius but alert already active
    await user.save();
    return res.json({
      success: true,
      alertActive: true,
      distanceMeters: Math.round(distance),
      message: 'Location updated; alert already active',
    });
  } catch (err) {
    console.error('[Location] Update error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error processing location update' });
  }
});

// GET /api/location/latest/:userId
router.get('/latest/:userId', optionalAuth, async (req, res) => {
  try {
    if ((process.env.NODE_ENV || 'development') === 'production' && !isHttpsRequest(req)) {
      return res.status(403).json({ success: false, message: 'HTTPS is required' });
    }

    const { userId } = req.params;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }

    // Dev mode / no-auth: return from in-memory store
    if ((isDevMode() || !req.user) && devLocationStore.has(String(userId))) {
      const stored = devLocationStore.get(String(userId));
      return res.json({
        available: true,
        userId: stored.userId,
        latitude: stored.latitude,
        longitude: stored.longitude,
        accuracy: stored.accuracy ?? null,
        distance: stored.distance ?? 0,
        outsideRadius: stored.outsideRadius ?? false,
        timestamp: stored.timestamp || new Date().toISOString(),
      });
    }

    // If no data in dev store and no auth, return waiting state
    if (!req.user) {
      return res.json({ available: false, message: 'No location data yet for this user' });
    }

    // Authenticated mode
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }

    const requesterRole = req.auth?.role;
    const requesterId = req.auth?.id;
    const isSelf = requesterId && String(requesterId) === String(userId);
    const isPrivileged = requesterRole === 'caregiver' || requesterRole === 'doctor';

    if (!isSelf && !isPrivileged) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const target = await User.findById(userId).select('currentLocation updatedAt');
    if (!target || !target.currentLocation) {
      return res.status(404).json({ success: false, message: 'No location data found for this user' });
    }

    return res.json({
      available: true,
      userId: String(userId),
      latitude: target.currentLocation.latitude,
      longitude: target.currentLocation.longitude,
      timestamp: target.updatedAt ? new Date(target.updatedAt).toISOString() : new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Location] Fetch error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error fetching location' });
  }
});

// POST /api/location/reset-home/:userId
// Allows the caregiver to reset the "home" reference point for geofencing.
// Used when setting safe zone from the map or before running a simulation.
router.post('/reset-home/:userId', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { latitude, longitude } = req.body || {};
    const parsed = validateLatLng(latitude, longitude);
    if (!parsed.ok) {
      return res.status(400).json({ success: false, message: parsed.message });
    }

    // Dev mode / no-auth: reset the in-memory store home
    if (isDevMode() || !req.user) {
      const existing = devLocationStore.get(String(userId));
      if (existing) {
        existing._homeLat = parsed.lat;
        existing._homeLng = parsed.lng;
        existing.latitude = parsed.lat;
        existing.longitude = parsed.lng;
        existing.distance = 0;
        existing.outsideRadius = false;
        existing.timestamp = new Date().toISOString();
        devLocationStore.set(String(userId), existing);
      } else {
        // Create a fresh entry with the given position as home
        devLocationStore.set(String(userId), {
          userId: String(userId),
          latitude: parsed.lat,
          longitude: parsed.lng,
          _homeLat: parsed.lat,
          _homeLng: parsed.lng,
          accuracy: 5,
          distance: 0,
          outsideRadius: false,
          timestamp: new Date().toISOString(),
        });
      }
      console.log(`[Location] Home reset for user ${userId} → ${parsed.lat.toFixed(6)}, ${parsed.lng.toFixed(6)}`);
      return res.json({ success: true, message: 'Home location reset (dev mode)' });
    }

    // Authenticated mode: reset homeLocation on the User model
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.homeLocation = { latitude: parsed.lat, longitude: parsed.lng };
    user.alertActive = false;
    await user.save();

    return res.json({ success: true, message: 'Home location reset' });
  } catch (err) {
    console.error('[Location] Reset-home error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
