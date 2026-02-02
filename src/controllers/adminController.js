const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendVerificationEmail } = require('../services/emailService');


// @desc    Get all users (Admin/SuperAdmin)
// @route   GET /api/v1/users
// @access  Private (Admin/SuperAdmin)
const getAllUsers = async (req, res) => {
    try {
        const query = `
            SELECT 
                u.id, 
                u.fullName, 
                u.email, 
                u.phoneNumber, 
                u.role, 
                u.isApproved, 
                u.createdAt,
                s.status as subscriptionStatus,
                p.name as planName
            FROM users u
            LEFT JOIN (
                SELECT userId, status, planId
                FROM (
                    SELECT userId, status, planId, ROW_NUMBER() OVER (PARTITION BY userId ORDER BY createdAt DESC) as rn
                    FROM subscriptions
                ) t
                WHERE rn = 1
            ) s ON u.id = s.userId
            LEFT JOIN plans p ON s.planId = p.id
        `;
        const [users] = await pool.query(query);
        res.json({
            success: true,
            data: users,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Create a new user (Admin/SuperAdmin)
// @route   POST /api/v1/users
// @access  Private (Admin/SuperAdmin)
const createUser = async (req, res) => {
    try {
        const { fullName, email, password, role, phoneNumber } = req.body;
        console.log(`[DEBUG] createUser called with:`, { fullName, email, role, phoneNumber });

        // Check if user exists
        const [userExists] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (userExists.length > 0) {
            console.log(`[DEBUG] createUser failed: User already exists (${email})`);
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Normalize role: Capitalize first letter (e.g., 'instructor' -> 'Instructor')
        const normalizedRole = role ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase() : 'User';

        // Instructors created by admin need email verification
        let isVerified = 1;
        let verificationToken = null;
        let verificationTokenExpires = null;

        if (normalizedRole === 'Instructor') {
            console.log(`[DEBUG] Instructor role detected. Requiring email verification.`);
            isVerified = 0;
            verificationToken = crypto.randomBytes(32).toString('hex');
            verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        }

        const [result] = await pool.query(
            'INSERT INTO users (fullName, email, password, role, phoneNumber, isApproved, isVerified, verificationToken, verificationTokenExpires) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                fullName,
                email,
                hashedPassword,
                normalizedRole,
                phoneNumber,
                1, // isApproved: Auto-approve if created by admin
                isVerified,
                verificationToken,
                verificationTokenExpires
            ]
        );
        console.log(`[DEBUG] User inserted successfully. ID: ${result.insertId}, Role: ${normalizedRole}, isVerified: ${isVerified}`);

        // Send verification email ONLY for Instructors
        if (normalizedRole === 'Instructor') {
            try {
                console.log('📧 Admin sending verification email to instructor:', email);
                await sendVerificationEmail(email, fullName, verificationToken);
            } catch (emailError) {
                console.error('Failed to send verification email to instructor:', emailError);
                // We still proceed as the user is created, but log the error
            }
        }

        res.status(201).json({
            success: true,
            data: {
                id: result.insertId,
                fullName,
                email,
                role,
                phoneNumber,
                isVerified: !!isVerified
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Approve instructor (Admin/SuperAdmin)
// @route   POST /api/v1/admin/instructors/:id/review
// @access  Private (Admin/SuperAdmin)
const reviewInstructor = async (req, res) => {
    try {
        const { approve } = req.body;
        const userId = req.params.id;

        await pool.query('UPDATE users SET isApproved = ? WHERE id = ? AND role = "Instructor"', [approve, userId]);

        res.json({
            success: true,
            message: `Instructor ${approve ? 'approved' : 'rejected'} successfully`,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get dashboard analytics (SuperAdmin/Admin)
// @route   GET /api/v1/admin/analytics/dashboard
// @access  Private (SuperAdmin/Admin)
// @desc    Get dashboard analytics (SuperAdmin/Admin)
// @route   GET /api/v1/admin/analytics/dashboard
// @access  Private (SuperAdmin/Admin)
const getDashboardStats = async (req, res) => {
    try {
        const [userCount] = await pool.query('SELECT COUNT(*) as count FROM users');
        const [revenue] = await pool.query('SELECT SUM(amount) as total, COUNT(*) as count FROM transactions WHERE status = "completed"');
        const [activeSubs] = await pool.query('SELECT COUNT(*) as count FROM subscriptions WHERE status = "active"');

        // 1. User Growth (Last 6 months)
        const [userGrowth] = await pool.query(`
            SELECT DATE_FORMAT(createdAt, '%Y-%m') as date, COUNT(*) as count 
            FROM users 
            WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH) 
            GROUP BY date 
            ORDER BY date ASC
        `);

        // 2. Revenue Trend (Last 6 months)
        const [revenueTrend] = await pool.query(`
            SELECT DATE_FORMAT(createdAt, '%Y-%m') as date, SUM(amount) as amount 
            FROM transactions 
            WHERE status = 'completed' AND createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH) 
            GROUP BY date 
            ORDER BY date ASC
        `);

        // 3. User Role Distribution
        const [roleDist] = await pool.query('SELECT role, COUNT(*) as value FROM users GROUP BY role');

        // 4. Top Topics (Mocked if no usage table, or count from topics table)
        // If we don't have usage analytics, we can just return top topics by ID or random for demo,
        // OR better: Return topics count by category or simply the first 5 topics.
        // Let's assume we want to show 'Topics' distribution.
        const [topics] = await pool.query('SELECT title as topic, id as count FROM topics LIMIT 5');
        // Note: The above is a placeholder. Real 'Top Topics' needs ‘user_progress’ aggregation.
        // If topics table is empty, this returns empty.

        res.json({
            success: true,
            data: {
                totalUsers: userCount[0].count,
                activeUsers: activeSubs[0].count, // Mapping active subscriptions to active users
                totalRevenue: parseFloat(revenue[0].total || 0),
                totalTransactions: revenue[0].count,
                userGrowth: userGrowth.length ? userGrowth : [],
                revenueTrend: revenueTrend.length ? revenueTrend : [],
                topTopics: topics.length ? topics.map(t => ({ topic: t.topic, count: 10 })) : [], // Mock count if no real analytics
                userRoleDistribution: roleDist,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// --- Coupon Management ---

// @desc    Get all coupons
// @route   GET /api/v1/admin/coupons
// @access  Private (Admin/SuperAdmin)
const getAllCoupons = async (req, res) => {
    try {
        const [coupons] = await pool.query('SELECT * FROM coupons ORDER BY createdAt DESC');
        res.json({ success: true, data: coupons });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Create a new coupon
// @route   POST /api/v1/coupons
// @access  Private (Admin/SuperAdmin)
const createCoupon = async (req, res) => {
    try {
        const { code, description, discountType, discountValue, expiryDate, status, applicableTo, maxTotalUsage, maxUsagePerUser, maxDiscountAmount, minimumPurchaseAmount } = req.body;

        // Ensure date is formatted for MySQL (YYYY-MM-DD HH:MM:SS)
        const formattedDate = expiryDate ? new Date(expiryDate).toISOString().slice(0, 19).replace('T', ' ') : null;

        const [result] = await pool.query(
            'INSERT INTO coupons (code, description, discountType, discountValue, expiryDate, status, applicableTo, maxTotalUsage, maxUsagePerUser, maxDiscountAmount, minimumPurchaseAmount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [code, description, discountType, discountValue, formattedDate, status || 'Active', applicableTo || 'AllSubscriptions', maxTotalUsage || 1000, maxUsagePerUser || 1, maxDiscountAmount || 0, minimumPurchaseAmount || 0]
        );

        res.status(201).json({ success: true, data: { id: result.insertId, code } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.sqlMessage || error.message });
    }
};

// @desc    Update a coupon
// @route   PUT /api/v1/coupons/:id
// @access  Private (Admin/SuperAdmin)
const updateCoupon = async (req, res) => {
    try {
        const { code, description, discountType, discountValue, expiryDate, status, applicableTo, maxTotalUsage, maxUsagePerUser, maxDiscountAmount, minimumPurchaseAmount } = req.body;
        const couponId = req.params.id;

        // Ensure date is formatted for MySQL (YYYY-MM-DD HH:MM:SS)
        const formattedDate = expiryDate ? new Date(expiryDate).toISOString().slice(0, 19).replace('T', ' ') : null;

        await pool.query(
            'UPDATE coupons SET code=?, description=?, discountType=?, discountValue=?, expiryDate=?, status=?, applicableTo=?, maxTotalUsage=?, maxUsagePerUser=?, maxDiscountAmount=?, minimumPurchaseAmount=? WHERE id=?',
            [code, description, discountType, discountValue, formattedDate, status, applicableTo, maxTotalUsage, maxUsagePerUser, maxDiscountAmount || 0, minimumPurchaseAmount || 0, couponId]
        );

        res.json({ success: true, message: 'Coupon updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.sqlMessage || error.message });
    }
};

// @desc    Delete a coupon
// @route   DELETE /api/v1/coupons/:id
// @access  Private (Admin/SuperAdmin)
const deleteCoupon = async (req, res) => {
    try {
        await pool.query('DELETE FROM coupons WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Coupon deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete a user (SuperAdmin only)
// @route   DELETE /api/v1/users/:id
// @access  Private (SuperAdmin)
const deleteUser = async (req, res) => {
    let connection;
    try {
        const userId = req.params.id;
        const requestingUserId = req.user.id;

        // Prevent self-deletion
        if (parseInt(userId) === requestingUserId) {
            return res.status(400).json({ message: 'Cannot delete your own account' });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Check if user exists
        const [users] = await connection.query('SELECT id, fullName, role FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'User not found' });
        }

        // 1. Delete dependent relations (Cascading Delete Manually)
        // Referrals (Fix: Include referredUserId)
        await connection.query('DELETE FROM referrals WHERE referrerId = ? OR referredUserId = ?', [userId, userId]);

        // Call History
        await connection.query('DELETE FROM call_history WHERE callerId = ? OR calleeId = ?', [userId, userId]);

        // Topics (Fix: specific for Instructors)
        await connection.query('DELETE FROM topics WHERE instructorId = ?', [userId]);

        // Transactions
        await connection.query('DELETE FROM transactions WHERE userId = ?', [userId]);

        // Subscriptions
        await connection.query('DELETE FROM subscriptions WHERE userId = ?', [userId]);

        // Coupon Usages
        await connection.query('DELETE FROM coupon_usages WHERE userId = ?', [userId]);

        // Wallet (Removed: walletBalance is on users table)
        // await connection.query('DELETE FROM wallet WHERE userId = ?', [userId]);

        // Notifications (if table exists, nice to have, wrap in try/catch if unsure but assuming typical schema)
        try {
            await connection.query('DELETE FROM notifications WHERE userId = ?', [userId]);
        } catch (e) {
            // Ignore if table doesn't exist
        }

        // 2. Delete the user
        await connection.query('DELETE FROM users WHERE id = ?', [userId]);

        await connection.commit();

        res.json({
            success: true,
            message: `User ${users[0].fullName} deleted successfully`,
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    } finally {
        if (connection) connection.release();
    }
};

// @desc    Update a user (Admin/SuperAdmin)
// @route   PUT /api/v1/users/:id
// @access  Private (Admin/SuperAdmin)
const updateUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const { fullName, email, role, phoneNumber, password, isActive } = req.body;

        // Build update query dynamically
        let updates = [];
        let values = [];

        if (fullName) { updates.push('fullName = ?'); values.push(fullName); }
        if (email) { updates.push('email = ?'); values.push(email); }
        if (role) { updates.push('role = ?'); values.push(role); }
        if (phoneNumber) { updates.push('phoneNumber = ?'); values.push(phoneNumber); }
        if (typeof isActive !== 'undefined') { updates.push('isActive = ?'); values.push(isActive); }

        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            updates.push('password = ?');
            values.push(hashedPassword);
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'No fields to update' });
        }

        values.push(userId);

        await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

        // Fetch updated user
        const [users] = await pool.query('SELECT id, fullName, email, role, phoneNumber, isApproved FROM users WHERE id = ?', [userId]);

        res.json({
            success: true,
            data: users[0],
            message: 'User updated successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Validate a coupon code
// @route   POST /api/v1/coupons/validate
// @access  Private (Authenticated users)
const validateCoupon = async (req, res) => {
    try {
        const { code, couponCode, purchaseAmount, amount, planId } = req.body;
        const userId = req.user.id;
        const actualCode = code || couponCode;
        const actualAmount = purchaseAmount || amount;

        if (!actualCode) {
            return res.status(400).json({ message: 'Coupon code is required' });
        }

        // 1. Find the coupon
        const [coupons] = await pool.query('SELECT * FROM coupons WHERE code = ?', [actualCode]);
        if (coupons.length === 0) {
            return res.status(404).json({ message: 'Invalid coupon code' });
        }

        const coupon = coupons[0];

        // 2. Check if active
        if (coupon.status !== 'Active') {
            return res.status(400).json({ message: 'This coupon is inactive or expired' });
        }

        // 3. Check expiration date
        if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
            return res.status(400).json({ message: 'This coupon has expired' });
        }

        // 4. Check global usage limit
        if (coupon.maxTotalUsage !== null) {
            const [usageCount] = await pool.query('SELECT COUNT(*) as count FROM coupon_usages WHERE couponId = ?', [coupon.id]);
            if (usageCount[0].count >= coupon.maxTotalUsage) {
                return res.status(400).json({ message: 'This coupon has reached its maximum usage limit' });
            }
        }

        // 5. Check per-user usage limit
        if (coupon.maxUsagePerUser !== null) {
            const [userUsage] = await pool.query('SELECT COUNT(*) as count FROM coupon_usages WHERE couponId = ? AND userId = ?', [coupon.id, userId]);
            if (userUsage[0].count >= coupon.maxUsagePerUser) {
                return res.status(400).json({ message: 'You have already used this coupon the maximum allowed times' });
            }
        }

        // 6. Check applicable plan (if specific) or minimum purchase amount
        if (coupon.minimumPurchaseAmount && actualAmount && actualAmount < coupon.minimumPurchaseAmount) {
            return res.status(400).json({ message: `Minimum purchase amount of ${coupon.minimumPurchaseAmount} required` });
        }

        // Calculate discount
        let discount = 0;
        if (coupon.discountType === 'percentage') {
            discount = (actualAmount * coupon.discountValue) / 100;
            if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
                discount = coupon.maxDiscountAmount;
            }
        } else {
            discount = coupon.discountValue;
        }

        // Ensure discount doesn't exceed purchase amount
        if (discount > actualAmount) {
            discount = actualAmount;
        }

        res.json({
            success: true,
            data: {
                id: coupon.id,
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                calculatedDiscount: discount,
                finalPrice: actualAmount - discount
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};


// @desc    Resend Verification Email (Admin)
// @route   POST /api/v1/admin/resend-verification
// @access  Admin only
const resendVerificationEmail = async (req, res) => {
    try {
        const { userId } = req.body;

        const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const user = users[0];

        if (user.isVerified) {
            return res.status(400).json({ success: false, message: 'User is already verified' });
        }

        // Generate new verification token if needed
        let verificationToken = user.verificationToken;
        if (!verificationToken) {
            verificationToken = crypto.randomBytes(32).toString('hex');
            const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

            await pool.query(
                'UPDATE users SET verificationToken = ?, verificationTokenExpires = ? WHERE id = ?',
                [verificationToken, verificationTokenExpires, userId]
            );
        }

        // Send verification email
        console.log('📧 Admin resending verification email to:', user.email);
        await sendVerificationEmail(user.email, user.fullName, verificationToken);

        res.status(200).json({
            success: true,
            message: 'Verification email resent successfully',
            emailSentTo: user.email
        });
    } catch (error) {
        console.error('[DEBUG] resendVerificationEmail error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resend verification email',
            error: error.message
        });
    }
};

module.exports = {
    getAllUsers,
    reviewInstructor,
    getDashboardStats,
    getAllCoupons,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    createUser,
    deleteUser,
    updateUser,
    validateCoupon,
    resendVerificationEmail
};
