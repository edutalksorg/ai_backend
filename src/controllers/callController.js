const pool = require('../config/db');

const { sendToUser, sendToRoom, notifyFriendsOfStatusChange } = require('../services/socketService');

// @desc    Update availability
// @route   PUT /api/v1/calls/availability
// @access  Private
const updateAvailability = async (req, res) => {
    try {
        const { status } = req.body;
        const userId = req.user.id;
        // Postgres: lastActiveAt -> 'lastactiveat'
        await pool.query('UPDATE users SET status = $1, lastactiveat = NOW() WHERE id = $2', [status, userId]);

        // Notify friends of the manual status change
        notifyFriendsOfStatusChange(userId, status);

        res.json({ success: true, message: 'Status updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const { isUserCallEligible } = require('../utils/userUtils');

// @desc    Get available users
// @route   GET /api/v1/calls/available-users
// @access  Private
const getAvailableUsers = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`\n🔍 Fetching available users for: ${userId}`);

        // Fix casing for Postgres
        const { rows: candidates } = await pool.query(`
            SELECT u.id, u.fullname as "fullName", u.avatarurl as "avatarUrl", u.status, u.role, u.lastactiveat as "lastActiveAt",
                   s.status as "subStatus", s.enddate as "subEndDate",
                   p.name as "planName"
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.userid AND s.status = 'active'
            LEFT JOIN plans p ON s.planid = p.id
            WHERE u.status = 'Online' 
              AND LOWER(u.role) NOT IN ('admin', 'superadmin', 'instructor')
              AND u.id != $1
        `, [userId]);

        const availableUsers = [];
        const now = new Date();

        for (const candidate of candidates) {
            const lastActive = new Date(candidate.lastActiveAt);
            const diffMinutes = (now - lastActive) / 1000 / 60;

            if (diffMinutes > 5) {
                continue;
            }

            const isEligible = await isUserCallEligible(candidate);
            if (isEligible) {
                const { subStatus, subEndDate, planName, ...publicData } = candidate;
                availableUsers.push(publicData);
            }
        }

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

        const { rows: users } = await pool.query('SELECT fullName as "fullName", avatarUrl as "avatarUrl", role FROM users WHERE id = $1', [calleeId]);
        if (users.length === 0) return res.status(404).json({ message: 'Callee not found' });
        const callee = users[0];

        const { rows: callerUsers } = await pool.query('SELECT fullName as "fullName", avatarUrl as "avatarUrl" FROM users WHERE id = $1', [callerId]);
        const caller = callerUsers[0];

        const { rows: result } = await pool.query(
            'INSERT INTO call_history (callerid, calleeid, status, topicid) VALUES ($1, $2, $3, $4) RETURNING id',
            [callerId, calleeId, 'initiated', topicId || null]
        );

        const callId = result[0].id;
        // Notify Callee via Socket (unchanged logic)
        sendToUser(calleeId, 'CallInvitation', {
            callId: callId,
            callerId: callerId,
            callerName: caller.fullName,
            callerAvatar: caller.avatarUrl,
            timestamp: new Date().toISOString(),
            expiresInSeconds: 60
        });

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
        const { rows: callerUsers } = await pool.query('SELECT fullName as "fullName", avatarUrl as "avatarUrl" FROM users WHERE id = $1', [callerId]);
        const caller = callerUsers[0];

        // Postgres random is RANDOM(), MySQL is RAND()
        const { rows: candidates } = await pool.query(`
            SELECT u.id, u.fullName as "fullName", u.avatarUrl as "avatarUrl", u.role,
                   s.status as "subStatus", s.endDate as "subEndDate",
                   p.name as "planName"
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.userid AND s.status = 'active'
            LEFT JOIN plans p ON s.planid = p.id
            WHERE u.status = 'Online' 
              AND LOWER(u.role) NOT IN ('admin', 'superadmin', 'instructor')
              AND u.id != $1
              AND u.lastactiveat > NOW() - INTERVAL '5 minutes' 
            ORDER BY RANDOM()
        `, [callerId]); // Fixed DATE_SUB -> INTERVAL syntax for PG. Fixed RAND() -> RANDOM().

        let callee = null;
        for (const candidate of candidates) {
            if (await isUserCallEligible(candidate)) {
                callee = candidate;
                break;
            }
        }

        if (!callee) {
            return res.json({
                success: false,
                message: 'No available users found at the moment. Please try again later.'
            });
        }

        const { rows: result } = await pool.query(
            'INSERT INTO call_history (callerid, calleeid, status) VALUES ($1, $2, $3) RETURNING id',
            [callerId, callee.id, 'initiated']
        );

        const callId = result[0].id;
        sendToUser(callee.id, 'CallInvitation', {
            callId: callId,
            callerId: callerId,
            callerName: caller.fullName,
            callerAvatar: caller.avatarUrl,
            timestamp: new Date().toISOString(),
            expiresInSeconds: 60
        });

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

        const { rows: calls } = await pool.query('SELECT * FROM call_history WHERE id = $1 AND calleeid = $2', [id, userId]);
        if (calls.length === 0) return res.status(404).json({ message: 'Call not found' });

        const call = calls[0]; // lowercase props: callerid
        const status = accept ? 'accepted' : 'rejected';

        // Update startedat only if it's currently NULL or we want to reset it at acceptance
        await pool.query('UPDATE call_history SET status = $1, startedat = NOW() WHERE id = $2', [status, id]);

        // Notify Caller
        // call.callerId -> call.callerid
        if (accept) {
            sendToUser(call.callerid, 'CallAccepted', { callId: id });
        } else {
            sendToUser(call.callerid, 'CallRejected', { callId: id });
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

        const { rows: calls } = await pool.query('SELECT * FROM call_history WHERE id = $1 AND (callerid = $2 OR calleeid = $2)', [id, userId]);
        if (calls.length === 0) return res.status(404).json({ message: 'Call not found' });

        const call = calls[0];
        // callerid, calleeid lowercase
        const otherUserId = call.callerid === userId ? call.calleeid : call.callerid;
        const endTime = new Date();
        const durationSeconds = call.startedat ? Math.ceil((endTime - new Date(call.startedat)) / 1000) : 0;

        await pool.query('UPDATE call_history SET status = \'completed\', endedat = $1, durationseconds = $2 WHERE id = $3', [endTime, durationSeconds, id]);

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
        const { rows: history } = await pool.query(
            `SELECT ch.id, ch.status, ch.channelname as "channelName", ch.durationseconds as "durationSeconds", 
                    ch.startedat as "startedAt", ch.endedat as "endedAt", ch.created_at as "createdAt", ch.rating, ch.recording_url as "recordingUrl",
                    u.fullname as "otherUserName", 
                    CASE WHEN ch.callerid = $1 THEN FALSE ELSE TRUE END as "isIncoming"
             FROM call_history ch 
             LEFT JOIN users u ON (ch.callerid = u.id OR ch.calleeid = u.id) AND u.id != $2
             WHERE ch.callerid = $3 OR ch.calleeid = $4 
             ORDER BY COALESCE(ch.startedat, ch.created_at) DESC`,
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

        if (isNaN(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5' });
        }

        const { rows: calls } = await pool.query(
            'SELECT * FROM call_history WHERE id = $1 AND (callerid = $2 OR calleeid = $2)',
            [id, userId]
        );

        if (calls.length === 0) {
            return res.status(404).json({ message: 'Call not found' });
        }

        await pool.query('UPDATE call_history SET rating = $1 WHERE id = $2', [rating, id]);

        res.json({ success: true, message: 'Rating submitted successfully' });
    } catch (error) {
        console.error('[rateCall] Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Upload call recording
// @route   POST /api/v1/calls/:id/recording
// @access  Private
const uploadRecording = async (req, res) => {
    try {
        const { id } = req.params;

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Construct public URL
        const recordingUrl = `/uploads/recordings/${req.file.filename}`;

        // Update DB
        await pool.query(
            'UPDATE call_history SET recording_url = $1 WHERE id = $2',
            [recordingUrl, id]
        );

        res.json({ success: true, url: recordingUrl });
    } catch (error) {
        console.error('[uploadRecording] Error:', error);
        res.status(500).json({ message: 'Server error during upload' });
    }
};

// @desc    Get all call records (Admin)
// @route   GET /api/v1/admin/calls
// @access  Private/Admin
const getAllCalls = async (req, res) => {
    try {
        const { search, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT 
                ch.id as "callId", 
                u1.fullname as "callerName", 
                u2.fullname as "calleeName", 
                ch.startedat as "startedAt", 
                ch.created_at as "createdAt", 
                ch.durationseconds as "durationSeconds", 
                ch.status, 
                ch.recording_url as "recordingUrl"
            FROM call_history ch
            LEFT JOIN users u1 ON ch.callerid = u1.id
            LEFT JOIN users u2 ON ch.calleeid = u2.id
        `;

        const queryParams = [];
        if (search) {
            query += ` WHERE 
                u1.fullname ILIKE $1 OR 
                u1.email ILIKE $1 OR 
                u1.phonenumber ILIKE $1 OR 
                u2.fullname ILIKE $1 OR 
                u2.email ILIKE $1 OR 
                u2.phonenumber ILIKE $1 OR 
                ch.id::text ILIKE $1`;
            queryParams.push(`%${search}%`);
        }

        query += ` ORDER BY COALESCE(ch.startedat, ch.created_at) DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
        queryParams.push(limit, offset);

        const { rows } = await pool.query(query, queryParams);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching all calls:', error);
        res.status(500).json({ message: 'Error fetching call records' });
    }
};

// @desc    Delete call record (Admin)
// @route   DELETE /api/v1/admin/calls/:id
// @access  Private/SuperAdmin
const adminDeleteCall = async (req, res) => {
    try {
        const { id } = req.params;
        const fs = require('fs');
        const path = require('path');

        // 1. Get recording URL to delete file
        const { rows } = await pool.query('SELECT recording_url FROM call_history WHERE id = $1', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Call record not found' });
        }

        const recordingUrl = rows[0].recording_url;

        // 2. Delete file if exists
        if (recordingUrl) {
            const filePath = path.join(__dirname, '../../', recordingUrl);
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`Deleted recording file: ${filePath}`);
                } catch (err) {
                    console.error(`Error deleting file ${filePath}:`, err);
                }
            }
        }

        // 3. Delete from DB
        await pool.query('DELETE FROM call_history WHERE id = $1', [id]);

        res.status(200).json({ success: true, message: 'Call record deleted successfully' });
    } catch (error) {
        console.error('Error deleting call:', error);
        res.status(500).json({ message: 'Error deleting call record' });
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
    rateCall,
    uploadRecording,
    getAllCalls,
    adminDeleteCall
};
