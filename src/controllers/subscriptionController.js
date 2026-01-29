const pool = require('../config/db');

// --- PLANS ---

// @desc    Get all active plans
// @route   GET /api/v1/subscriptions/plans
// @access  Public
const getPlans = async (req, res) => {
    try {
        const [plans] = await pool.query('SELECT * FROM plans WHERE isActive = TRUE ORDER BY price ASC');
        res.json({ success: true, data: plans });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Create a plan (Admin)
// @route   POST /api/v1/subscriptions/plans
// @access  Private (Admin)
const createPlan = async (req, res) => {
    try {
        const { name, description, price, currency, billingCycle, features, isActive } = req.body;

        const [result] = await pool.query(
            'INSERT INTO plans (name, description, price, currency, billingCycle, features, isActive) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, description, price, currency || 'INR', billingCycle, JSON.stringify(features || {}), isActive || true]
        );

        res.status(201).json({ success: true, data: { id: result.insertId, name } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// --- SUBSCRIPTIONS ---

// @desc    Subscribe to a plan
// @route   POST /api/v1/subscriptions/subscribe
// @access  Private
const subscribe = async (req, res) => {
    try {
        const userId = req.user.id;
        const { planId, paymentMethodId, useFreeTrial } = req.body;

        // 1. Fetch Plan
        const [plans] = await pool.query('SELECT * FROM plans WHERE id = ?', [planId]);
        if (plans.length === 0) return res.status(404).json({ message: 'Plan not found' });
        const plan = plans[0];

        // 2. Check if user already has active subscription
        const [existing] = await pool.query('SELECT * FROM subscriptions WHERE userId = ? AND status = "active"', [userId]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'User already has an active subscription' });
        }

        // 3. Calculate Dates
        const startDate = new Date();
        const endDate = new Date();

        if (useFreeTrial && plan.trialDays > 0) {
            // Logic for trial
            endDate.setDate(startDate.getDate() + plan.trialDays);
        } else {
            // Basic logic: Add months/years based on billingCycle
            if (plan.billingCycle === 'Monthly') endDate.setMonth(startDate.getMonth() + 1);
            else if (plan.billingCycle === 'Yearly') endDate.setFullYear(startDate.getFullYear() + 1);
            else if (plan.billingCycle === 'Quarterly') endDate.setMonth(startDate.getMonth() + 3);
        }

        // 4. Create Subscription
        // Note: In real app, we verify payment first. Here we assume free or mock payment.
        const [subResult] = await pool.query(
            'INSERT INTO subscriptions (userId, planId, status, startDate, endDate, paymentStatus) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, planId, 'active', startDate, endDate, 'paid']
        );

        res.json({
            success: true,
            data: {
                id: subResult.insertId,
                status: 'active',
                endDate
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get current subscription
// @route   GET /api/v1/subscriptions/current
// @access  Private
const getCurrentSubscription = async (req, res) => {
    try {
        const userId = req.user.id;

        const [subs] = await pool.query(`
            SELECT s.*, p.name as planName, p.price, p.billingCycle 
            FROM subscriptions s 
            JOIN plans p ON s.planId = p.id 
            WHERE s.userId = ? AND s.status = 'active'
            ORDER BY s.endDate DESC LIMIT 1
        `, [userId]);

        if (subs.length === 0) return res.json({ success: true, data: null });

        res.json({ success: true, data: subs[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getPlans,
    createPlan,
    subscribe,
    getCurrentSubscription
};
