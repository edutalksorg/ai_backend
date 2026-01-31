const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Create a Razorpay Order
 * @param {number} amount - Amount in rupees
 * @param {string} receiptId - Internal Unique Receipt/Transaction ID
 * @returns {Promise<Object>} Order Details
 */
const createOrder = async (amount, receiptId) => {
    try {
        const options = {
            amount: Math.round(amount * 100), // Convert to paisa
            currency: "INR",
            receipt: receiptId,
            payment_capture: 1 // Auto capture
        };
        const order = await razorpay.orders.create(options);
        return order;
    } catch (error) {
        console.error('❌ [Razorpay] Create Order Error:', error);
        throw new Error('Failed to create Razorpay order');
    }
};

/**
 * Verify Razorpay Payment Signature
 * @param {string} orderId - Razorpay Order ID
 * @param {string} paymentId - Razorpay Payment ID
 * @param {string} signature - Razorpay Signature
 * @returns {boolean} isValid
 */
const verifyPaymentSignature = (orderId, paymentId, signature) => {
    const body = orderId + "|" + paymentId;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

    const isValid = expectedSignature === signature;
    if (!isValid) {
        console.error('❌ [Razorpay] Invalid Signature');
    }
    return isValid;
};

module.exports = {
    createOrder,
    verifyPaymentSignature
};
