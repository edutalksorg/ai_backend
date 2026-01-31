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
                referralLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?ref=${code}`,
                code: code, // Alias for frontend
                shareableUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?ref=${code}` // Alias for frontend
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
        const limit = parseInt(req.query.pageSize) || 20; // Matches frontend 'pageSize' param
        const offset = (page - 1) * limit;

        const [rows] = await pool.query(`
            SELECT r.*, u.fullName as refereeName, u.avatarUrl
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

// Mappings between Frontend keys and DB keys
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
        const [rows] = await pool.query('SELECT * FROM settings WHERE setting_key LIKE "referral_%"');
        console.log(`[DEBUG] Fetched ${rows.length} settings from DB`);

        const dbSettings = {};
        rows.forEach(row => {
            dbSettings[row.setting_key] = row.setting_value;
        });

        const responseData = {};

        // Map DB keys back to frontend keys with type conversion
        for (const [feKey, dbKey] of Object.entries(SETTINGS_MAP)) {
            const value = dbSettings[dbKey];

            // Handle booleans
            if (['isActive', 'requireEmailVerification', 'requireFirstPayment', 'enableIpTracking', 'enableDeviceFingerprinting', 'allowTrialCompletionReward'].includes(feKey)) {
                responseData[feKey] = value === 'true';
            }
            // Handle numbers
            else if (['currency'].includes(feKey)) {
                responseData[feKey] = value || 'INR';
            }
            else {
                responseData[feKey] = parseFloat(value || 0);
            }
        }

        console.log('[DEBUG] Sending settings to frontend:', responseData);
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
        console.log('[DEBUG] Received settings update:', updates);

        // Validation: Ensure basic rewards are set
        if (!updates.referrerRewardAmount && updates.referrerRewardAmount !== 0) {
            console.warn('[DEBUG] Missing referrerRewardAmount in payload');
        }

        const queries = [];

        for (const [feKey, dbKey] of Object.entries(SETTINGS_MAP)) {
            if (updates[feKey] !== undefined) {
                const value = String(updates[feKey]); // Store everything as string
                console.log(`[DEBUG] Saving ${feKey} -> ${dbKey}: ${value}`);
                queries.push(
                    pool.query('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', [dbKey, value, value])
                );
            }
        }

        if (queries.length === 0) {
            return res.status(400).json({ message: 'No valid settings provided to update' });
        }

        await Promise.all(queries);
        console.log('[DEBUG] Settings saved successfully');

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
