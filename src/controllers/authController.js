const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { verifyPassword, hashPassword } = require('../utils/passwordUtils');
const pool = require('../config/db');
const generateToken = require('../utils/generateToken');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

// @desc    Register a new user
// @route   POST /api/v1/auth/register
// @access  Public
const registerUser = async (req, res) => {
    console.log('📝 Registering user:', req.body.email);
    try {
        const { fullName: bodyFullName, name, email, password, role, phoneNumber, referralCode, couponCode } = req.body;
        const fullName = bodyFullName || name;

        if (!fullName) {
            return res.status(400).json({ message: 'Full name is required' });
        }

        const { rows: userExists } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (userExists.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Check for duplicate phone number
        if (phoneNumber) {
            const { rows: phoneExists } = await pool.query('SELECT * FROM users WHERE phoneNumber = $1', [phoneNumber]);
            if (phoneExists.length > 0) {
                return res.status(400).json({ message: 'Phone number already in use' });
            }
        }

        const hashedPassword = await hashPassword(password);

        // Normalize role
        const normalizedRole = role ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase() : 'User';
        const isAdmin = normalizedRole === 'Admin' || normalizedRole === 'SuperAdmin';

        // Generate a new, unique referral code for the new user
        // Do NOT use the referralCode from req.body (that's the one they used to sign up!)
        const newReferralCode = 'REF' + crypto.randomBytes(4).toString('hex').toUpperCase();

        // Determine Registration Source & Referrer
        let registrationMethod = 'organic';
        let registrationCode = null;
        let usedCouponCodeValue = null;
        let referrerNameValue = null;

        if (referralCode) {
            // Check if valid referral code
            const { rows: referrers } = await pool.query('SELECT * FROM users WHERE referralCode = $1', [referralCode]);
            if (referrers.length > 0) {
                registrationMethod = 'referral';
                registrationCode = referralCode;
                referrerNameValue = referrers[0].fullname; // Store referrer's name
            } else {
                // Invalid referral code - treat as organic or throw error?
                // Let's treat as organic but maybe warn? Or just ignore.
                // For now, if invalid, we just don't mark it as referral.
                console.log('Invalid referral code provided:', referralCode);
            }
        } else if (couponCode) {
            const upperCouponCode = couponCode.toUpperCase();
            // Validate Coupon
            const { rows: coupons } = await pool.query('SELECT * FROM coupons WHERE code = $1 AND status = \'Active\' AND (expiryDate IS NULL OR expiryDate > NOW())', [upperCouponCode]);
            if (coupons.length > 0) {
                registrationMethod = 'coupon';
                registrationCode = upperCouponCode;
                usedCouponCodeValue = upperCouponCode;
            } else {
                return res.status(400).json({ message: 'Invalid or expired coupon code' });
            }
        }

        // Insert User
        const { rows: result } = await pool.query(
            `INSERT INTO users (fullName, email, password, role, phoneNumber, isVerified, verificationToken, verificationTokenExpires, isApproved, referralCode, registrationMethod, registrationCode, usedCouponCode, referrerName) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
            [
                fullName,
                email,
                hashedPassword,
                normalizedRole,
                phoneNumber || null,
                isAdmin,
                isAdmin ? null : crypto.randomBytes(32).toString('hex'),
                isAdmin ? null : new Date(Date.now() + 24 * 60 * 60 * 1000),
                normalizedRole === 'User' || isAdmin ? true : false,
                newReferralCode, // Use the NEW generated code
                registrationMethod,
                registrationCode,
                usedCouponCodeValue,
                referrerNameValue
            ]
        );

        const userId = result[0].id;
        const { rows: newUser } = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

        // --- REMOVED: Automatic 24-hour Free Trial at Registration ---
        // Trial will now be granted at first login.

        // Send verification email
        if (!isAdmin) {
            try {
                // newUser[0] keys are lowercase in PG: email, fullname, verificationtoken
                console.log('📧 Calling sendVerificationEmail for:', newUser[0].email);
                await sendVerificationEmail(newUser[0].email, newUser[0].fullname, newUser[0].verificationtoken);
            } catch (emailError) {
                console.error('Failed to send verification email:', emailError);
            }
        }

        // --- ADDED: Referral Processing ---
        if (referralCode) {
            try {
                console.log(`🔗 Processing referral code: ${referralCode} for new user: ${email}`);

                // 1. Find referrer
                const { rows: referrers } = await pool.query('SELECT id, fullName as "fullName" FROM users WHERE referralCode = $1', [referralCode]);
                // Using alias here to keep it clean, but could use lowercase logic too.

                if (referrers.length > 0) {
                    const referrer = referrers[0];
                    console.log(`👤 Found referrer: ${referrer.fullName} (ID: ${referrer.id})`);

                    // 2. Fetch referral settings
                    const { rows: settingsRows } = await pool.query('SELECT * FROM settings WHERE setting_key LIKE \'referral_%\'');
                    const settings = {};
                    settingsRows.forEach(row => settings[row.setting_key] = row.setting_value);

                    const isActive = settings['referral_is_active'] === 'true';
                    const referrerReward = parseFloat(settings['referral_referrer_reward_amount'] || 0);
                    const refereeReward = parseFloat(settings['referral_referee_reward_amount'] || 0);

                    if (isActive) {
                        console.log(`🔗 Recording pending referral for ${fullName} (Referrer: ${referrer.fullName})`);

                        // 5. Record referral (PENDING - Reward on First Payment)
                        await pool.query(
                            'INSERT INTO referrals (referrerId, referredUserId, referralCode, status, rewardAmount) VALUES ($1, $2, $3, $4, $5)',
                            [referrer.id, userId, referralCode, 'pending', 0]
                        );
                        console.log('✅ Referral recorded as pending. Reward awaits first payment.');
                    }
                }
            } catch (referralError) {
                console.error('❌ Failed to process referral:', referralError.message);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Registration successful. Please check your email to verify your account.',
            data: {
                id: userId,
                fullName,
                email,
                role: role || 'User',
                isVerified: false
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Auth user & get token
// @route   POST /api/v1/auth/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        const { identifier: bodyIdentifier, email, password } = req.body;
        const identifier = bodyIdentifier || email;

        if (!identifier) {
            return res.status(400).json({ message: 'Email or identifier is required' });
        }

        // select * returns lowercase columns
        const { rows: users } = await pool.query('SELECT * FROM users WHERE email = $1', [identifier]);
        const user = users[0];

        if (!user) {
            console.log(`❌ Login attempt: User not found (${identifier})`);
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        console.log(`🔍 Attempting login for: ${identifier}`);
        const isPasswordCorrect = await verifyPassword(password, user.password);
        console.log(`🔑 Password verification: ${isPasswordCorrect ? '✅ SUCCESS' : '❌ FAILED'}`);

        if (isPasswordCorrect) {
            // Check if password needs upgrade (if it's not bcrypt)
            if (!user.password.startsWith('$2b$') && !user.password.startsWith('$2a$')) {
                console.log(`🔒 Upgrading legacy password for user: ${user.email}`);
                const newHashedPassword = await hashPassword(password);
                await pool.query('UPDATE users SET password = $1 WHERE id = $2', [newHashedPassword, user.id]);
                user.password = newHashedPassword; // Update local user object
            }
            const needsVerification = user.role === 'User' || user.role === 'Instructor';
            // uses lowercase access
            if (needsVerification && !user.isverified) {
                return res.status(401).json({
                    success: false,
                    message: 'Please verify your email before logging in.',
                    isUnverified: true
                });
            }

            // user.isapproved (lowercase)
            if (user.role === 'User' && !user.isapproved) {
                await pool.query('UPDATE users SET isApproved = TRUE WHERE id = $1', [user.id]);
                user.isapproved = true;
            }

            // --- ADDED: Automatic 24-hour Free Trial at First Login ---
            try {
                // Check if user already has or had a free trial
                const { rows: existingTrials } = await pool.query(
                    'SELECT s.* FROM subscriptions s JOIN plans p ON s.planId = p.id WHERE s.userId = $1 AND p.name = \'Free Trial\'',
                    [user.id]
                );

                if (existingTrials.length === 0) {
                    console.log(`🎁 Granting first-time free trial to user: ${user.email}`);

                    // 1. Get or create Trial Plan
                    let { rows: plans } = await pool.query('SELECT id FROM plans WHERE name = \'Free Trial\' LIMIT 1');
                    let planId;

                    if (plans.length === 0) {
                        const { rows: planResult } = await pool.query(
                            'INSERT INTO plans (name, description, price, billingCycle, trialDays) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                            ['Free Trial', '24-hour full access trial', 0, 'Free', 1]
                        );
                        planId = planResult[0].id;
                    } else {
                        planId = plans[0].id;
                    }

                    // 2. Create subscription starting NOW
                    const startDate = new Date();
                    const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

                    await pool.query(
                        `INSERT INTO subscriptions (userId, planId, status, startDate, endDate, paymentStatus) 
                         VALUES ($1, $2, $3, $4, $5, $6)`,
                        [user.id, planId, 'active', startDate, endDate, 'paid']
                    );
                    console.log(`✅ 24-hour trial activated for ${user.email} from login. Expires: ${endDate.toLocaleString()}`);
                }
            } catch (trialError) {
                console.error('❌ Failed to grant free trial at login:', trialError.message);
            }

            // Fetch final user data with subscription info (same logic as auth middleware)
            const { rows: userDataRows } = await pool.query(
                `SELECT 
                    u.id, 
                    u.fullname as "fullName", 
                    u.email, 
                    u.role, 
                    u.isapproved as "isApproved",
                    s.status as "subscriptionStatus",
                    p.name as "subscriptionPlan",
                    s.enddate as "trialEndDate"
                 FROM users u
                 LEFT JOIN LATERAL (
                    SELECT status, planid, enddate 
                    FROM subscriptions 
                    WHERE userid = u.id AND status = 'active' 
                    ORDER BY enddate DESC LIMIT 1
                 ) s ON true
                 LEFT JOIN plans p ON s.planid = p.id
                 WHERE u.id = $1`,
                [user.id]
            );
            const userData = userDataRows[0];

            res.json({
                success: true,
                data: {
                    ...userData,
                    token: generateToken(user.id, user.role),
                },
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get user profile
// @route   GET /api/v1/auth/profile
// @access  Private
const getProfile = async (req, res) => {
    res.json({
        success: true,
        data: req.user,
    });
};

// @desc    Forgot Password
// @route   POST /api/v1/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const { rows: users } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];
        const resetToken = crypto.randomBytes(20).toString('hex');
        const resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 Minutes

        await pool.query(
            'UPDATE users SET resetPasswordToken = $1, resetPasswordExpire = $2 WHERE id = $3',
            [resetPasswordToken, resetPasswordExpire, user.id]
        );

        const frontendUrl = process.env.FRONTEND_URL;
        const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}&userId=${user.id}`;

        try {
            await sendPasswordResetEmail(user.email, user.fullname || 'User', resetUrl);
            res.status(200).json({ success: true, message: 'Password reset email sent' });
        } catch (mailError) {
            console.error('Mail delivery failed:', mailError);
            console.log(`Fallback Link: ${resetUrl}`);
            res.status(500).json({ message: 'Error sending email, but token generated.' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};


// @desc    Reset Password
// @route   POST /api/v1/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
    try {
        const { userId, token, newPassword } = req.body;

        const resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');

        const { rows: users } = await pool.query(
            'SELECT * FROM users WHERE id = $1 AND resetPasswordToken = $2 AND resetPasswordExpire > NOW()',
            [userId, resetPasswordToken]
        );

        if (users.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        const user = users[0];
        const hashedPassword = await hashPassword(newPassword);

        await pool.query(
            'UPDATE users SET password = $1, resetPasswordToken = NULL, resetPasswordExpire = NULL WHERE id = $2',
            [hashedPassword, user.id]
        );

        res.status(200).json({ success: true, message: 'Password updated successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Verify Email
// @route   GET /api/v1/auth/verify-email
// @access  Public
const verifyEmail = async (req, res) => {
    try {
        const { token, email } = req.query;

        // 1. Try to find user by token
        const { rows: users } = await pool.query(
            'SELECT * FROM users WHERE verificationToken = $1 AND verificationTokenExpires > NOW()',
            [token]
        );

        if (users.length > 0) {
            const user = users[0];

            await pool.query(
                'UPDATE users SET isVerified = TRUE, verificationToken = NULL, verificationTokenExpires = NULL WHERE id = $1',
                [user.id]
            );

            return res.status(200).json({
                success: true,
                message: 'Email verified successfully'
            });
        }

        // 2. Check if already verified
        if (email) {
            const { rows: alreadyVerified } = await pool.query(
                'SELECT * FROM users WHERE email = $1 AND isVerified = TRUE',
                [email]
            );

            if (alreadyVerified.length > 0) {
                return res.status(200).json({
                    success: true,
                    message: 'Email already verified'
                });
            }
        }

        return res.status(400).json({
            success: false,
            message: 'Invalid or expired verification token'
        });

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ message: 'Server error during verification' });
    }
};

// @desc    Resend Verification Email
// @route   POST /api/v1/auth/resend-verification
// @access  Public
const resendVerification = async (req, res) => {
    try {
        const { email } = req.body;

        const { rows: users } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];

        if (user.isverified) {
            return res.status(400).json({ message: 'Email is already verified' });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await pool.query(
            'UPDATE users SET verificationToken = $1, verificationTokenExpires = $2 WHERE id = $3',
            [verificationToken, verificationTokenExpires, user.id]
        );

        await sendVerificationEmail(user.email, user.fullname, verificationToken);

        res.json({ success: true, message: 'Verification email resent' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Change Password (Authenticated)
// @route   PUT /api/v1/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        // 1. Get user from DB
        const { rows: users } = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        const user = users[0];

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 2. Verify current password
        const isMatch = await verifyPassword(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect current password' });
        }

        // 3. Hash new password
        const hashedPassword = await hashPassword(newPassword);

        // 4. Update password
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);

        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('❌ Change password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getProfile,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerification,
    changePassword
};
