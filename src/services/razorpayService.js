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

/**
 * Create a Contact for RazorpayX Payouts
 * @param {Object} user - User details (fullName, email, phoneNumber)
 * @returns {Promise<string>} Contact ID
 */
const createContact = async (user) => {
    try {
        const contact = await razorpay.contacts.create({
            name: user.fullName,
            email: user.email,
            contact: user.phoneNumber || "9999999999",
            type: "customer",
            reference_id: user.id.toString()
        });
        return contact.id;
    } catch (error) {
        console.error('❌ [RazorpayX] Create Contact Error:', error);
        throw new Error('Failed to create RazorpayX contact: ' + (error.error?.description || error.message));
    }
};

/**
 * Create a Fund Account for a Contact
 * @param {string} contactId - RazorpayX Contact ID
 * @param {Object} bankDetails - User's bank details
 * @returns {Promise<string>} Fund Account ID
 */
const createFundAccount = async (contactId, bankDetails) => {
    try {
        const options = {
            contact_id: contactId,
            account_type: "bank_account",
            bank_account: {
                name: bankDetails.accountHolderName,
                ifsc: bankDetails.ifsc,
                account_number: bankDetails.accountNumber
            }
        };
        const fundAccount = await razorpay.fundAccount.create(options);
        return fundAccount.id;
    } catch (error) {
        console.error('❌ [RazorpayX] Create Fund Account Error:', error);
        throw new Error('Failed to create fund account: ' + (error.error?.description || error.message));
    }
};

/**
 * Initiate a Payout via RazorpayX
 * @param {number} amount - Amount in rupees
 * @param {string} fundAccountId - RazorpayX Fund Account ID
 * @param {string} referenceId - Internal Transaction ID
 * @returns {Promise<Object>} Payout Details
 */
const createPayout = async (amount, fundAccountId, referenceId) => {
    try {
        const options = {
            account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER,
            fund_account_id: fundAccountId,
            amount: Math.round(amount * 100), // Convert to paisa
            currency: "INR",
            mode: "IMPS", // Can be IMPS, NEFT, RTGS, UPI
            purpose: "payout",
            queue_if_low_balance: true,
            reference_id: referenceId.toString(),
            narration: "Withdrawal Payout"
        };
        const payout = await razorpay.payouts.create(options);
        return payout;
    } catch (error) {
        console.error('❌ [RazorpayX] Create Payout Error:', error);
        throw new Error('Failed to initiate payout: ' + (error.error?.description || error.message));
    }
};

module.exports = {
    createOrder,
    verifyPaymentSignature,
    createContact,
    createFundAccount,
    createPayout
};
