const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const generateToken = require('../utils/generateToken');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

// @desc    Register a new user
// @route   POST /api/v1/auth/register
// @access  Public
const registerUser = async (req, res) => {
    console.log('📝 Registering user:', req.body.email);
    try {
        const { fullName, email, password, role, phoneNumber, referralCode } = req.body;

        const [userExists] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

        if (userExists.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Normalize role: Capitalize first letter (e.g., 'instructor' -> 'Instructor')
        const normalizedRole = role ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase() : 'User';

        const isAdmin = normalizedRole === 'Admin' || normalizedRole === 'SuperAdmin';

        const [result] = await pool.query(
            'INSERT INTO users (fullName, email, password, role, phoneNumber, isVerified, verificationToken, verificationTokenExpires, isApproved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                fullName,
                email,
                hashedPassword,
                normalizedRole,
                phoneNumber || null,
                isAdmin, // isVerified: Auto-verify Admins
                isAdmin ? null : crypto.randomBytes(32).toString('hex'), // token: None for Admins
                isAdmin ? null : new Date(Date.now() + 24 * 60 * 60 * 1000), // expires: None for Admins
                normalizedRole === 'User' || isAdmin ? 1 : 0 // isApproved: Auto-approve Users and Admins, but not Instructors
            ]
        );

        const userId = result.insertId;
        const [newUser] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);

        // --- ADDED: Automatic 24-hour Free Trial ---
        try {
            console.log(`🎁 Granting free trial to user: ${email}`);
            // 1. Get or create Trial Plan
            let [plans] = await pool.query('SELECT id FROM plans WHERE name = "Free Trial" LIMIT 1');
            let planId;

            if (plans.length === 0) {
                // Create one if it doesn't exist
                const [planResult] = await pool.query(
                    'INSERT INTO plans (name, description, price, billingCycle, trialDays) VALUES (?, ?, ?, ?, ?)',
                    ['Free Trial', '24-hour full access trial', 0, 'Free', 1]
                );
                planId = planResult.insertId;
                console.log('✅ Created "Free Trial" plan.');
            } else {
                planId = plans[0].id;
            }

            // 2. Create subscription
            const startDate = new Date();
            const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

            await pool.query(
                'INSERT INTO subscriptions (userId, planId, status, startDate, endDate, paymentStatus) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, planId, 'active', startDate, endDate, 'paid']
            );
            console.log(`✅ 24-hour trial activated for ${email}. Expires: ${endDate.toLocaleString()}`);
        } catch (trialError) {
            console.error('❌ Failed to grant free trial:', trialError.message);
        }

        // Send verification email (ONLY for Students and Instructors)
        if (!isAdmin) {
            try {
                console.log('📧 Calling sendVerificationEmail for:', newUser[0].email);
                await sendVerificationEmail(newUser[0].email, newUser[0].fullName, newUser[0].verificationToken);
            } catch (emailError) {
                console.error('Failed to send verification email:', emailError);
                // We still proceed with registration, user can resend later
            }
        }

        // --- ADDED: Referral Processing ---
        if (referralCode) {
            try {
                console.log(`🔗 Processing referral code: ${referralCode} for new user: ${email}`);

                // 1. Find referrer
                const [referrers] = await pool.query('SELECT id, fullName FROM users WHERE referralCode = ?', [referralCode]);

                if (referrers.length > 0) {
                    const referrer = referrers[0];
                    console.log(`👤 Found referrer: ${referrer.fullName} (ID: ${referrer.id})`);

                    // 2. Fetch referral settings
                    const [settingsRows] = await pool.query('SELECT * FROM settings WHERE setting_key LIKE "referral_%"');
                    const settings = {};
                    settingsRows.forEach(row => settings[row.setting_key] = row.setting_value);

                    const isActive = settings['referral_is_active'] === 'true';
                    const referrerReward = parseFloat(settings['referral_referrer_reward_amount'] || 0);
                    const refereeReward = parseFloat(settings['referral_referee_reward_amount'] || 0);

                    if (isActive) {
                        console.log(`💰 Applying rewards: Referrer +${referrerReward}, Referee +${refereeReward}`);

                        // 3. Update referrer's wallet
                        if (referrerReward > 0) {
                            await pool.query('UPDATE users SET walletBalance = walletBalance + ? WHERE id = ?', [referrerReward, referrer.id]);

                            // Log transaction for referrer
                            await pool.query(
                                'INSERT INTO transactions (userId, amount, type, status, description) VALUES (?, ?, ?, ?, ?)',
                                [referrer.id, referrerReward, 'credit', 'completed', `Referral reward for inviting ${fullName}`]
                            );
                        }

                        // 4. Update referee's wallet
                        if (refereeReward > 0) {
                            await pool.query('UPDATE users SET walletBalance = walletBalance + ? WHERE id = ?', [refereeReward, userId]);

                            // Log transaction for referee
                            await pool.query(
                                'INSERT INTO transactions (userId, amount, type, status, description) VALUES (?, ?, ?, ?, ?)',
                                [userId, refereeReward, 'credit', 'completed', `Referral bonus for joining via ${referrer.fullName}`]
                            );
                        }

                        // 5. Record referral
                        await pool.query(
                            'INSERT INTO referrals (referrerId, referredUserId, referralCode, status, rewardAmount) VALUES (?, ?, ?, ?, ?)',
                            [referrer.id, userId, referralCode, 'completed', referrerReward]
                        );

                        console.log('✅ Referral rewards applied successfully.');
                    } else {
                        console.log('⚠️ Referral system is currently inactive.');
                    }
                } else {
                    console.log('⚠️ Invalid referral code provided.');
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
        const { identifier, password } = req.body; // frontend sends identifier (email/username)

        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [identifier]);
        const user = users[0];

        if (user && (await bcrypt.compare(password, user.password))) {
            // Verification check: Only required for Students and Instructors
            const needsVerification = user.role === 'User' || user.role === 'Instructor';
            if (needsVerification && !user.isVerified) {
                return res.status(401).json({
                    success: false,
                    message: 'Please verify your email before logging in.',
                    isUnverified: true
                });
            }

            // Auto-approve 'User' role on successful email verification/login if not already approved
            if (user.role === 'User' && !user.isApproved) {
                await pool.query('UPDATE users SET isApproved = 1 WHERE id = ?', [user.id]);
                user.isApproved = 1;
            }

            res.json({
                success: true,
                data: {
                    id: user.id,
                    fullName: user.fullName,
                    email: user.email,
                    role: user.role,
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

// @desc    Forgot Password - generate token
// @route   POST /api/v1/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];

        // Generate Token
        const resetToken = crypto.randomBytes(20).toString('hex');

        // Hash token and set to resetPasswordToken field
        const resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 Minutes

        await pool.query(
            'UPDATE users SET resetPasswordToken = ?, resetPasswordExpire = ? WHERE id = ?',
            [resetPasswordToken, resetPasswordExpire, user.id]
        );

        // Construct Link
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}&userId=${user.id}`;

        // Send Email
        try {
            await sendPasswordResetEmail(user.email, user.fullName || 'User', resetUrl);
            res.status(200).json({ success: true, message: 'Password reset email sent' });
        } catch (mailError) {
            console.error('Mail delivery failed:', mailError);
            // Fallback for debugging if email fails
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
        const { userId, token, newPassword } = req.body; // Expect simplified flow or token in body
        // Note: Frontend might send token in query or body. Adjust as needed. 

        const resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');

        const [users] = await pool.query(
            'SELECT * FROM users WHERE id = ? AND resetPasswordToken = ? AND resetPasswordExpire > NOW()',
            [userId, resetPasswordToken]
        );

        if (users.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        const user = users[0];

        // Set new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await pool.query(
            'UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpire = NULL WHERE id = ?',
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
        const [users] = await pool.query(
            'SELECT * FROM users WHERE verificationToken = ? AND verificationTokenExpires > NOW()',
            [token]
        );

        if (users.length > 0) {
            const user = users[0];

            await pool.query(
                'UPDATE users SET isVerified = TRUE, verificationToken = NULL, verificationTokenExpires = NULL WHERE id = ?',
                [user.id]
            );

            return res.status(200).json({
                success: true,
                message: 'Email verified successfully'
            });
        }

        // 2. If token is invalid/not found, check if someone with this email is ALREADY verified
        // This handles cases where people click the link twice or React double-executes useEffect
        if (email) {
            const [alreadyVerified] = await pool.query(
                'SELECT * FROM users WHERE email = ? AND isVerified = TRUE',
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

        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];

        if (user.isVerified) {
            return res.status(400).json({ message: 'Email is already verified' });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await pool.query(
            'UPDATE users SET verificationToken = ?, verificationTokenExpires = ? WHERE id = ?',
            [verificationToken, verificationTokenExpires, user.id]
        );

        await sendVerificationEmail(user.email, user.fullName, verificationToken);

        res.json({ success: true, message: 'Verification email resent' });

    } catch (error) {
        console.error(error);
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
    resendVerification
};
