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

        // 1. Verify Signature
        const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        // 2. Find Transaction
        const { rows: pendingTx } = await pool.query(
            `SELECT * FROM transactions WHERE userId = $1 AND status = 'pending' AND type = 'payment' ORDER BY "createdAt" DESC LIMIT 1`,
            [userId]
        ); // Status values in single quotes

        let transactionId = null;

        if (pendingTx.length > 0) {
            transactionId = pendingTx[0].id;
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
            `SELECT * FROM subscriptions WHERE userId = $1 AND status = 'pending' ORDER BY "createdAt" DESC LIMIT 1`,
            [userId]
        );

        if (subscriptions.length > 0) {
            const sub = subscriptions[0];
            await pool.query(
                'UPDATE subscriptions SET status = \'active\', paymentStatus = \'completed\' WHERE id = $1',
                [sub.id]
            );
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
