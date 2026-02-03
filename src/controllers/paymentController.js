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
