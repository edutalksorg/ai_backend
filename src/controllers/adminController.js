const pool = require('../config/db');

// @desc    Get all users (Admin/SuperAdmin)
// @route   GET /api/v1/users
// @access  Private (Admin/SuperAdmin)
const getAllUsers = async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, fullName, email, role, isApproved, createdAt FROM users');
        res.json({
            success: true,
            data: users,
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
// @route   POST /api/v1/admin/coupons
// @access  Private (Admin/SuperAdmin)
const createCoupon = async (req, res) => {
    try {
        const { code, description, discountType, discountValue, expiryDate, status, applicableTo, maxTotalUsage, maxUsagePerUser } = req.body;

        const [result] = await pool.query(
            'INSERT INTO coupons (code, description, discountType, discountValue, expiryDate, status, applicableTo, maxTotalUsage, maxUsagePerUser) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [code, description, discountType, discountValue, expiryDate, status || 'Active', applicableTo || 'AllSubscriptions', maxTotalUsage || 1000, maxUsagePerUser || 1]
        );

        res.status(201).json({ success: true, data: { id: result.insertId, code } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update a coupon
// @route   PUT /api/v1/admin/coupons/:id
// @access  Private (Admin/SuperAdmin)
const updateCoupon = async (req, res) => {
    try {
        const { code, description, discountType, discountValue, expiryDate, status, applicableTo, maxTotalUsage, maxUsagePerUser } = req.body;
        const couponId = req.params.id;

        await pool.query(
            'UPDATE coupons SET code=?, description=?, discountType=?, discountValue=?, expiryDate=?, status=?, applicableTo=?, maxTotalUsage=?, maxUsagePerUser=? WHERE id=?',
            [code, description, discountType, discountValue, expiryDate, status, applicableTo, maxTotalUsage, maxUsagePerUser, couponId]
        );

        res.json({ success: true, message: 'Coupon updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete a coupon
// @route   DELETE /api/v1/admin/coupons/:id
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

module.exports = {
    getAllUsers,
    reviewInstructor,
    getDashboardStats,
    getAllCoupons,
    createCoupon,
    updateCoupon,
    deleteCoupon,
};

