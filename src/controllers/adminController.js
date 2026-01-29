const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// @desc    Get all users (Admin/SuperAdmin)
// @route   GET /api/v1/users
// @access  Private (Admin/SuperAdmin)
const getAllUsers = async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, fullName, email, phoneNumber, role, isApproved, createdAt FROM users');
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

        // Check if user exists
        const [userExists] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (userExists.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const [result] = await pool.query(
            'INSERT INTO users (fullName, email, password, role, phoneNumber, isApproved) VALUES (?, ?, ?, ?, ?, ?)',
            [fullName, email, hashedPassword, role || 'User', phoneNumber, 1] // Auto-approve if created by admin
        );

        res.status(201).json({
            success: true,
            data: {
                id: result.insertId,
                fullName,
                email,
                role,
                phoneNumber
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
const getDashboardStats = async (req, res) => {
    try {
        const [userCount] = await pool.query('SELECT COUNT(*) as count FROM users');
        const [revenue] = await pool.query('SELECT SUM(amount) as total FROM transactions WHERE status = "completed"');
        const [activeSubs] = await pool.query('SELECT COUNT(*) as count FROM subscriptions WHERE status = "active"');
        const [instructorCount] = await pool.query('SELECT COUNT(*) as count FROM users WHERE role = "Instructor"');

        res.json({
            success: true,
            data: {
                totalUsers: userCount[0].count,
                totalRevenue: revenue[0].total || 0,
                activeSubscriptions: activeSubs[0].count,
                totalInstructors: instructorCount[0].count,
                growthData: [], // Add logic for growth trends if needed
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
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
    try {
        const userId = req.params.id;
        const requestingUserId = req.user.id;

        // Prevent self-deletion
        if (parseInt(userId) === requestingUserId) {
            return res.status(400).json({ message: 'Cannot delete your own account' });
        }

        // Check if user exists
        const [users] = await pool.query('SELECT id, fullName, role FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Delete the user
        await pool.query('DELETE FROM users WHERE id = ?', [userId]);

        res.json({
            success: true,
            message: `User ${users[0].fullName} deleted successfully`,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
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
    updateUser
};
