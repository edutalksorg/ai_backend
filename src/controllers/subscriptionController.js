const pool = require('../config/db');
const { createOrder } = require('../services/razorpayService');
const crypto = require('crypto');

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
        const { name, description, price, currency, billingCycle, features, isActive, displayOrder, trialDays, isMostPopular, marketingTagline } = req.body;

        const [result] = await pool.query(
            'INSERT INTO plans (name, description, price, currency, billingCycle, features, isActive, displayOrder, trialDays, isMostPopular, marketingTagline) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, description, price, currency || 'INR', billingCycle, JSON.stringify(features || {}), isActive || true, displayOrder || 0, trialDays || 0, isMostPopular || false, marketingTagline || '']
        );

        res.status(201).json({ success: true, data: { id: result.insertId, name } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update a plan (Admin)
// @route   PUT /api/v1/subscriptions/plans/:id
// @access  Private (Admin)
// @desc    Update a plan (Admin)
// @route   PUT /api/v1/subscriptions/plans/:id
// @access  Private (Admin)
const updatePlan = async (req, res) => {
    try {
        const planId = req.params.id;
        const updates = req.body;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'No fields provided for update' });
        }

        // Special handling for features: If provided, we merge or replace? 
        // Current logic assumes replacement if provided.
        // We need to exclude 'features' from direct string/number mapping if we handle it separately,
        // but for now, let's treat it as a potential partial update field.

        let features = updates.features;

        // If features is undefined, we don't touch it. 
        // If it IS defined, we need to stringify it.

        // Construct dynamic query
        const fields = [];
        const values = [];

        // Map allowed fields to DB columns
        const allowedFields = {
            name: 'name',
            description: 'description',
            price: 'price',
            currency: 'currency',
            billingCycle: 'billingCycle',
            isActive: 'isActive',
            displayOrder: 'displayOrder',
            trialDays: 'trialDays',
            isMostPopular: 'isMostPopular',
            marketingTagline: 'marketingTagline'
        };

        for (const [key, dbColumn] of Object.entries(allowedFields)) {
            if (updates[key] !== undefined) {
                fields.push(`${dbColumn} = ?`);
                values.push(updates[key]);
            }
        }

        // Handle features separately to ensure valid JSON
        if (features !== undefined) {
            // If partial update of features is needed, we'd need to fetch first. 
            // But usually the editor sends the whole features object.
            // If we just want to update metadata (isMostPopular), features is undefined, so we skip this.
            fields.push(`features = ?`);
            values.push(JSON.stringify(features));
        }

        if (fields.length === 0) {
            return res.json({ success: true, message: 'No changes detected or valid fields provided' });
        }

        values.push(planId);

        const sql = `UPDATE plans SET ${fields.join(', ')} WHERE id = ?`;

        await pool.query(sql, values);

        res.json({ success: true, message: 'Plan updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// @desc    Delete a plan (Admin)
// @route   DELETE /api/v1/subscriptions/plans/:id
// @access  Private (Admin)
const deletePlan = async (req, res) => {
    try {
        await pool.query('DELETE FROM plans WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Plan deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Add a feature to a plan
// @route   POST /api/v1/subscriptions/plans/:id/features
// @access  Private (Admin)
const addFeature = async (req, res) => {
    try {
        const { featureKey, value } = req.body;
        const planId = req.params.id;

        const [rows] = await pool.query('SELECT features FROM plans WHERE id = ?', [planId]);
        if (rows.length === 0) return res.status(404).json({ message: 'Plan not found' });

        let features = {};
        try {
            features = JSON.parse(rows[0].features || '{}');
        } catch (e) {
            features = {};
        }

        features[featureKey] = value;

        await pool.query('UPDATE plans SET features = ? WHERE id = ?', [JSON.stringify(features), planId]);

        res.json({ success: true, message: 'Feature added' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete a feature from a plan
// @route   DELETE /api/v1/subscriptions/plans/:id/features/:key
// @access  Private (Admin)
const deleteFeature = async (req, res) => {
    try {
        const { id, key } = req.params;

        const [rows] = await pool.query('SELECT features FROM plans WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Plan not found' });

        let features = {};
        try {
            features = JSON.parse(rows[0].features || '{}');
        } catch (e) {
            features = {};
        }

        delete features[key];

        await pool.query('UPDATE plans SET features = ? WHERE id = ?', [JSON.stringify(features), id]);

        res.json({ success: true, message: 'Feature deleted' });
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
        const { planId, paymentMethodId, useFreeTrial, couponCode, userPhone: bodyPhone } = req.body;

        // 1. Fetch Plan
        const [plans] = await pool.query('SELECT * FROM plans WHERE id = ?', [planId]);
        if (plans.length === 0) return res.status(404).json({ message: 'Plan not found' });
        const plan = plans[0];

        // 2. Check if user already has active subscription
        const [existing] = await pool.query('SELECT * FROM subscriptions WHERE userId = ? AND status = "active"', [userId]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'User already has an active subscription' });
        }

        // 3. Coupon Logic
        let discountAmount = 0;
        let couponId = null;

        if (couponCode) {
            const [coupons] = await pool.query('SELECT * FROM coupons WHERE code = ? AND status = "Active"', [couponCode]);
            if (coupons.length > 0) {
                const coupon = coupons[0];
                couponId = coupon.id;

                // Calculate discount just for recording purposes (payment is assumed successful here)
                if (coupon.discountType === 'Percentage') {
                    discountAmount = (plan.price * coupon.discountValue) / 100;
                    if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
                        discountAmount = coupon.maxDiscountAmount;
                    }
                } else {
                    discountAmount = coupon.discountValue;
                }
                if (discountAmount > plan.price) discountAmount = plan.price;
            }
        }

        // 4. Calculate Dates
        const startDate = new Date();
        const endDate = new Date();

        if ((useFreeTrial || plan.billingCycle === 'Free') && plan.trialDays > 0) {
            // Logic for trial
            endDate.setDate(startDate.getDate() + plan.trialDays);
        } else {
            // Basic logic: Add months/years based on billingCycle
            if (plan.billingCycle === 'Monthly') endDate.setMonth(startDate.getMonth() + 1);
            else if (plan.billingCycle === 'Yearly') endDate.setFullYear(startDate.getFullYear() + 1);
            else if (plan.billingCycle === 'Quarterly') endDate.setMonth(startDate.getMonth() + 3);
            else {
                // Fallback: Default to 1 month if unknown
                endDate.setMonth(startDate.getMonth() + 1);
            }
        }

        // 5. IF PAID PLAN: Initiate Razorpay Order
        const payableAmount = plan.price - discountAmount;

        if (payableAmount > 0) {
            // Generate a unique transaction ID
            const merchantTransactionId = `SUB_${userId}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

            // Create PENDING Subscription
            const [subResult] = await pool.query(
                'INSERT INTO subscriptions (userId, planId, status, startDate, endDate, paymentStatus) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, planId, 'pending', startDate, endDate, 'pending']
            );

            // Record Coupon Usage (pending)
            if (couponId) {
                await pool.query(
                    'INSERT INTO coupon_usages (couponId, userId, orderId, discountAmount) VALUES (?, ?, ?, ?)',
                    [couponId, userId, merchantTransactionId, discountAmount]
                );
            }

            // Create Transaction record
            await pool.query(
                'INSERT INTO transactions (userId, amount, type, providerTransactionId, status) VALUES (?, ?, ?, ?, ?)',
                [userId, payableAmount, 'payment', merchantTransactionId, 'pending']
            );

            // Initiate Razorpay Order
            const razorpayOrder = await createOrder(payableAmount, merchantTransactionId);

            return res.json({
                success: true,
                keyId: process.env.RAZORPAY_KEY_ID,
                orderId: razorpayOrder.id,
                amount: razorpayOrder.amount, // in paisa
                currency: razorpayOrder.currency,
                planName: plan.name,
                description: plan.description,
                user: {
                    name: req.user?.fullName || 'User',
                    email: req.user?.email || '',
                    contact: bodyPhone || req.user?.phoneNumber || ''
                }
            });
        }

        // 6. IF FREE PLAN: Create Active Subscription immediately
        const [subResult] = await pool.query(
            'INSERT INTO subscriptions (userId, planId, status, startDate, endDate, paymentStatus) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, planId, 'active', startDate, endDate, 'free']
        );

        // Record Coupon Usage
        if (couponId) {
            await pool.query(
                'INSERT INTO coupon_usages (couponId, userId, orderId, discountAmount) VALUES (?, ?, ?, ?)',
                [couponId, userId, `SUB-${subResult.insertId}`, discountAmount]
            );
            await pool.query('UPDATE coupons SET currentUsageCount = currentUsageCount + 1 WHERE id = ?', [couponId]);
        }

        res.json({
            success: true,
            data: {
                id: subResult.insertId,
                status: 'active',
                endDate
            }
        });

    } catch (error) {
        console.error('❌ [Subscription] Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error initiating subscription'
        });
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
// @desc    Cancel subscription
// @route   POST /api/v1/subscriptions/cancel
// @access  Private
const cancelSubscription = async (req, res) => {
    try {
        const userId = req.user.id;
        const { subscriptionId, reason } = req.body;

        // Verify ownership and update status
        const [result] = await pool.query(
            'UPDATE subscriptions SET status = "cancelled", updatedAt = NOW() WHERE id = ? AND userId = ? AND status = "active"',
            [subscriptionId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Active subscription not found' });
        }

        res.json({ success: true, message: 'Subscription cancelled successfully' });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ message: 'Server error cancelling subscription' });
    }
};

module.exports = {
    getPlans,
    createPlan,
    updatePlan,
    deletePlan,
    addFeature,
    deleteFeature,
    subscribe,
    getCurrentSubscription,
    cancelSubscription
};
