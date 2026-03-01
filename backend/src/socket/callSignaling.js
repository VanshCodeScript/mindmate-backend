/**
 * Socket.io Call Signaling Module
 * Handles real-time video call signaling between elderly and caregivers
 */
const Call = require('../models/Call');
const { v4: uuidv4 } = require('uuid');

// Track online users: { socketId: { userId, name, role, socketId } }
const onlineUsers = new Map();

// Track userId -> socketId mapping for targeted calls
const userSocketMap = new Map();

function initializeSocket(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ── User comes online ──
    socket.on('user:online', (userData) => {
      // userData = { userId, name, role }
      const userInfo = {
        userId: userData.userId,
        name: userData.name,
        role: userData.role,
        socketId: socket.id,
      };

      // If this userId was already online on a different socket, remove the stale entry
      const existingSocketId = userSocketMap.get(userData.userId);
      if (existingSocketId && existingSocketId !== socket.id) {
        onlineUsers.delete(existingSocketId);
        console.log(`🔄 Removed stale socket [${existingSocketId}] for ${userData.name}`);
      }

      onlineUsers.set(socket.id, userInfo);
      userSocketMap.set(userData.userId, socket.id);

      console.log(`✅ ${userData.name} (${userData.role}) came online [${socket.id}]`);

      // Broadcast updated online users list to all
      broadcastOnlineUsers(io);
    });

    // ── Initiate a call ──
    socket.on('call:initiate', async (data) => {
      // data = { calleeId, callerName, callerRole, callerId }
      const calleeSocketId = userSocketMap.get(data.calleeId);

      if (!calleeSocketId) {
        socket.emit('call:error', { message: 'User is offline' });
        return;
      }

      const calleeInfo = onlineUsers.get(calleeSocketId);
      const roomName = `consultation-${uuidv4().slice(0, 8)}`;

      try {
        // Save call to DB
        const call = await Call.create({
          callerId: data.callerId,
          callerName: data.callerName,
          callerRole: data.callerRole,
          calleeId: data.calleeId,
          calleeName: calleeInfo?.name || 'Unknown',
          calleeRole: calleeInfo?.role || 'elderly',
          roomName,
          status: 'ringing',
        });

        // Notify caller that call is ringing
        socket.emit('call:ringing', {
          callId: call._id,
          roomName,
          calleeId: data.calleeId,
          calleeName: calleeInfo?.name,
          calleeRole: calleeInfo?.role,
        });

        // Send incoming call to callee
        io.to(calleeSocketId).emit('call:incoming', {
          callId: call._id,
          roomName,
          callerName: data.callerName,
          callerRole: data.callerRole,
          callerId: data.callerId,
        });

        console.log(`📞 Call initiated: ${data.callerName} → ${calleeInfo?.name} [Room: ${roomName}]`);
      } catch (err) {
        console.error('Call initiation error:', err);
        socket.emit('call:error', { message: 'Failed to initiate call' });
      }
    });

    // ── Accept a call ──
    socket.on('call:accept', async (data) => {
      // data = { callId, roomName, callerId }
      try {
        await Call.findByIdAndUpdate(data.callId, {
          status: 'accepted',
          startedAt: new Date(),
        });

        const callerSocketId = userSocketMap.get(data.callerId);
        if (callerSocketId) {
          io.to(callerSocketId).emit('call:accepted', {
            callId: data.callId,
            roomName: data.roomName,
          });
        }

        // Also confirm to the callee
        socket.emit('call:accepted', {
          callId: data.callId,
          roomName: data.roomName,
        });

        console.log(`✅ Call accepted [${data.callId}]`);
      } catch (err) {
        console.error('Call accept error:', err);
      }
    });

    // ── Reject a call ──
    socket.on('call:reject', async (data) => {
      // data = { callId, callerId }
      try {
        await Call.findByIdAndUpdate(data.callId, { status: 'rejected' });

        const callerSocketId = userSocketMap.get(data.callerId);
        if (callerSocketId) {
          io.to(callerSocketId).emit('call:rejected', {
            callId: data.callId,
          });
        }

        console.log(`❌ Call rejected [${data.callId}]`);
      } catch (err) {
        console.error('Call reject error:', err);
      }
    });

    // ── Cancel a call (caller cancels before answer) ──
    socket.on('call:cancel', async (data) => {
      // data = { callId, calleeId }
      try {
        await Call.findByIdAndUpdate(data.callId, { status: 'cancelled' });

        const calleeSocketId = userSocketMap.get(data.calleeId);
        if (calleeSocketId) {
          io.to(calleeSocketId).emit('call:cancelled', {
            callId: data.callId,
          });
        }

        console.log(`🚫 Call cancelled [${data.callId}]`);
      } catch (err) {
        console.error('Call cancel error:', err);
      }
    });

    // ── End a call ──
    socket.on('call:end', async (data) => {
      // data = { callId, otherUserId }
      try {
        const call = await Call.findById(data.callId);
        if (call) {
          const duration = call.startedAt
            ? Math.floor((Date.now() - new Date(call.startedAt).getTime()) / 1000)
            : 0;

          call.status = 'ended';
          call.endedAt = new Date();
          call.duration = duration;
          await call.save();
        }

        const otherSocketId = userSocketMap.get(data.otherUserId);
        if (otherSocketId) {
          io.to(otherSocketId).emit('call:ended', {
            callId: data.callId,
          });
        }

        console.log(`📴 Call ended [${data.callId}]`);
      } catch (err) {
        console.error('Call end error:', err);
      }
    });

    // ── In-call chat message ──
    socket.on('chat:send', (data) => {
      // data = { toUserId, text, senderName, senderRole }
      const recipientSocketId = userSocketMap.get(data.toUserId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('chat:receive', {
          text: data.text,
          senderName: data.senderName,
          senderRole: data.senderRole,
        });
      }
    });

    // ── Geofence alert acknowledge / ignore ──
    socket.on('geofence:acknowledge', (data) => {
      // data = { alertId, userId (patient), caregiverId }
      console.log(`✅ Geofence alert acknowledged by caregiver [${data.caregiverId}] for patient [${data.userId}]`);
      // Broadcast to all connected clients so other caregivers see it was handled
      io.emit('geofence:resolved', {
        alertId: data.alertId,
        userId: data.userId,
        resolvedBy: data.caregiverId,
        action: 'acknowledged',
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('geofence:ignore', (data) => {
      // data = { alertId, userId (patient), caregiverId }
      console.log(`🔕 Geofence alert ignored by caregiver [${data.caregiverId}] for patient [${data.userId}]`);
      io.emit('geofence:resolved', {
        alertId: data.alertId,
        userId: data.userId,
        resolvedBy: data.caregiverId,
        action: 'ignored',
        timestamp: new Date().toISOString(),
      });
    });

    // ── Get online users ──
    socket.on('users:getOnline', () => {
      const seen = new Set();
      const users = [];
      onlineUsers.forEach((user) => {
        // Don't include the requesting user, and deduplicate by userId
        if (user.socketId !== socket.id && !seen.has(user.userId)) {
          seen.add(user.userId);
          users.push({
            userId: user.userId,
            name: user.name,
            role: user.role,
          });
        }
      });
      socket.emit('users:online', users);
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
      const userInfo = onlineUsers.get(socket.id);
      if (userInfo) {
        console.log(`💤 ${userInfo.name} (${userInfo.role}) went offline`);
        userSocketMap.delete(userInfo.userId);
        onlineUsers.delete(socket.id);
        broadcastOnlineUsers(io);
      }
    });
  });
}

function broadcastOnlineUsers(io) {
  const seen = new Set();
  const users = [];
  onlineUsers.forEach((user) => {
    if (!seen.has(user.userId)) {
      seen.add(user.userId);
      users.push({
        userId: user.userId,
        name: user.name,
        role: user.role,
      });
    }
  });
  io.emit('users:online', users);
}

/**
 * Emit a geofence breach alert to all online caregivers via Socket.io.
 *
 * @param {import('socket.io').Server} io - The Socket.io server instance
 * @param {Object} alertData
 * @param {string} alertData.alertId      - Unique alert identifier
 * @param {string} alertData.userId       - The patient's user ID
 * @param {string} alertData.patientName  - Patient display name
 * @param {number} alertData.distance     - Distance from home in metres
 * @param {number} alertData.safeRadius   - Configured safe radius in metres
 * @param {number} alertData.latitude     - Current latitude
 * @param {number} alertData.longitude    - Current longitude
 */
function emitGeofenceAlert(io, alertData) {
  if (!io) return;

  // Find all online caregivers and emit to them specifically
  const caregiverSockets = [];
  onlineUsers.forEach((user) => {
    if (user.role === 'caregiver') {
      caregiverSockets.push(user.socketId);
    }
  });

  const payload = {
    ...alertData,
    timestamp: new Date().toISOString(),
  };

  if (caregiverSockets.length > 0) {
    caregiverSockets.forEach((sid) => {
      io.to(sid).emit('geofence:alert', payload);
    });
    console.log(`🚨 Geofence alert emitted to ${caregiverSockets.length} caregiver(s) for patient [${alertData.patientName}]`);
  } else {
    console.log(`🚨 Geofence alert for [${alertData.patientName}] — no caregivers online`);
  }
}

module.exports = { initializeSocket, emitGeofenceAlert };
