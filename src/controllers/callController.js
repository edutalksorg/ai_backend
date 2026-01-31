const pool = require('../config/db');
const { sendToUser, sendToRoom } = require('../services/socketService');

// @desc    Update availability
// @route   PUT /api/v1/calls/availability
// @access  Private
const updateAvailability = async (req, res) => {
    try {
        const { status } = req.body; // Online/Offline
        const userId = req.user.id;
        await pool.query('UPDATE users SET status = ?, lastActiveAt = NOW() WHERE id = ?', [status, userId]);
        res.json({ success: true, message: 'Status updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};


// Helper to check if a user is available for calls
const isUserCallEligible = async (user) => {
    // 0. Admins/Instructors are always eligible to RECEIVE calls if online
    if (['Admin', 'SuperAdmin', 'Instructor'].includes(user.role)) {
        console.log(`[Eligible] User ${user.id} is ${user.role} -> APPROVED`);
        return true;
    }

    // 1. Check for active subscription
    const [subs] = await pool.query(`
        SELECT s.*, p.name as planName 
        FROM subscriptions s 
        JOIN plans p ON s.planId = p.id 
        WHERE s.userId = ? AND s.status = 'active' AND s.endDate > NOW()
    `, [user.id]);

    if (subs.length > 0) {
        const planName = subs[0].planName.toLowerCase();
        // Paid plans are always eligible
        if (planName.includes('monthly') || planName.includes('quarterly') || planName.includes('yearly')) {
            console.log(`[Eligible] User ${user.id} has active plan '${subs[0].planName}' -> APPROVED`);
            return true;
        }
    }

    // 2. Free Users (Trial): Check 5-minute limit (300 seconds)
    const [calls] = await pool.query(`
        SELECT id, durationSeconds, status, startedAt 
        FROM call_history 
        WHERE (callerId = ? OR calleeId = ?) 
          AND status = 'completed'
    `, [user.id, user.id]);

    let totalSeconds = 0;
    const callDetails = [];

    for (const call of calls) {
        // PER USER REQUEST: Use actual talk time
        const duration = call.durationSeconds || 0;
        totalSeconds += duration;
        callDetails.push(`[${call.id}: ${duration}s]`);
    }

    const limitSeconds = 300; // 5 minutes
    const remaining = limitSeconds - totalSeconds;
    const isEligible = totalSeconds < limitSeconds;

    console.log(`[Eligible] Free User ${user.id} usage check: Used ${totalSeconds.toFixed(0)}/${limitSeconds}s.`);
    console.log(`[Eligible] History contributing to usage: ${callDetails.join(', ')}`);
    console.log(`[Eligible] Result: ${isEligible ? 'APPROVED' : 'REJECTED'}`);

    return isEligible;
};

// @desc    Get available users
// @route   GET /api/v1/calls/available-users
// @access  Private
const getAvailableUsers = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`\n🔍 Fetching available users for: ${userId}`);

        const [candidates] = await pool.query(`
            SELECT u.id, u.fullName, u.avatarUrl, u.status, u.role, u.lastActiveAt,
                   s.status as subStatus, s.endDate as subEndDate,
                   p.name as planName
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.userId AND s.status = 'active'
            LEFT JOIN plans p ON s.planId = p.id
            WHERE u.status = "Online" 
              AND LOWER(u.role) NOT IN ('admin', 'superadmin', 'instructor')
              AND u.id != ? 
        `, [userId]);

        console.log(`📊 Found ${candidates.length} 'Online' candidates (Filtered by Role)`);
        candidates.forEach(c => console.log(`   - ${c.fullName} (ID: ${c.id}, Role: ${c.role})`));

        const availableUsers = [];
        const now = new Date();

        for (const candidate of candidates) {
            // Check 5 minute timeout explicitly in code for better logging
            const lastActive = new Date(candidate.lastActiveAt);
            const diffMinutes = (now - lastActive) / 1000 / 60;

            if (diffMinutes > 5) {
                console.log(`❌ User ${candidate.fullName} (${candidate.id}) timed out. Last active: ${diffMinutes.toFixed(1)}m ago`);
                continue;
            }

            const isEligible = await isUserCallEligible(candidate);
            if (isEligible) {
                console.log(`✅ User ${candidate.fullName} (${candidate.id}) is available`);
                const { subStatus, subEndDate, planName, ...publicData } = candidate;
                availableUsers.push(publicData);
            } else {
                console.log(`⚠️ User ${candidate.fullName} (${candidate.id}) is NOT eligible (e.g. trial expired)`);
            }
        }

        console.log(`📤 Returning ${availableUsers.length} available users\n`);
        res.json({ success: true, data: availableUsers });
    } catch (error) {
        console.error('Error fetching available users:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Initiate Call (Direct)
// @route   POST /api/v1/calls/initiate
// @access  Private
const initiateCall = async (req, res) => {
    try {
        const callerId = req.user.id;
        const { calleeId, topicId } = req.body;

        const [users] = await pool.query('SELECT fullName, avatarUrl, role FROM users WHERE id = ?', [calleeId]);
        if (users.length === 0) return res.status(404).json({ message: 'Callee not found' });

        const callee = users[0];
        const [callerUsers] = await pool.query('SELECT fullName, avatarUrl FROM users WHERE id = ?', [callerId]);
        const caller = callerUsers[0];

        // Create call record - Explicitly set startedAt to NULL so timer doesn't start until acceptance
        const [result] = await pool.query(
            'INSERT INTO call_history (callerId, calleeId, status, topicId, startedAt) VALUES (?, ?, ?, ?, NULL)',
            [callerId, calleeId, 'initiated', topicId || null]
        );

        const callId = result.insertId;

        console.log(`\n📞 Call Initiated - ID: ${callId}`);
        console.log(`👤 Caller: ${caller.fullName} (ID: ${callerId})`);
        console.log(`📱 Callee: ${callee.fullName} (ID: ${calleeId})`);
        console.log(`🔔 Sending CallInvitation event to user ${calleeId}...`);

        // Notify Callee via Socket
        const notificationSent = sendToUser(calleeId, 'CallInvitation', {
            callId: callId,
            callerId: callerId,
            callerName: caller.fullName,
            callerAvatar: caller.avatarUrl,
            timestamp: new Date().toISOString(),
            expiresInSeconds: 60
        });

        console.log(`Socket notification sent: ${notificationSent ? '✅ Success' : '❌ Failed'}\n`);

        res.json({
            success: true,
            data: {
                callId,
                calleeId,
                calleeName: callee.fullName,
                calleeAvatar: callee.avatarUrl,
                status: 'initiated'
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Initiate random call
// @route   POST /api/v1/calls/initiate-random
// @access  Private
const initiateRandomCall = async (req, res) => {
    try {
        const callerId = req.user.id;
        const [callerUsers] = await pool.query('SELECT fullName, avatarUrl FROM users WHERE id = ?', [callerId]);
        const caller = callerUsers[0];

        const [candidates] = await pool.query(`
            SELECT u.id, u.fullName, u.avatarUrl, u.role,
                   s.status as subStatus, s.endDate as subEndDate,
                   p.name as planName
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.userId AND s.status = 'active'
            LEFT JOIN plans p ON s.planId = p.id
            WHERE u.status = "Online" 
              AND LOWER(u.role) NOT IN ('admin', 'superadmin', 'instructor')
              AND u.id != ? 
              AND u.lastActiveAt > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
            ORDER BY RAND()
        `, [callerId]);

        let callee = null;
        for (const candidate of candidates) {
            if (await isUserCallEligible(candidate)) {
                callee = candidate;
                break;
            }
        }

        if (!callee) {
            return res.status(404).json({ message: 'No available users found' });
        }

        const [result] = await pool.query(
            'INSERT INTO call_history (callerId, calleeId, status, startedAt) VALUES (?, ?, ?, NULL)',
            [callerId, callee.id, 'initiated']
        );

        const callId = result.insertId;

        console.log(`\n📞 Random Call Initiated - ID: ${callId}`);
        console.log(`👤 Caller: ${caller.fullName} (ID: ${callerId})`);
        console.log(`📱 Callee: ${callee.fullName} (ID: ${callee.id})`);
        console.log(`🔔 Sending CallInvitation event to user ${callee.id}...`);

        // Notify Callee
        const notificationSent = sendToUser(callee.id, 'CallInvitation', {
            callId: callId,
            callerId: callerId,
            callerName: caller.fullName,
            callerAvatar: caller.avatarUrl,
            timestamp: new Date().toISOString(),
            expiresInSeconds: 60
        });

        console.log(`Socket notification sent: ${notificationSent ? '✅ Success' : '❌ Failed'}\n`);

        res.json({
            success: true,
            data: {
                callId,
                calleeId: callee.id,
                calleeName: callee.fullName,
                calleeAvatar: callee.avatarUrl,
                status: 'initiated'
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Respond to call
// @route   POST /api/v1/calls/:id/respond
// @access  Private
const respondToCall = async (req, res) => {
    try {
        const { id } = req.params;
        const accept = req.body === true || req.body.accept === true;
        const userId = req.user.id;

        const [calls] = await pool.query('SELECT * FROM call_history WHERE id = ? AND calleeId = ?', [id, userId]);
        if (calls.length === 0) return res.status(404).json({ message: 'Call not found' });

        const call = calls[0];
        const status = accept ? 'accepted' : 'rejected';

        await pool.query('UPDATE call_history SET status = ?, startedAt = ? WHERE id = ?', [status, accept ? new Date() : null, id]);

        // Notify Caller
        if (accept) {
            sendToUser(call.callerId, 'CallAccepted', { callId: id });
        } else {
            sendToUser(call.callerId, 'CallRejected', { callId: id });
        }

        res.json({ success: true, status });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    End call
// @route   POST /api/v1/calls/:id/end
// @access  Private
const endCall = async (req, res) => {
    try {
        const { id } = req.params;
        const reason = typeof req.body === 'string' ? req.body : (req.body.reason || 'Ended by user');
        const userId = req.user.id;

        const [calls] = await pool.query('SELECT * FROM call_history WHERE id = ? AND (callerId = ? OR calleeId = ?)', [id, userId, userId]);
        if (calls.length === 0) return res.status(404).json({ message: 'Call not found' });

        const call = calls[0];
        const otherUserId = call.callerId === userId ? call.calleeId : call.callerId;
        const endTime = new Date();
        const durationSeconds = call.startedAt ? Math.floor((endTime - new Date(call.startedAt)) / 1000) : 0;

        await pool.query('UPDATE call_history SET status = "completed", endedAt = ?, durationSeconds = ? WHERE id = ?', [endTime, durationSeconds, id]);

        // Notify Other Participant
        sendToUser(otherUserId, 'CallEnded', { callId: id, reason });

        res.json({ success: true, message: 'Call ended' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get all call history
// @route   GET /api/v1/calls/history
// @access  Private
const getCallHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const [history] = await pool.query(
            `SELECT ch.*, 
                    u.fullName as otherUserName, 
                    CASE WHEN ch.callerId = ? THEN FALSE ELSE TRUE END as isIncoming
             FROM call_history ch 
             LEFT JOIN users u ON (ch.callerId = u.id OR ch.calleeId = u.id) AND u.id != ?
             WHERE ch.callerId = ? OR ch.calleeId = ? 
             ORDER BY ch.startedAt DESC`,
            [userId, userId, userId, userId]
        );
        res.json({ success: true, data: history });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Rate a call
// @route   POST /api/v1/calls/:id/rate
// @access  Private
const rateCall = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Parse rating from body - it might be sent as string or number
        let rating;
        if (typeof req.body === 'number') {
            rating = req.body;
        } else if (typeof req.body === 'string') {
            rating = parseInt(req.body, 10);
        } else if (req.body && typeof req.body.rating !== 'undefined') {
            rating = parseInt(req.body.rating, 10);
        } else {
            return res.status(400).json({ message: 'Rating is required' });
        }

        // Validate rating is 1-5
        if (isNaN(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5' });
        }

        // Verify user was part of this call
        const [calls] = await pool.query(
            'SELECT * FROM call_history WHERE id = ? AND (callerId = ? OR calleeId = ?)',
            [id, userId, userId]
        );

        if (calls.length === 0) {
            return res.status(404).json({ message: 'Call not found' });
        }

        // Update rating (add rating column if it doesn't exist)
        await pool.query('UPDATE call_history SET rating = ? WHERE id = ?', [rating, id]);

        console.log(`✅ Call ${id} rated ${rating} stars by user ${userId}`);

        res.json({ success: true, message: 'Rating submitted successfully' });
    } catch (error) {
        console.error('[rateCall] Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    updateAvailability,
    getAvailableUsers,
    initiateCall,
    initiateRandomCall,
    respondToCall,
    endCall,
    getCallHistory,
    rateCall
};
