const pool = require('../config/db');

// @desc    Get user dashboard stats
// @route   GET /api/v1/users/progress/summary
// @access  Private
const getProgressSummary = async (req, res) => {
    try {
        const userId = req.user.id;

        const [completed] = await pool.query(
            'SELECT COUNT(*) as count FROM user_progress WHERE userId = ? AND status = "completed"',
            [userId]
        );

        const [inProgress] = await pool.query(
            'SELECT COUNT(*) as count FROM user_progress WHERE userId = ? AND status = "in_progress"',
            [userId]
        );

        res.json({
            success: true,
            data: {
                completedTopics: completed[0].count,
                activeTopics: inProgress[0].count,
                points: completed[0].count * 10,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update user profile
// @route   PUT /api/v1/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
    try {
        const { fullName, phoneNumber } = req.body;
        const userId = req.user.id;

        await pool.query(
            'UPDATE users SET fullName = ?, phoneNumber = ? WHERE id = ?',
            [fullName, phoneNumber, userId]
        );

        res.json({
            success: true,
            message: 'Profile updated successfully',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getProgressSummary,
    updateProfile,
};
