const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const pool = require('../config/db'); // Import DB pool for status updates
const { isUserCallEligible } = require('../utils/userUtils');

let io;
const userSockets = new Map(); // userId (string) -> Set of socketIds

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: [
                "http://localhost:3000",
                "https://d1ls14uofwgojt.cloudfront.net/"
            ],
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    io.use((socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        if (!token) {
            return next(new Error('Authentication error: No token provided'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // ENFORCE STRING TYPE FOR USERID TO AVOID MISMATCHES
            socket.userId = String(decoded.id);
            next();
        } catch (err) {
            return next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.userId;
        console.log(`[Socket] User ${userId} connected (${socket.id})`);

        // Track user socket
        if (!userSockets.has(userId)) {
            userSockets.set(userId, new Set());
        }
        userSockets.get(userId).add(socket.id);

        // Mark user as Online in DB immediately
        updateUserStatus(userId, 'Online');
        notifyFriendsOfStatusChange(userId, 'Online');

        socket.on('disconnect', async () => {
            console.log(`[Socket] User ${userId} disconnected (${socket.id})`);
            const sockets = userSockets.get(userId);
            if (sockets) {
                sockets.delete(socket.id);
                if (sockets.size === 0) {
                    userSockets.delete(userId);
                    // Mark user as Offline in DB if no other tabs open
                    console.log(`[Socket] User ${userId} has no more active connections. Setting to Offline.`);
                    await updateUserStatus(userId, 'Offline');
                    await notifyFriendsOfStatusChange(userId, 'Offline');
                }
            }
        });

        // Hub Methods (Client -> Server)
        socket.on('JoinCallSession', (callId) => {
            socket.join(`call_${callId}`);
            console.log(`[Socket] User ${userId} joined room call_${callId}`);
        });

        socket.on('LeaveCallSession', (callId) => {
            socket.leave(`call_${callId}`);
            console.log(`[Socket] User ${userId} left room call_${callId}`);
        });
    });

    return io;
};

// Helper to update DB status
const updateUserStatus = async (userId, status) => {
    try {
        // Postgres: Columns are lowercase (status, lastactiveat)
        await pool.query('UPDATE users SET status = $1, lastactiveat = NOW() WHERE id = $2', [status, userId]);
    } catch (error) {
        console.error(`[Socket] Failed to update user ${userId} status to ${status}:`, error.message);
    }
};

const sendToUser = (userId, event, data) => {
    // Normalize to string
    const targetUserId = String(userId);

    console.log(`\n[Socket] 📤 Attempting to send "${event}" to user ${targetUserId}`);
    console.log(`[Socket] 📊 Connected users in Map:`, Array.from(userSockets.keys()));

    const socketIds = userSockets.get(targetUserId);
    if (socketIds) {
        console.log(`[Socket] ✅ Found ${socketIds.size} socket(s) for user ${targetUserId}`);

        socketIds.forEach(id => {
            io.to(id).emit(event, data);
            // Also emit lowercase version for compatibility with frontend registerHandlers logic
            io.to(id).emit(event.toLowerCase(), data);
        });
        console.log(`[Socket] ✅ Successfully emitted "${event}" to user ${targetUserId}\n`);
        return true;
    } else {
        console.log(`[Socket] ❌ NO sockets found for user ${targetUserId}. User is not in the connection Map.`);
        console.log(`[Socket] ⚠️ Check if user ID ${targetUserId} matches ANY of:`, Array.from(userSockets.keys()));
        return false;
    }
};

const sendToRoom = (callId, event, data) => {
    io.to(`call_${callId}`).emit(event, data);
    io.to(`call_${callId}`).emit(event.toLowerCase(), data);
};

// New: Notify friends of status change
const notifyFriendsOfStatusChange = async (userId, status) => {
    try {
        console.log(`[Socket] 🔔 Notifying friends of user ${userId} status change: ${status}`);

        // 1. Get Confirm Friends
        const { rows: friends } = await pool.query(`
            SELECT 
                CASE 
                    WHEN requester_id = $1 THEN recipient_id 
                    ELSE requester_id 
                END as "friendId"
            FROM user_connections 
            WHERE (requester_id = $1 OR recipient_id = $1) 
              AND status = 'accepted'
        `, [userId]);

        if (friends.length === 0) return;

        // 2. Calculate Eligibility for current user
        // We need the user's role and sub status. 
        // Ideally we fetch full user object, but isUserCallEligible takes {id, role} + DB lookups.
        const { rows: userRes } = await pool.query('SELECT id, role FROM users WHERE id = $1', [userId]);
        if (userRes.length === 0) return;

        const isEligible = await isUserCallEligible(userRes[0]);

        const payload = {
            userId: userId,
            onlineStatus: status, // 'Online' or 'Offline'
            isCallEligible: isEligible
        };

        // 3. Broadcast to each friend
        for (const friend of friends) {
            sendToUser(friend.friendId, 'UserEligibilityChanged', payload);
        }

    } catch (error) {
        console.error(`[Socket] Error notifying friends for user ${userId}:`, error);
    }
};

module.exports = {
    initSocket,
    sendToUser,
    sendToRoom,
    notifyFriendsOfStatusChange,
    getIO: () => io
};
