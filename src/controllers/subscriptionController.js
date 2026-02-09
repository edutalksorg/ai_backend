const pool = require('../config/db');
const { createOrder } = require('../services/razorpayService');
const crypto = require('crypto');

// --- PLANS ---

const getPlans = async (req, res) => {
    try {
        const { rows: plans } = await pool.query('SELECT * FROM plans WHERE isActive = TRUE ORDER BY price ASC');
        res.json({ success: true, data: plans });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const createPlan = async (req, res) => {
    try {
        const { name, description, price, currency, billingCycle, features, isActive, displayOrder, trialDays, isMostPopular, marketingTagline } = req.body;

        const { rows: result } = await pool.query(
            'INSERT INTO plans (name, description, price, currency, billingCycle, features, isActive, displayOrder, trialDays, isMostPopular, marketingTagline) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id',
            [name, description, price, currency || 'INR', billingCycle, JSON.stringify(features || {}), isActive || true, displayOrder || 0, trialDays || 0, isMostPopular || false, marketingTagline || '']
        );

        res.status(201).json({ success: true, data: { id: result[0].id, name } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updatePlan = async (req, res) => {
    try {
        const planId = req.params.id;
        const updates = req.body;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'No fields provided for update' });
        }

        let features = updates.features;

        const fields = [];
        const values = [];

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

        // Start index at 1
        let idx = 1;

        for (const [key, dbColumn] of Object.entries(allowedFields)) {
            if (updates[key] !== undefined) {
                fields.push(`${dbColumn} = $${idx}`);
                values.push(updates[key]);
                idx++;
            }
        }

        if (features !== undefined) {
            fields.push(`features = $${idx}`);
            values.push(JSON.stringify(features));
            idx++;
        }

        if (fields.length === 0) {
            return res.json({ success: true, message: 'No changes detected or valid fields provided' });
        }

        values.push(planId);
        const sql = `UPDATE plans SET ${fields.join(', ')} WHERE id = $${idx}`;

        await pool.query(sql, values);

        res.json({ success: true, message: 'Plan updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

const deletePlan = async (req, res) => {
    try {
        await pool.query('DELETE FROM plans WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Plan deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const addFeature = async (req, res) => {
    try {
        const { featureKey, value } = req.body;
        const planId = req.params.id;

        const { rows } = await pool.query('SELECT features FROM plans WHERE id = $1', [planId]);
        if (rows.length === 0) return res.status(404).json({ message: 'Plan not found' });

        let features = {};
        try {
            features = (typeof rows[0].features === 'string') ? JSON.parse(rows[0].features) : (rows[0].features || {});
        } catch (e) {
            features = {};
        }

        features[featureKey] = value;

        await pool.query('UPDATE plans SET features = $1 WHERE id = $2', [JSON.stringify(features), planId]);

        res.json({ success: true, message: 'Feature added' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const deleteFeature = async (req, res) => {
    try {
        const { id, key } = req.params;

        const { rows } = await pool.query('SELECT features FROM plans WHERE id = $1', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Plan not found' });

        let features = {};
        try {
            features = (typeof rows[0].features === 'string') ? JSON.parse(rows[0].features) : (rows[0].features || {});
        } catch (e) {
            features = {};
        }

        delete features[key];

        await pool.query('UPDATE plans SET features = $1 WHERE id = $2', [JSON.stringify(features), id]);

        res.json({ success: true, message: 'Feature deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// --- SUBSCRIPTIONS ---

const subscribe = async (req, res) => {
    try {
        const userId = req.user.id;
        const { planId, paymentMethodId, useFreeTrial, couponCode, userPhone: bodyPhone } = req.body;

        const { rows: plans } = await pool.query('SELECT * FROM plans WHERE id = $1', [planId]);
        if (plans.length === 0) return res.status(404).json({ message: 'Plan not found' });
        const plan = plans[0];

        // For switching, we allow creating a pending subscription even if an active one exists.
        // The old active subscription will be cancelled only after successful payment verification.
        const { rows: existing } = await pool.query('SELECT * FROM subscriptions WHERE userId = $1 AND status = \'active\'', [userId]);

        // Only block if trying to subscribe to something that doesn't require payment (free trial)
        // or if they are trying to double-subscribe to an active plan.
        if (existing.length > 0 && (useFreeTrial || plan.price === 0)) {
            return res.status(400).json({ message: 'User already has an active subscription' });
        }

        let discountAmount = 0;
        let couponId = null;

        if (couponCode) {
            const upperCouponCode = couponCode.toUpperCase();
            const { rows: coupons } = await pool.query('SELECT * FROM coupons WHERE code = $1 AND status = \'Active\'', [upperCouponCode]);
            if (coupons.length > 0) {
                const coupon = coupons[0];
                couponId = coupon.id;
                // coupon.discountType camelCase accessible if aliased or handled. 
                // Coupons created with unquoted identifiers -> lowercase.
                // coupon.discounttype, coupon.discountvalue.
                const discountType = coupon.discountType || coupon.discounttype;
                const discountValue = parseFloat(coupon.discountValue || coupon.discountvalue);
                const maxDiscountAmount = parseFloat(coupon.maxDiscountAmount || coupon.maxdiscountamount || 0);

                if (discountType === 'Percentage') {
                    discountAmount = (plan.price * discountValue) / 100;
                    if (maxDiscountAmount && discountAmount > maxDiscountAmount) {
                        discountAmount = maxDiscountAmount;
                    }
                } else {
                    discountAmount = discountValue;
                }
                if (discountAmount > plan.price) discountAmount = plan.price;
            }
        }

        const startDate = new Date();
        const endDate = new Date();
        // plan.billingCycle -> billingcycle
        const billingCycle = plan.billingCycle || plan.billingcycle;
        const trialDays = plan.trialDays || plan.trialdays;

        if ((useFreeTrial || billingCycle === 'Free') && trialDays > 0) {
            endDate.setDate(startDate.getDate() + trialDays);
        } else {
            if (billingCycle === 'Monthly') endDate.setMonth(startDate.getMonth() + 1);
            else if (billingCycle === 'Yearly') endDate.setFullYear(startDate.getFullYear() + 1);
            else if (billingCycle === 'Quarterly') endDate.setMonth(startDate.getMonth() + 3);
            else endDate.setMonth(startDate.getMonth() + 1);
        }

        const payableAmount = plan.price - discountAmount;

        if (payableAmount > 0) {
            const merchantTransactionId = `SUB_${userId}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

            const { rows: subResult } = await pool.query(
                'INSERT INTO subscriptions (userId, planId, status, startDate, endDate, paymentStatus) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                [userId, planId, 'pending', startDate, endDate, 'pending']
            );

            if (couponId) {
                await pool.query(
                    'INSERT INTO coupon_usages (couponId, userId, orderId, discountAmount, status) VALUES ($1, $2, $3, $4, $5)',
                    [couponId, userId, merchantTransactionId, discountAmount, 'pending']
                );
            }

            await pool.query(
                'INSERT INTO transactions (userId, amount, type, providerTransactionId, status) VALUES ($1, $2, $3, $4, $5)',
                [userId, payableAmount, 'payment', merchantTransactionId, 'pending']
            );

            const razorpayOrder = await createOrder(payableAmount, merchantTransactionId);

            return res.json({
                success: true,
                keyId: process.env.RAZORPAY_KEY_ID,
                orderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
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

        const { rows: subResult } = await pool.query(
            'INSERT INTO subscriptions (userId, planId, status, startDate, endDate, paymentStatus) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [userId, planId, 'active', startDate, endDate, 'free']
        );

        if (couponId) {
            await pool.query(
                'INSERT INTO coupon_usages (couponId, userId, orderId, discountAmount, status) VALUES ($1, $2, $3, $4, $5)',
                [couponId, userId, `SUB-${subResult[0].id}`, discountAmount, 'completed']
            );
            await pool.query('UPDATE coupons SET currentUsageCount = currentUsageCount + 1 WHERE id = $1', [couponId]);
        }

        res.json({
            success: true,
            data: {
                id: subResult[0].id,
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

const getCurrentSubscription = async (req, res) => {
    try {
        const userId = req.user.id;

        const { rows: subs } = await pool.query(`
            SELECT s.id, s.userId as "userId", s.planId as "planId", s.status, 
                   s.startDate as "startDate", s.endDate as "endDate", s.endDate as "renewalDate",
                   s.paymentStatus as "paymentStatus", s.createdAt as "createdAt",
                   p.name as "planName", p.price, p.billingcycle as "billingCycle" 
            FROM subscriptions s 
            JOIN plans p ON s.planid = p.id 
            WHERE s.userid = $1 AND s.status = 'active'
            ORDER BY s.enddate DESC LIMIT 1
        `, [userId]);

        if (subs.length === 0) return res.json({ success: true, data: null });

        res.json({ success: true, data: subs[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const cancelSubscription = async (req, res) => {
    try {
        const userId = req.user.id;
        const { subscriptionId, reason } = req.body;

        const result = await pool.query(
            'UPDATE subscriptions SET status = \'cancelled\', updatedAt = NOW() WHERE id = $1 AND userId = $2 AND status = \'active\'',
            [subscriptionId, userId]
        );

        if (result.rowCount === 0) { // rowCount in PG
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
