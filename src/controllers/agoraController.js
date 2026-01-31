const { generateAgoraToken } = require('../services/agoraService');

// @desc    Generate Agora token
// @route   GET /api/v1/calls/agora-token
// @access  Private
const getAgoraToken = async (req, res) => {
    try {
        const { channelName, uid: queryUid } = req.query;

        // Prefer UID from query params (sent by frontend), fallback to user ID
        let uid = queryUid || req.user.id;

        // Convert string UID to number if needed (Agora expects numeric UID)
        if (typeof uid === 'string' && !isNaN(uid)) {
            uid = parseInt(uid, 10);
        }

        if (!channelName) {
            console.error('[AgoraController] Missing channel name in token request');
            return res.status(400).json({ message: 'Channel name is required' });
        }

        console.log(`[AgoraController] Generating token for channel: ${channelName}, UID: ${uid}`);
        const token = generateAgoraToken(channelName, uid);
        console.log(`[AgoraController] Token generated successfully (length: ${token?.length})`);

        res.json({
            success: true,
            data: { token },
        });
    } catch (error) {
        console.error('[AgoraController] Error generating token:', error);
        res.status(500).json({ message: 'Failed to generate token' });
    }
};

module.exports = { getAgoraToken };
