const pool = require('../config/db');

// @desc    Update availability
// @route   POST /api/v1/users/availability
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
    // 1. Must have an active subscription
    if (!user.planName || user.subStatus !== 'active' || new Date(user.subEndDate) <= new Date()) {
        return false;
    }

    const planName = user.planName.toLowerCase();

    // 2. Paid plans are always eligible
    if (planName.includes('monthly') || planName.includes('quarterly') || planName.includes('yearly')) {
        return true;
    }

    // 3. Free plans check usage limit (5 mins)
    if (planName.includes('free') || planName.includes('trial')) {
        const [calls] = await pool.query(`
            SELECT durationSeconds 
            FROM call_history 
            WHERE (callerId = ? OR calleeId = ?) 
              AND status = 'completed'
        `, [user.id, user.id]);

        let totalSeconds = 0;
        for (const call of calls) {
            // "Any call less than 1 minute is counted as 1 full minute"
            totalSeconds += (call.durationSeconds < 60) ? 60 : call.durationSeconds;
        }

        return totalSeconds < 300; // Less than 300 seconds (5 mins)
    }

    return false;
};

// @desc    Get available users
// @route   GET /api/v1/calls/available-users
// @access  Private
const getAvailableUsers = async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch candidates: Online, not self, active recently
        const [candidates] = await pool.query(`
            SELECT u.id, u.fullName, u.avatarUrl, u.status,
                   s.status as subStatus, s.endDate as subEndDate,
                   p.name as planName
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.userId AND s.status = 'active'
            LEFT JOIN plans p ON s.planId = p.id
            WHERE u.status = "Online" 
              AND u.id != ? 
              AND u.lastActiveAt > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
        `, [userId]);

        const availableUsers = [];

        for (const candidate of candidates) {
            if (await isUserCallEligible(candidate)) {
                // Remove internal fields before sending
                const { subStatus, subEndDate, planName, ...publicData } = candidate;
                availableUsers.push(publicData);
            }
        }

        res.json({ success: true, data: availableUsers });
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

        // Fetch candidates (same logic as available users)
        const [candidates] = await pool.query(`
            SELECT u.id, u.fullName, u.avatarUrl,
                   s.status as subStatus, s.endDate as subEndDate,
                   p.name as planName
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.userId AND s.status = 'active'
            LEFT JOIN plans p ON s.planId = p.id
            WHERE u.status = "Online" 
              AND u.id != ? 
              AND u.lastActiveAt > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
            ORDER BY RAND()
        `, [callerId]);

        let callee = null;

        // Find first eligible candidate
        for (const candidate of candidates) {
            if (await isUserCallEligible(candidate)) {
                callee = candidate;
                break;
            }
        }

        if (!callee) {
            return res.status(404).json({ message: 'No available users found' });
        }

        // Create call record
        const [result] = await pool.query(
            'INSERT INTO call_history (callerId, calleeId, status) VALUES (?, ?, ?)',
            [callerId, callee.id, 'ringing']
        );

        res.json({
            success: true,
            data: {
                callId: result.insertId,
                calleeId: callee.id,
                calleeName: callee.fullName,
                calleeAvatar: callee.avatarUrl,
                status: 'ringing'
            }
        });
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

module.exports = { updateAvailability, getAvailableUsers, initiateRandomCall, getCallHistory };
