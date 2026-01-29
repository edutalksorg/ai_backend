const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const generateToken = require('../utils/generateToken');

// @desc    Register a new user
// @route   POST /api/v1/auth/register
// @access  Public
const registerUser = async (req, res) => {
    try {
        const { fullName, email, password, role, phoneNumber } = req.body;

        const [userExists] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

        if (userExists.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const [result] = await pool.query(
            'INSERT INTO users (fullName, email, password, role, phoneNumber) VALUES (?, ?, ?, ?, ?)',
            [fullName, email, hashedPassword, role || 'User', phoneNumber || null]
        );

        const userId = result.insertId;

        res.status(201).json({
            success: true,
            data: {
                id: userId,
                fullName,
                email,
                role: role || 'User',
                token: generateToken(userId, role || 'User'),
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
        // Frontend URL should be in env or default localhost
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}&id=${user.id}`;

        // Log to console as requested for "fix"
        console.log(`Password Reset Link for ${user.email}: ${resetUrl}`);

        res.status(200).json({ success: true, message: 'Email sent (Logged to server console)' });

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

module.exports = {
    registerUser,
    loginUser,
    getProfile,
    forgotPassword,
    resetPassword
};
