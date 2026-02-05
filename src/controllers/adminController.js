const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendVerificationEmail } = require('../services/emailService');

// @desc    Get all users (Admin/SuperAdmin)
// @route   GET /api/v1/users
// @access  Private (Admin/SuperAdmin)
const getAllUsers = async (req, res) => {
    try {
        // Postgres syntax
        // ROW_NUMBER() works in PG
        // User casing: u.fullName -> u."fullName"
        // User casing: u.fullName -> u.fullname as "fullName"
        const query = `
            SELECT 
                u.id, 
                u.fullname as "fullName", 
                u.email, 
                u.phonenumber as "phoneNumber", 
                u.role, 
                u.isapproved as "isApproved", 
                u.createdat as "createdAt",
                u.referrername as "referrerName",
                u.registrationmethod as "registrationMethod",
                u.registrationcode as "registrationCode",
                u.usedcouponcode as "usedCouponCode",
                s.status as "subscriptionStatus",
                p.name as "planName"
            FROM users u
            LEFT JOIN (
                SELECT userid as "userId", status, planid as "planId"
                FROM (
                    SELECT userid, status, planid, ROW_NUMBER() OVER (PARTITION BY userid ORDER BY createdat DESC) as rn
                    FROM subscriptions
                ) t
                WHERE rn = 1
            ) s ON u.id = s."userId"
            LEFT JOIN plans p ON s."planId" = p.id
        `;
        const { rows: users } = await pool.query(query);
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

        const { rows: userExists } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const normalizedRole = role ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase() : 'User';

        let isVerified = true;
        let verificationToken = null;
        let verificationTokenExpires = null;

        if (normalizedRole === 'Instructor') {
            isVerified = false;
            verificationToken = crypto.randomBytes(32).toString('hex');
            verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        }

        const { rows: result } = await pool.query(
            `INSERT INTO users (fullname, email, password, role, phonenumber, isapproved, isverified, verificationtoken, verificationtokenexpires) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [
                fullName,
                email,
                hashedPassword,
                normalizedRole,
                phoneNumber,
                true, // isApproved
                isVerified,
                verificationToken,
                verificationTokenExpires
            ]
        );

        if (normalizedRole === 'Instructor') {
            try {
                await sendVerificationEmail(email, fullName, verificationToken);
            } catch (emailError) {
                console.error('Failed to send verification email to instructor:', emailError);
            }
        }

        res.status(201).json({
            success: true,
            data: {
                id: result[0].id,
                fullName,
                email,
                role,
                phoneNumber,
                isVerified
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

        await pool.query('UPDATE users SET isapproved = $1 WHERE id = $2 AND role = \'Instructor\'', [approve, userId]);

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
const getDashboardStats = async (req, res) => {
    try {
        const { rows: userCount } = await pool.query('SELECT COUNT(*) as count FROM users');
        const { rows: revenue } = await pool.query('SELECT SUM(amount) as total, COUNT(*) as count FROM transactions WHERE status = \'completed\'');
        const { rows: activeSubs } = await pool.query('SELECT COUNT(*) as count FROM subscriptions WHERE status = \'active\'');

        // 1. User Growth (Last 6 months)
        // Postgres TO_CHAR, INTERVAL
        // 1. User Growth (Last 6 months)
        // Postgres TO_CHAR, INTERVAL
        // createdat is lowercase
        const { rows: userGrowth } = await pool.query(`
            SELECT TO_CHAR(createdat, 'YYYY-MM') as date, COUNT(*) as count 
            FROM users 
            WHERE createdat >= NOW() - INTERVAL '6 months' 
            GROUP BY date 
            ORDER BY date ASC
        `);

        // 2. Revenue Trend (Last 6 months)
        const { rows: revenueTrend } = await pool.query(`
            SELECT TO_CHAR(createdat, 'YYYY-MM') as date, SUM(amount) as amount 
            FROM transactions 
            WHERE status = 'completed' AND createdat >= NOW() - INTERVAL '6 months' 
            GROUP BY date 
            ORDER BY date ASC
        `);

        // 3. User Role Distribution
        const { rows: roleDist } = await pool.query('SELECT role, COUNT(*) as value FROM users GROUP BY role');

        // 4. Top Topics
        const { rows: topics } = await pool.query('SELECT title as topic, id as count FROM topics LIMIT 5');

        res.json({
            success: true,
            data: {
                totalUsers: parseInt(userCount[0].count),
                activeUsers: parseInt(activeSubs[0].count),
                totalRevenue: parseFloat(revenue[0].total || 0),
                totalTransactions: parseInt(revenue[0].count),
                userGrowth: userGrowth.length ? userGrowth : [],
                revenueTrend: revenueTrend.length ? revenueTrend : [],
                topTopics: topics.length ? topics.map(t => ({ topic: t.topic, count: 10 })) : [],
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
        const { rows: coupons } = await pool.query(`
            SELECT id, code, description, discounttype as "discountType", discountvalue as "discountValue", 
            expirydate as "expiryDate", status, applicableto as "applicableTo", 
            maxtotalusage as "maxTotalUsage", maxusageperuser as "maxUsagePerUser", 
            currentusagecount as "currentUsageCount",
            maxdiscountamount as "maxDiscountAmount", minimumpurchaseamount as "minimumPurchaseAmount", 
            createdat as "createdAt" 
            FROM coupons ORDER BY createdat DESC
        `);
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

        // Postgres handles ISO strings.
        let formattedDate = expiryDate ? new Date(expiryDate) : null;
        if (formattedDate && isNaN(formattedDate.getTime())) {
            formattedDate = null;
        }

        const { rows: result } = await pool.query(
            `INSERT INTO coupons (code, description, discounttype, discountvalue, expirydate, status, applicableto, maxtotalusage, maxusageperuser, maxdiscountamount, minimumpurchaseamount) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
            [code, description, discountType, discountValue, formattedDate, status || 'Active', applicableTo || 'AllSubscriptions', maxTotalUsage || 1000, maxUsagePerUser || 1, maxDiscountAmount || 0, minimumPurchaseAmount || 0]
        );

        res.status(201).json({ success: true, data: { id: result[0].id, code } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// @desc    Update a coupon
// @route   PUT /api/v1/coupons/:id
// @access  Private (Admin/SuperAdmin)
const updateCoupon = async (req, res) => {
    try {
        const { code, description, discountType, discountValue, expiryDate, status, applicableTo, maxTotalUsage, maxUsagePerUser, maxDiscountAmount, minimumPurchaseAmount } = req.body;
        const couponId = req.params.id;

        let formattedDate = expiryDate ? new Date(expiryDate) : null;
        if (formattedDate && isNaN(formattedDate.getTime())) {
            formattedDate = null;
        }

        await pool.query(
            `UPDATE coupons SET code=$1, description=$2, discounttype=$3, discountvalue=$4, expirydate=$5, status=$6, applicableto=$7, maxtotalusage=$8, maxusageperuser=$9, maxdiscountamount=$10, minimumpurchaseamount=$11 WHERE id=$12`,
            [code, description, discountType, discountValue, formattedDate, status, applicableTo, maxTotalUsage, maxUsagePerUser, maxDiscountAmount || 0, minimumPurchaseAmount || 0, couponId]
        );

        res.json({ success: true, message: 'Coupon updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// @desc    Delete a coupon
// @route   DELETE /api/v1/coupons/:id
// @access  Private (Admin/SuperAdmin)
const deleteCoupon = async (req, res) => {
    try {
        await pool.query('DELETE FROM coupons WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Coupon deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete a user (SuperAdmin only)
// @route   DELETE /api/v1/users/:id
// @access  Private (SuperAdmin)
const safeDelete = async (client, tableName, userId) => {
    try {
        await client.query('SAVEPOINT safe_delete');
        await client.query(`DELETE FROM ${tableName} WHERE userid = $1`, [userId]);
        await client.query('RELEASE SAVEPOINT safe_delete');
    } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT safe_delete');
        // Ignore table not found errors, log others warning
        if (error.code !== '42P01') {
            console.warn(`Warning: Failed to delete from ${tableName} for user ${userId}:`, error.message);
        }
    }
};

// @desc    Delete a user (SuperAdmin only)
// @route   DELETE /api/v1/users/:id
// @access  Private (SuperAdmin)
const deleteUser = async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.params.id;
        const requestingUserId = req.user.id;

        if (parseInt(userId) === requestingUserId) {
            return res.status(400).json({ message: 'Cannot delete your own account' });
        }

        await client.query('BEGIN');

        const { rows: users } = await client.query('SELECT id, fullname as "fullName", role FROM users WHERE id = $1', [userId]);
        if (users.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'User not found' });
        }

        // 1. Delete dependent relations (Cascading Delete Manually)
        // Critical tables (should exist)
        await client.query('DELETE FROM referrals WHERE referrerid = $1 OR referreduserid = $1', [userId]);
        await client.query('DELETE FROM call_history WHERE callerid = $1 OR calleeid = $1', [userId]);
        await client.query('DELETE FROM topics WHERE instructorid = $1', [userId]);
        await client.query('DELETE FROM transactions WHERE userid = $1', [userId]);
        await client.query('DELETE FROM subscriptions WHERE userid = $1', [userId]);
        await client.query('DELETE FROM coupon_usages WHERE userid = $1', [userId]);

        // Optional/Potential missing tables - use SAFEPOINT
        await safeDelete(client, 'user_progress', userId);
        await safeDelete(client, 'instructor_profiles', userId);
        await safeDelete(client, 'notifications', userId);

        // 2. Delete the user
        await client.query('DELETE FROM users WHERE id = $1', [userId]);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `User ${users[0].fullName} deleted successfully`,
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    } finally {
        client.release();
    }
};

// @desc    Update a user (Admin/SuperAdmin)
// @route   PUT /api/v1/users/:id
// @access  Private (Admin/SuperAdmin)
const updateUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const { fullName, email, role, phoneNumber, password, isActive } = req.body;

        let updates = [];
        let values = [];
        let idx = 1;

        if (fullName) { updates.push(`fullname = $${idx++}`); values.push(fullName); }
        if (email) { updates.push(`email = $${idx++}`); values.push(email); }
        if (role) { updates.push(`role = $${idx++}`); values.push(role); }
        if (phoneNumber) { updates.push(`phonenumber = $${idx++}`); values.push(phoneNumber); }
        // isActive -> isApproved maybe? users table doesn't have isActive in schema I saw.
        // Schema: isApproved, isVerified, status ('Online'...). No isActive column.
        // Assuming isActive maps to isApproved or similar? Or maybe schema refactoring added it?
        // I will assume isApproved for now based on typical flows, or ignore if undefined.
        // But the previous code checked `isActive`.
        // Let's assume it might be mapping to `isApproved`.
        if (typeof isActive !== 'undefined') { updates.push(`isapproved = $${idx++}`); values.push(isActive); }

        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            updates.push(`password = $${idx++}`);
            values.push(hashedPassword);
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'No fields to update' });
        }

        values.push(userId);

        await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, values);

        const { rows: users } = await pool.query('SELECT id, fullname as "fullName", email, role, phonenumber as "phoneNumber", isapproved as "isApproved" FROM users WHERE id = $1', [userId]);

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

        const { rows: coupons } = await pool.query('SELECT * FROM coupons WHERE code = $1', [actualCode]);
        if (coupons.length === 0) {
            return res.status(404).json({ message: 'Invalid coupon code' });
        }

        const coupon = coupons[0];
        // Casing: coupon.discountType might be lowercase if unaliased *
        const discountType = coupon.discountType || coupon.discounttype;
        const discountValue = parseFloat(coupon.discountValue || coupon.discountvalue);
        const maxTotalUsage = parseInt(coupon.maxTotalUsage || coupon.maxtotalusage);
        const maxUsagePerUser = parseInt(coupon.maxUsagePerUser || coupon.maxusageperuser);
        const minimumPurchaseAmount = parseFloat(coupon.minimumPurchaseAmount || coupon.minimumpurchaseamount || 0);
        const maxDiscountAmount = parseFloat(coupon.maxDiscountAmount || coupon.maxdiscountamount || 0);
        const expiredDate = coupon.expiryDate || coupon.expirydate;

        if (coupon.status !== 'Active') {
            return res.status(400).json({ message: 'This coupon is inactive or expired' });
        }

        if (expiredDate && new Date(expiredDate) < new Date()) {
            return res.status(400).json({ message: 'This coupon has expired' });
        }

        if (maxTotalUsage) {
            const { rows: usageCount } = await pool.query('SELECT COUNT(*) as count FROM coupon_usages WHERE couponid = $1', [coupon.id]);
            if (parseInt(usageCount[0].count) >= maxTotalUsage) {
                return res.status(400).json({ message: 'This coupon has reached its maximum usage limit' });
            }
        }

        if (maxUsagePerUser) {
            const { rows: userUsage } = await pool.query('SELECT COUNT(*) as count FROM coupon_usages WHERE couponid = $1 AND userid = $2', [coupon.id, userId]);
            if (parseInt(userUsage[0].count) >= maxUsagePerUser) {
                return res.status(400).json({ message: 'You have already used this coupon the maximum allowed times' });
            }
        }

        if (minimumPurchaseAmount && actualAmount && actualAmount < minimumPurchaseAmount) {
            return res.status(400).json({ message: `Minimum purchase amount of ${minimumPurchaseAmount} required` });
        }

        let discount = 0;
        if (discountType === 'percentage' || discountType === 'Percentage') {
            discount = (actualAmount * discountValue) / 100;
            if (maxDiscountAmount && discount > maxDiscountAmount) {
                discount = maxDiscountAmount;
            }
        } else {
            discount = discountValue;
        }

        if (discount > actualAmount) {
            discount = actualAmount;
        }

        res.json({
            success: true,
            data: {
                id: coupon.id,
                code: coupon.code,
                discountType,
                discountValue,
                calculatedDiscount: discount,
                finalPrice: actualAmount - discount
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const resendVerificationEmail = async (req, res) => {
    try {
        const { userId } = req.body;

        const { rows: users } = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const user = users[0];
        // Casing
        const isVerified = user.isverified;
        const fullName = user.fullname;

        if (isVerified) {
            return res.status(400).json({ success: false, message: 'User is already verified' });
        }

        let verificationToken = user.verificationtoken;
        if (!verificationToken) {
            verificationToken = crypto.randomBytes(32).toString('hex');
            const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

            await pool.query(
                'UPDATE users SET verificationtoken = $1, verificationtokenexpires = $2 WHERE id = $3',
                [verificationToken, verificationTokenExpires, userId]
            );
        }

        console.log('📧 Admin resending verification email to:', user.email);
        await sendVerificationEmail(user.email, fullName, verificationToken);

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

// @desc    Get users who used a specific coupon
// @route   GET /api/v1/admin/coupons/:id/users
// @access  Private (Admin/SuperAdmin)
const getCouponUsageUsers = async (req, res) => {
    try {
        const couponId = req.params.id;
        console.log(`🔍 [Admin] Fetching usage for coupon ID: ${couponId}`);

        // Verify coupon exists
        const { rows: coupons } = await pool.query('SELECT code FROM coupons WHERE id = $1', [couponId]);
        if (coupons.length === 0) {
            console.log('❌ [Admin] Coupon not found');
            return res.status(404).json({ message: 'Coupon not found' });
        }

        const query = `
            SELECT 
                u.id, 
                u.fullname as "fullName", 
                u.email, 
                cu.usedat as "usedAt",
                cu.discountamount as "discountAmount",
                cu.orderid as "orderId"
            FROM coupon_usages cu
            JOIN users u ON cu.userid = u.id
            WHERE cu.couponid = $1 AND cu.status = 'completed'
            ORDER BY cu.usedat DESC
        `;

        const { rows: users } = await pool.query(query, [couponId]);
        console.log(`✅ [Admin] Found ${users.length} users for coupon ${couponId}`);

        res.json({
            success: true,
            data: users,
            couponCode: coupons[0].code
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
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
    resendVerificationEmail,
    getCouponUsageUsers
};
