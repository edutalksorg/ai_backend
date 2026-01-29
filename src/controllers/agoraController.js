const { generateAgoraToken } = require('../services/agoraService');

// @desc    Generate Agora token
// @route   GET /api/v1/agora/token
// @access  Private
const getAgoraToken = async (req, res) => {
    try {
        const { channelName } = req.query;
        const uid = req.user.id;

        if (!channelName) {
            return res.status(400).json({ message: 'Channel name is required' });
        }

        const token = generateAgoraToken(channelName, uid);

        res.json({
            success: true,
            data: { token },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to generate token' });
    }
};

module.exports = { getAgoraToken };
