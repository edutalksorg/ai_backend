const pool = require('../config/db');

// Helper to ensure code exists
const ensureReferralCode = async (userId) => {
    // Postgres stores unquoted identifiers as lowercase
    let { rows: user } = await pool.query('SELECT referralCode as "referralCode" FROM users WHERE id = $1', [userId]);
    let code = user[0]?.referralCode;

    if (!code) {
        code = 'REF' + userId + Math.random().toString(36).substring(7).toUpperCase();
        // Update column referralcode
        await pool.query('UPDATE users SET referralCode = $1 WHERE id = $2', [code, userId]);
    }
    return code;
};

// @desc    Get user's referral code
// @route   GET /api/v1/referrals/my-code
// @access  Private
const getMyCode = async (req, res) => {
    try {
        const code = await ensureReferralCode(req.user.id);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.json({
            success: true,
            data: {
                referralCode: code,
                referralLink: `${frontendUrl}/register?ref=${code}`,
                code: code,
                shareableUrl: `${frontendUrl}/register?ref=${code}`
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

        const { rows: referrals } = await pool.query('SELECT COUNT(*) as count FROM referrals WHERE referrerId = $1', [userId]);
        const { rows: earnings } = await pool.query(
            'SELECT SUM(rewardAmount) as total FROM referrals WHERE referrerId = $1 AND status = \'completed\'',
            [userId]
        );

        res.json({
            success: true,
            data: {
                referralCode: code,
                totalReferrals: parseInt(referrals[0].count),
                totalEarnings: parseFloat(earnings[0].total || 0),
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
        const limit = parseInt(req.query.pageSize) || 20;
        const offset = (page - 1) * limit;

        // Alias necessary columns from join
        // referredUserId -> referreduserid
        // referrerId -> referrerid
        const { rows } = await pool.query(`
            SELECT r.id, r.referrerid as "referrerId", r.referreduserid as "referredUserId", r.referralcode as "referralCode", 
                   r.status, r.rewardamount as "rewardAmount", r.createdat as "createdAt",
                   u.fullname as "refereeName", u.avatarurl as "avatarUrl"
            FROM referrals r
            JOIN users u ON r.referreduserid = u.id
            WHERE r.referrerid = $1
            ORDER BY r.createdat DESC
            LIMIT $2 OFFSET $3
        `, [userId, limit, offset]);

        const { rows: total } = await pool.query('SELECT COUNT(*) as count FROM referrals WHERE referrerid = $1', [userId]);

        res.json({
            success: true,
            data: rows,
            pagination: {
                page,
                limit,
                total: parseInt(total[0].count),
                pages: Math.ceil(parseInt(total[0].count) / limit)
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
        const { rows: users } = await pool.query('SELECT id, fullname as "fullName" FROM users WHERE referralcode = $1', [code]);

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

const SETTINGS_MAP = {
    referrerRewardAmount: 'referral_referrer_reward_amount',
    refereeRewardAmount: 'referral_referee_reward_amount',
    refereeDiscountPercentage: 'referral_referee_discount_percentage',
    currency: 'referral_currency',
    bonusTier1Count: 'referral_bonus_tier1_count',
    bonusTier1Amount: 'referral_bonus_tier1_amount',
    bonusTier2Count: 'referral_bonus_tier2_count',
    bonusTier2Amount: 'referral_bonus_tier2_amount',
    bonusTier3Count: 'referral_bonus_tier3_count',
    bonusTier3Amount: 'referral_bonus_tier3_amount',
    requireEmailVerification: 'referral_require_email_verification',
    requireFirstPayment: 'referral_require_first_payment',
    rewardPendingPeriodHours: 'referral_reward_pending_period_hours',
    referralExpiryDays: 'referral_expiry_days',
    maxReferralsPerDay: 'referral_max_referrals_per_day',
    maxReferralsPerMonth: 'referral_max_referrals_per_month',
    enableIpTracking: 'referral_enable_ip_tracking',
    enableDeviceFingerprinting: 'referral_enable_device_fingerprinting',
    isActive: 'referral_is_active',
    allowTrialCompletionReward: 'referral_allow_trial_completion_reward',
    trialCompletionRewardMultiplier: 'referral_trial_completion_reward_multiplier'
};

// @desc    Get referral settings (Admin)
// @route   GET /api/v1/admin/referrals/settings
// @access  Private (Admin)
const getReferralSettings = async (req, res) => {
    try {
        // Postgres LIKE 'pattern'
        const { rows } = await pool.query('SELECT * FROM settings WHERE setting_key LIKE \'referral_%\'');

        const dbSettings = {};
        rows.forEach(row => {
            dbSettings[row.setting_key] = row.setting_value;
        });

        const responseData = {};

        for (const [feKey, dbKey] of Object.entries(SETTINGS_MAP)) {
            const value = dbSettings[dbKey];

            if (['isActive', 'requireEmailVerification', 'requireFirstPayment', 'enableIpTracking', 'enableDeviceFingerprinting', 'allowTrialCompletionReward'].includes(feKey)) {
                responseData[feKey] = value === 'true';
            }
            else if (['currency'].includes(feKey)) {
                responseData[feKey] = value || 'INR';
            }
            else {
                responseData[feKey] = parseFloat(value || 0);
            }
        }

        res.json({ success: true, data: responseData });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update referral settings (Admin)
// @route   PUT /api/v1/admin/referrals/settings
// @access  Private (Admin)
const updateReferralSettings = async (req, res) => {
    try {
        const updates = req.body;
        const queries = [];

        for (const [feKey, dbKey] of Object.entries(SETTINGS_MAP)) {
            if (updates[feKey] !== undefined) {
                const value = String(updates[feKey]);
                // Postgres UPSERT: ON CONFLICT ... DO UPDATE
                queries.push(
                    pool.query(
                        `INSERT INTO settings (setting_key, setting_value) VALUES ($1, $2) 
                         ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
                        [dbKey, value]
                    )
                );
            }
        }

        if (queries.length === 0) {
            return res.status(400).json({ message: 'No valid settings provided to update' });
        }

        await Promise.all(queries);

        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getReferralStats,
    getMyCode,
    getReferralHistory,
    validateReferralCode,
    getReferralSettings,
    updateReferralSettings
};
