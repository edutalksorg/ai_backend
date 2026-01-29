const pool = require('../config/db');

// Helper to ensure code exists
const ensureReferralCode = async (userId) => {
    let [user] = await pool.query('SELECT referralCode FROM users WHERE id = ?', [userId]);
    let code = user[0]?.referralCode;

    if (!code) {
        code = 'REF' + userId + Math.random().toString(36).substring(7).toUpperCase();
        await pool.query('UPDATE users SET referralCode = ? WHERE id = ?', [code, userId]);
    }
    return code;
};

// @desc    Get user's referral code
// @route   GET /api/v1/referrals/my-code
// @access  Private
const getMyCode = async (req, res) => {
    try {
        const code = await ensureReferralCode(req.user.id);
        res.json({
            success: true,
            data: {
                referralCode: code,
                referralLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?ref=${code}`
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get referral stats
// @route   GET /api/v1/referrals/stats
// @access  Private
const getReferralStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const code = await ensureReferralCode(userId);

        const [referrals] = await pool.query('SELECT COUNT(*) as count FROM referrals WHERE referrerId = ?', [userId]);
        const [earnings] = await pool.query(
            'SELECT SUM(rewardAmount) as total FROM referrals WHERE referrerId = ? AND status = "completed"', // Assuming status
            [userId]
        );

        res.json({
            success: true,
            data: {
                referralCode: code,
                totalReferrals: referrals[0].count,
                totalEarnings: earnings[0].total || 0,
                referralLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?ref=${code}`
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get referral history
// @route   GET /api/v1/referrals/history
// @access  Private
const getReferralHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.pageSize) || 20; // Matches frontend 'pageSize' param
        const offset = (page - 1) * limit;

        const [rows] = await pool.query(`
            SELECT r.*, u.fullName as referredUserName, u.avatarUrl
            FROM referrals r
            JOIN users u ON r.referredUserId = u.id
            WHERE r.referrerId = ?
            ORDER BY r.createdAt DESC
            LIMIT ? OFFSET ?
        `, [userId, limit, offset]);

        const [total] = await pool.query('SELECT COUNT(*) as count FROM referrals WHERE referrerId = ?', [userId]);

        res.json({
            success: true,
            data: rows,
            pagination: {
                page,
                limit,
                total: total[0].count,
                pages: Math.ceil(total[0].count / limit)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Validate referral code
// @route   GET /api/v1/referrals/validate/:code
// @access  Public
const validateReferralCode = async (req, res) => {
    try {
        const { code } = req.params;
        const [users] = await pool.query('SELECT id, fullName FROM users WHERE referralCode = ?', [code]);

        if (users.length > 0) {
            res.json({
                success: true,
                valid: true,
                referrerName: users[0].fullName
            });
        } else {
            res.json({
                success: true,
                valid: false
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getReferralStats,
    getMyCode,
    getReferralHistory,
    validateReferralCode
};
