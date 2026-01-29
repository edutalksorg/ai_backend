const pool = require('../config/db');
const { initiatePayment } = require('../services/phonepeService');

// @desc    Initiate PhonePe payment
// @route   POST /api/v1/payments/phonepe/initiate
// @access  Private
const initiatePhonePe = async (req, res) => {
    try {
        const { amount, orderId } = req.body;
        const userId = req.user.id;

        // Create a transaction record
        const [result] = await pool.query(
            'INSERT INTO transactions (userId, amount, type, providerTransactionId) VALUES (?, ?, ?, ?)',
            [userId, amount, 'payment', orderId]
        );

        const paymentResponse = await initiatePayment(amount, orderId, `USER_${userId}`);

        res.json({
            success: true,
            data: paymentResponse.data,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to initiate payment' });
    }
};

// @desc    Handle PhonePe callback
// @route   POST /api/v1/payments/callback
// @access  Public
const paymentCallback = async (req, res) => {
    try {
        // In a real scenario, verify the checksum here
        const { response } = req.body;
        // Decode base64 response and handle status

        // For now, let's assume it's successful for demonstration if simplified
        // Normally you'd parse the callback from PhonePe

        res.status(200).send('OK');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error');
    }
};

module.exports = {
    initiatePhonePe,
    paymentCallback,
};
