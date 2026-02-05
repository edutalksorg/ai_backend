const pool = require('../config/db');
const socketService = require('../services/socketService');

pool.on('connect', () => {
    // Log connected database only once
    const dbName = pool.options.database;
    console.log(`[Database] Connected to PostgreSQL: ${dbName}`);
});

// @desc    Send Friend Request
// @route   POST /api/v1/connections/request
// @access  Private
const sendRequest = async (req, res) => {
    try {
        const requesterId = req.user.id;
        const { recipientId } = req.body;

        if (!recipientId) {
            return res.status(400).json({ message: 'Recipient ID is required' });
        }

        if (requesterId === recipientId) {
            return res.status(400).json({ message: 'You cannot add yourself as a friend' });
        }

        // Check if a SAME DIRECTION connection already exists
        const { rows: existing } = await pool.query(
            'SELECT * FROM user_connections WHERE requester_id = $1 AND recipient_id = $2',
            [requesterId, recipientId]
        );

        if (existing.length > 0) {
            const conn = existing[0];
            if (conn.status === 'accepted') {
                return res.json({ success: true, message: 'You are already friends' });
            } else if (conn.status === 'pending') {
                return res.json({ success: true, message: 'Friend request is already pending' });
            }
            // If rejected, allow sending again
            await pool.query('DELETE FROM user_connections WHERE id = $1', [conn.id]);
        }

        await pool.query(
            'INSERT INTO user_connections (requester_id, recipient_id, status) VALUES ($1, $2, \'pending\')',
            [requesterId, recipientId]
        );

        // Notify recipient via Socket
        const { rows: requester } = await pool.query('SELECT fullname as "fullName", avatarurl as "avatarUrl" FROM users WHERE id = $1', [requesterId]);
        if (requester.length > 0) {
            // Get the ID of the newly created connection (it might be needed)
            const { rows: newConn } = await pool.query('SELECT id FROM user_connections WHERE requester_id = $1 AND recipient_id = $2 AND status = \'pending\'', [requesterId, recipientId]);

            socketService.sendToUser(recipientId, 'FriendRequestReceived', {
                connectionId: newConn[0]?.id,
                userId: requesterId,
                fullName: requester[0].fullName,
                avatarUrl: requester[0].avatarUrl
            });
        }

        res.json({ success: true, message: 'Friend request sent' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Accept Friend Request
// @route   POST /api/v1/connections/accept/:id
// @access  Private
const acceptRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const { rows: connection } = await pool.query(
            'SELECT * FROM user_connections WHERE id = $1',
            [id]
        );

        if (connection.length === 0) {
            return res.status(404).json({ message: 'Friend request not found' });
        }

        const conn = connection[0];

        // Ensure the current user is the recipient
        if (conn.recipient_id !== userId) {
            return res.status(403).json({ message: 'You can only accept requests sent to you' });
        }

        if (conn.status === 'accepted') {
            return res.json({ success: true, message: 'Friend request already accepted' });
        }

        if (conn.status === 'rejected') {
            return res.status(400).json({ message: 'Cannot accept a rejected request' });
        }

        // Accept the current request
        await pool.query(
            'UPDATE user_connections SET status = \'accepted\', updated_at = NOW() WHERE id = $1',
            [id]
        );

        // Also accept the reciprocal request if it exists to clean up notifications
        await pool.query(
            'UPDATE user_connections SET status = \'accepted\', updated_at = NOW() WHERE requester_id = $1 AND recipient_id = $2 AND status = \'pending\'',
            [userId, conn.requester_id]
        );

        // Notify original requester via Socket
        const { rows: acceptor } = await pool.query('SELECT fullname as "fullName", avatarurl as "avatarUrl" FROM users WHERE id = $1', [userId]);
        if (acceptor.length > 0) {
            socketService.sendToUser(conn.requester_id, 'FriendRequestAccepted', {
                connectionId: id,
                userId: userId,
                fullName: acceptor[0].fullName,
                avatarUrl: acceptor[0].avatarUrl
            });

            // Notify both of eligibility/online status change to refresh friends list
            socketService.notifyFriendsOfStatusChange(userId, 'Online');
            socketService.notifyFriendsOfStatusChange(conn.requester_id, 'Online');
        }

        res.json({ success: true, message: 'Friend request accepted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Reject Friend Request
// @route   POST /api/v1/connections/reject/:id
// @access  Private
const rejectRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const { rows: connection } = await pool.query(
            'SELECT * FROM user_connections WHERE id = $1',
            [id]
        );

        if (connection.length === 0) {
            return res.status(404).json({ message: 'Friend request not found' });
        }

        const conn = connection[0];

        // Allow either the requester (to cancel) or the recipient (to reject) to process this
        if (conn.requester_id !== userId && conn.recipient_id !== userId) {
            return res.status(403).json({ message: 'You are not authorized to process this request' });
        }

        if (conn.status === 'rejected') {
            return res.json({ success: true, message: 'Friend request already rejected' });
        }

        // If it was accepted, we are "unfriending" - this is allowed
        const otherUserId = conn.requester_id === userId ? conn.recipient_id : conn.requester_id;

        // Reject/Cancel the current request
        await pool.query(
            'UPDATE user_connections SET status = \'rejected\', updated_at = NOW() WHERE id = $1',
            [id]
        );

        // If I reject your request, and I also have a pending/accepted request to you, cancel mine too
        await pool.query(
            'UPDATE user_connections SET status = \'rejected\', updated_at = NOW() WHERE requester_id = $1 AND recipient_id = $2',
            [userId, otherUserId]
        );

        // Notify both users to refresh their lists
        socketService.sendToUser(userId, 'FriendshipRemoved', { userId: otherUserId });
        socketService.sendToUser(otherUserId, 'FriendshipRemoved', { userId: userId });

        // Also broadcast status change to force list refresh (clears the "Call" button)
        socketService.notifyFriendsOfStatusChange(userId, 'Online');
        socketService.notifyFriendsOfStatusChange(otherUserId, 'Online');

        res.json({ success: true, message: 'Friend request rejected' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get Connections (Friends & Pending Requests)
// @route   GET /api/v1/connections
// @access  Private
const getConnections = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get Pending Requests (where user is the recipient)
        const { rows: pendingRequests } = await pool.query(`
      SELECT uc.id as "connectionId", u.id as "userId", u.fullname as "fullName", u.avatarurl as "avatarUrl"
      FROM user_connections uc
      JOIN users u ON uc.requester_id = u.id
      WHERE uc.recipient_id = $1 AND uc.status = 'pending'
    `, [userId]);

        // Get Sent Requests (where user is the requester)
        const { rows: sentRequests } = await pool.query(`
      SELECT uc.id as "connectionId", u.id as "userId", u.fullname as "fullName", u.avatarurl as "avatarUrl"
      FROM user_connections uc
      JOIN users u ON uc.recipient_id = u.id
      WHERE uc.requester_id = $1 AND uc.status = 'pending'
    `, [userId]);

        // Get Friends (Accepted connections)
        const { rows: friendsData } = await pool.query(`
      SELECT u.id as "userId", u.fullname as "fullName", u.avatarurl as "avatarUrl", u.status as "onlineStatus", u.role, MAX(uc.id) as "connectionId"
      FROM user_connections uc
      JOIN users u ON (uc.requester_id = u.id OR uc.recipient_id = u.id) AND u.id != $1
      WHERE (uc.requester_id = $1 OR uc.recipient_id = $1) AND uc.status = 'accepted'
      GROUP BY u.id, u.fullname, u.avatarurl, u.status, u.role
    `, [userId]);

        // Helper logic to check eligibility (Duplicated from callController to avoid circular deps/refactor)
        // Ideally this should be in a shared service
        const checkEligibility = async (candidateId, role) => {
            if (['Admin', 'SuperAdmin', 'Instructor'].includes(role)) return true;

            // 1. Check Active Subscription
            const { rows: subs } = await pool.query(`
                SELECT s.*, p.name as "planName" 
                FROM subscriptions s 
                JOIN plans p ON s.planid = p.id 
                WHERE s.userid = $1 AND s.status = 'active' AND s.enddate > NOW()
            `, [candidateId]);

            if (subs.length === 0) return false; // No active sub/trial

            const planName = subs[0].planName.toLowerCase();
            if (planName.includes('monthly') || planName.includes('quarterly') || planName.includes('yearly')) return true;

            // 2. Free Trial Limit
            const { rows: calls } = await pool.query(`
                SELECT durationseconds as "durationSeconds"
                FROM call_history 
                WHERE (callerid = $1 OR calleeid = $1) 
                  AND status = 'completed'
                  AND startedat >= CURRENT_DATE
            `, [candidateId]);

            let totalSeconds = 0;
            calls.forEach(c => totalSeconds += (c.durationSeconds || 0));
            return totalSeconds < 300;
        };

        const friends = await Promise.all(friendsData.map(async (friend) => {
            const isCallEligible = await checkEligibility(friend.userId, friend.role);
            return { ...friend, isCallEligible };
        }));

        console.log(`[ConnectionsDebug] Responding with ${friends.length} friends. First friend has connectionId: ${friends[0]?.connectionId}`);

        res.json({
            success: true,
            data: {
                pendingRequests,
                sentRequests,
                friends
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    sendRequest,
    acceptRequest,
    rejectRequest,
    getConnections
};
