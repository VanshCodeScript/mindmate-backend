'use strict';

const twilio = require('twilio');

/**
 * Twilio SMS alert service for geofence-breach notifications.
 *
 * Sends a one-shot SMS to the configured caregiver phone number when an
 * elderly patient leaves their safe zone.  Falls back to a console log
 * when Twilio credentials are missing (dev / test environments).
 */
class TwilioSmsService {
  constructor() {
    this._ready = false;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken  = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber  = process.env.TWILIO_PHONE_NUMBER;
    this.toNumber    = process.env.CAREGIVER_PHONE_NUMBER;

    if (!accountSid || !authToken || !this.fromNumber || !this.toNumber) {
      console.warn(
        '[TwilioSMS] Missing one or more env vars (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, CAREGIVER_PHONE_NUMBER) – SMS alerts will be mocked.',
      );
      return;
    }

    this.client = twilio(accountSid, authToken);
    this._ready = true;
    console.log('[TwilioSMS] Service initialised — SMS alerts enabled.');
  }

  /** True when credentials are present. */
  isConfigured() {
    return this._ready;
  }

  /**
   * Send a geofence-breach SMS.
   *
   * @param {Object}  opts
   * @param {string}  opts.patientName  - Name of the elderly person
   * @param {number}  opts.distance     - Distance from safe zone in metres
   * @param {number}  opts.safeRadius   - Configured safe-radius in metres
   * @param {number}  [opts.latitude]   - Current latitude
   * @param {number}  [opts.longitude]  - Current longitude
   * @param {string}  [opts.toNumber]   - Override recipient (e.g. specific caregiver)
   * @returns {Promise<{ success: boolean, messageSid?: string, message: string }>}
   */
  async sendGeofenceAlert({ patientName = 'Patient', distance, safeRadius, latitude, longitude, toNumber } = {}) {
    const mapLink =
      latitude != null && longitude != null
        ? `\nMap: https://www.google.com/maps?q=${latitude},${longitude}`
        : '';

    const body =
      `ALERT - MindBridge Geofence\n` +
      `${patientName} has left their safe zone.\n` +
      `Distance: ${Math.round(distance)} m (limit: ${safeRadius} m)` +
      mapLink +
      `\n\nOpen the MindBridge app to respond.`;

    if (!this._ready) {
      console.log(`[TwilioSMS][MOCK] Would send SMS to ${this.toNumber || 'N/A'}:\n${body}`);
      return { success: true, message: 'SMS mocked (Twilio not configured)' };
    }

    try {
      const msg = await this.client.messages.create({
        to:   toNumber || this.toNumber,
        from: this.fromNumber,
        body,
      });

      console.log(`[TwilioSMS] Geofence SMS sent → SID: ${msg.sid}`);
      return { success: true, messageSid: msg.sid, message: 'SMS sent' };
    } catch (err) {
      console.error('[TwilioSMS] Send failed:', err.message);
      return { success: false, message: err.message };
    }
  }
}

module.exports = new TwilioSmsService();
