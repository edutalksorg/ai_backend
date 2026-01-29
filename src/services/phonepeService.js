const axios = require('axios');
const crypto = require('crypto');

const initiatePayment = async (amount, transactionId, merchantUserId) => {
    const payload = {
        merchantId: process.env.PHONEPE_MERCHANT_ID,
        merchantTransactionId: transactionId,
        merchantUserId: merchantUserId,
        amount: amount * 100, // in paisa
        redirectUrl: process.env.PHONEPE_REDIRECT_URL,
        redirectMode: 'POST',
        callbackUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/v1/payments/callback`,
        paymentInstrument: {
            type: 'PAY_PAGE',
        },
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const stringToSign = base64Payload + '/pg/v1/pay' + process.env.PHONEPE_SALT_KEY;
    const sha256 = crypto.createHash('sha256').update(stringToSign).digest('hex');
    const checksum = sha256 + '###1';

    try {
        const response = await axios.post(
            process.env.PHONEPE_API_URL,
            { request: base64Payload },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-VERIFY': checksum,
                },
            }
        );

        return response.data;
    } catch (error) {
        console.error('PhonePe Initiation Error:', error.response?.data || error.message);
        throw error;
    }
};

module.exports = { initiatePayment };
