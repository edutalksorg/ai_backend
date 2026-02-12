const pool = require('../config/db');
const { verifyPaymentSignature, fetchOrder } = require('../services/razorpayService');

// @desc    Get Payment Status
// @route   GET /api/v1/payments/:orderId/status
// @access  Private
const getPaymentStatus = async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({ success: false, message: 'Order ID is required' });
        }

        // Fetch order from Razorpay
        const order = await fetchOrder(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.json({
            success: true,
            status: order.status, // created, attempted, paid
            amount: order.amount,
            amount_paid: order.amount_paid,
            attempts: order.attempts
        });

    } catch (error) {
        console.error('❌ [Payment] Status fetch error:', error);

        // Handle Razorpay "bad request" (often means ID not found) as 404
        if (error.statusCode === 400 || (error.error && error.error.code === 'BAD_REQUEST_ERROR')) {
            return res.status(404).json({ success: false, message: 'Order ID not found in Razorpay' });
        }

        res.status(500).json({ success: false, message: 'Failed to fetch payment status' });
    }
};

// @desc    Verify Razorpay Payment
// @route   POST /api/v1/payments/verify
// @access  Private
const verifyRazorpayPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const userId = req.user.id;

        console.log('🔍 [Payment] Verification request:', {
            userId,
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            hasSignature: !!razorpay_signature
        });

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Missing payment details' });
        }

        // 1. Verify Signature (wrap in try-catch for config errors)
        let isValid;
        try {
            isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
        } catch (verifyError) {
            console.error('❌ [Payment] Signature verification failed:', verifyError);
            return res.status(500).json({
                success: false,
                message: 'Payment verification configuration error. Please contact support.'
            });
        }

        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        // 2. Find Transaction
        const { rows: pendingTx } = await pool.query(
            `SELECT * FROM transactions WHERE userId = $1 AND status = 'pending' AND type = 'payment' ORDER BY createdAt DESC LIMIT 1`,
            [userId]
        ); // Status values in single quotes

        let transactionId = null;

        if (pendingTx.length > 0) {
            console.log('✅ [Payment] Found pending transaction:', pendingTx[0].id);
            transactionId = pendingTx[0].id;
            const originalOrderId = pendingTx[0].providertransactionid || pendingTx[0].providerTransactionId; // The Merchant Order ID (SUB_...)

            // Increment Coupon Usage Count if a coupon was used for this order
            if (originalOrderId) {
                console.log('🎫 [Payment] Checking for coupon usage with Order ID:', originalOrderId);
                try {
                    await pool.query(
                        `UPDATE coupons 
                         SET currentUsageCount = currentUsageCount + 1 
                         WHERE id = (SELECT couponId FROM coupon_usages WHERE orderId = $1 LIMIT 1)`,
                        [originalOrderId]
                    );

                    // Also update the coupon_usages status to completed
                    await pool.query(
                        `UPDATE coupon_usages SET status = 'completed' WHERE orderId = $1`,
                        [originalOrderId]
                    );
                } catch (couponError) {
                    console.error('❌ [Payment] Failed to update coupon usage:', couponError);
                }
            }

            await pool.query(
                'UPDATE transactions SET status = \'completed\', providerTransactionId = $1 WHERE id = $2',
                [razorpay_payment_id, transactionId]
            );
        } else {
            console.warn('⚠️ [Payment] No pending transaction found for user. Creating new record.');
            const { rows: newTx } = await pool.query(
                `INSERT INTO transactions (userId, amount, type, providerTransactionId, status) 
                 VALUES ($1, $2, 'payment', $3, 'completed') RETURNING id`,
                [userId, 0, razorpay_payment_id]
            );
            transactionId = newTx[0].id; // RETURNING id
        }

        // 3. Activate Subscription
        const { rows: subscriptions } = await pool.query(
            `SELECT * FROM subscriptions WHERE userId = $1 AND status = 'pending' ORDER BY createdAt DESC LIMIT 1`,
            [userId]
        );

        if (subscriptions.length > 0) {
            console.log('✅ [Payment] Activating subscription:', subscriptions[0].id);
            const sub = subscriptions[0];
            await pool.query(
                'UPDATE subscriptions SET status = \'active\', paymentStatus = \'completed\' WHERE id = $1',
                [sub.id]
            );

            // --- Referral Reward Processing (Post-Payment) ---
            try {
                // 1. Fetch Plan Details to get percentages
                // Note: using explicit lowercase aliasing to be safe with Postgres returns
                const { rows: plans } = await pool.query('SELECT * FROM plans WHERE id = $1', [sub.planid || sub.planId]);

                if (plans.length > 0) {
                    const plan = plans[0];

                    if (plan && parseFloat(plan.price) > 0) {
                        console.log(`🔍 [Payment] Checking referral reward for plan: ${plan.name} (Price: ${plan.price})`);

                        // 2. Check for Pending Referral
                        // We query by referredUserId to find if THIS user was referred by someone
                        // And handle potential case sensitivity in DB column matching by using lowercased key via helper if needed, 
                        // but WHERE clause is safe.
                        const { rows: referrals } = await pool.query(
                            'SELECT * FROM referrals WHERE referredUserId = $1 AND status = \'pending\'',
                            [userId]
                        );

                        if (referrals.length > 0) {
                            const referral = referrals[0];
                            const referrerId = referral.referrerid || referral.referrerId;

                            console.log(`🔗 [Payment] Found pending referral from referrer: ${referrerId}. Processing reward...`);

                            // Normalize percentages from potential DB casing
                            const referrerRewardPercent = parseFloat(plan.referrerRewardPercentage || plan.referrerrewardpercentage || 0);
                            const refereeRewardPercent = parseFloat(plan.refereeRewardPercentage || plan.refereerewardpercentage || 0);

                            // Calculate Amounts
                            const price = parseFloat(plan.price);
                            const referrerAmount = (price * referrerRewardPercent) / 100;
                            const refereeAmount = (price * refereeRewardPercent) / 100;

                            console.log(`💰 [Payment] Reward Calculation:
                               - Plan Price: ${price}
                               - Referrer: ${referrerRewardPercent}% = ${referrerAmount}
                               - Referee: ${refereeRewardPercent}% = ${refereeAmount}
                            `);

                            if (referrerAmount > 0) {
                                console.log(`💳 [Payment] Crediting Referrer (${referrerId}) with ${referrerAmount}`);
                                // Update Referrer Wallet
                                await pool.query('UPDATE users SET walletBalance = walletBalance + $1 WHERE id = $2', [referrerAmount, referrerId]);

                                // Log Transaction for Referrer
                                await pool.query(
                                    'INSERT INTO transactions (userId, amount, type, status, description) VALUES ($1, $2, $3, $4, $5)',
                                    [referrerId, referrerAmount, 'credit', 'completed', `Referral Percentage Reward (${referrerRewardPercent}%) from ${req.user?.fullName || 'User'}`]
                                );
                            } else {
                                console.log('ℹ️ [Payment] Referrer amount is 0, skipping wallet update.');
                            }

                            if (refereeAmount > 0) {
                                console.log(`💳 [Payment] Crediting Referee/User (${userId}) with ${refereeAmount}`);
                                // Update Referee Wallet (Current User)
                                await pool.query('UPDATE users SET walletBalance = walletBalance + $1 WHERE id = $2', [refereeAmount, userId]);

                                // Log Transaction for Referee
                                await pool.query(
                                    'INSERT INTO transactions (userId, amount, type, status, description) VALUES ($1, $2, $3, $4, $5)',
                                    [userId, refereeAmount, 'credit', 'completed', `Referral Bonus (${refereeRewardPercent}%) for subscribing to ${plan.name}`]
                                );
                            } else {
                                console.log('ℹ️ [Payment] Referee amount is 0, skipping wallet update.');
                            }

                            // Mark Referral Completed
                            await pool.query(
                                'UPDATE referrals SET status = \'completed\', rewardAmount = $1 WHERE id = $2',
                                [referrerAmount, referral.id]
                            );
                            console.log('✅ [Payment] Referral status updated to completed.');
                        } else {
                            console.log('ℹ️ [Payment] No pending referral found for this user.');
                        }
                    } else {
                        console.log('ℹ️ [Payment] Plan price is 0 or invalid, skipping referral logic.');
                    }
                } else {
                    console.log('ℹ️ [Payment] Plan details not found for subscription.');
                }
            } catch (refError) {
                console.error('❌ [Payment] Failed to process referral reward:', refError);
            }


            // --- Safe Switching: Cancel any previous active subscriptions ---
            try {
                const { rowCount: cancelledCount } = await pool.query(
                    'UPDATE subscriptions SET status = \'cancelled\', updatedAt = NOW() WHERE userId = $1 AND status = \'active\' AND id != $2',
                    [userId, sub.id]
                );
                if (cancelledCount > 0) {
                    console.log(`♻️ [Payment] Cancelled ${cancelledCount} old active subscription(s) for user: ${userId}`);
                }
            } catch (cancelError) {
                console.error('⚠️ [Payment] Failed to cancel old subscriptions during switch:', cancelError.message);
            }

            // Notify Friends of Status Change (Real-time update)
            try {
                const { rows: friends } = await pool.query(`
                    SELECT requester_id, recipient_id 
                    FROM user_connections 
                    WHERE (requester_id = $1 OR recipient_id = $1) AND status = 'accepted'
                `, [userId]);

                console.log(`[Payment] 📢 Notifying ${friends.length} friends of eligibility update for user ${userId}`);

                const { sendToUser } = require('../services/socketService');

                friends.forEach(friend => {
                    const friendId = friend.requester_id === userId ? friend.recipient_id : friend.requester_id;
                    sendToUser(friendId, 'UserEligibilityChanged', {
                        userId: userId,
                        isCallEligible: true, // Subscription active = eligible
                        onlineStatus: 'Online' // Assuming online if paying
                    });
                });
            } catch (notifyError) {
                console.error('⚠️ [Payment] Failed to notify friends:', notifyError);
            }

        } else {
            console.warn('⚠️ [Payment] No pending subscription found to activate.');
        }

        res.json({ success: true, message: 'Payment verified and subscription activated' });

    } catch (error) {
        console.error('❌ [Payment] Verification error details:', {
            message: error.message,
            stack: error.stack,
            body: req.body,
            userId: req.user?.id
        });
        res.status(500).json({ success: false, message: 'Server error during verification' });
    }
};

module.exports = {
    verifyRazorpayPayment,
    getPaymentStatus
};
