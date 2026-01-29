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

// @desc    Get user profile
// @route   GET /api/v1/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const [users] = await pool.query('SELECT id, fullName, email, phoneNumber, role, isApproved, avatarUrl, walletBalance, referralCode, createdAt FROM users WHERE id = ?', [userId]);

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ success: true, data: users[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getProgressSummary,
    updateProfile,
    getUserProfile,
};