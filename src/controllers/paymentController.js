const pool = require('../config/db');
const { verifyPaymentSignature } = require('../services/razorpayService');

// @desc    Verify Razorpay Payment
// @route   POST /api/v1/payments/verify
// @access  Private
const verifyRazorpayPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const userId = req.user.id;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Missing payment details' });
        }

        console.log(`🔍 [Payment] Verifying Razorpay payment: Order=${razorpay_order_id}, Payment=${razorpay_payment_id}`);

        // 1. Verify Signature
        const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

        if (!isValid) {
            console.error('❌ [Payment] Signature verification failed');
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        // 2. Find Transaction and Update
        // We look for a PENDING transaction that used this order ID (stored as providerTransactionId)
        // OR we might have stored it as "merchantTransactionId" passed to Receipt
        // In subscriptionController we used: merchantTransactionId (SUB_...) passed as receipt.
        // Razorpay order response has ID: order_...
        // We didn't save order_... in DB yet.
        // So we look up by the SUB_... which we passed as 'receipt' to creation?
        // Wait, the client sends back `razorpay_order_id`. Any way to link it to `SUB_...`?
        // Razorpay Order API fetches order details which contains `receipt` (our SUB_ID).

        // Simpler fallback: Look for ANY pending payment-type transaction for this user created recently.
        const [pendingTx] = await pool.query(
            'SELECT * FROM transactions WHERE userId = ? AND status = "pending" AND type = "payment" ORDER BY createdAt DESC LIMIT 1',
            [userId]
        );

        let transactionId = null;

        if (pendingTx.length > 0) {
            transactionId = pendingTx[0].id;
            // Update transaction
            await pool.query(
                'UPDATE transactions SET status = "completed", providerTransactionId = ? WHERE id = ?',
                [razorpay_payment_id, transactionId]
            );
        } else {
            // Logic if no pending transaction found (should not happen in normal flow)
            console.warn('⚠️ [Payment] No pending transaction found for user. Creating new record.');
            const [newTx] = await pool.query(
                'INSERT INTO transactions (userId, amount, type, providerTransactionId, status) VALUES (?, ?, "payment", ?, "completed")',
                [userId, 0, razorpay_payment_id]
            );
            transactionId = newTx.insertId;
        }

        console.log(`✅ [Payment] Payment verified and recorded. Transaction ID: ${transactionId}`);

        // 3. Activate Subscription
        // Find the pending subscription
        const [subscriptions] = await pool.query(
            'SELECT * FROM subscriptions WHERE userId = ? AND status = "pending" ORDER BY createdAt DESC LIMIT 1',
            [userId]
        );

        if (subscriptions.length > 0) {
            const sub = subscriptions[0];
            await pool.query(
                'UPDATE subscriptions SET status = "active", paymentStatus = "completed" WHERE id = ?',
                [sub.id]
            );
            console.log(`🎉 [Subscription] Subscription ${sub.id} activated.`);
        }

        res.json({ success: true, message: 'Payment verified and subscription activated' });

    } catch (error) {
        console.error('❌ [Payment] Verification error:', error);
        res.status(500).json({ success: false, message: 'Server error during verification' });
    }
};

module.exports = {
    verifyRazorpayPayment
};
