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
        const { fullName, phoneNumber, bio, country } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Update users table with basic profile fields
        await pool.query(
            'UPDATE users SET fullName = ?, phoneNumber = ? WHERE id = ?',
            [fullName, phoneNumber, userId]
        );

        // If user is an instructor, update instructor_profiles table
        if (userRole === 'Instructor') {
            // Use INSERT ... ON DUPLICATE KEY UPDATE to handle both insert and update
            await pool.query(
                `INSERT INTO instructor_profiles (userId, bio, country) 
                 VALUES (?, ?, ?) 
                 ON DUPLICATE KEY UPDATE bio = VALUES(bio), country = VALUES(country)`,
                [userId, bio || null, country || null]
            );
        }

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
        const [users] = await pool.query(`
            SELECT u.id, u.fullName, u.email, u.phoneNumber, u.role, u.isApproved, u.avatarUrl, u.walletBalance, u.referralCode, u.createdAt,
                   s.status as subscriptionStatus, p.name as subscriptionPlan, s.endDate as trialEndDate,
                   ip.bio, ip.country
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.userId AND s.status = 'active'
            LEFT JOIN plans p ON s.planId = p.id
            LEFT JOIN instructor_profiles ip ON u.id = ip.userId
            WHERE u.id = ?
            ORDER BY s.endDate DESC LIMIT 1
        `, [userId]);

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