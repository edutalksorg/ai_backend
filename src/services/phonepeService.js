const axios = require('axios');
const crypto = require('crypto');

/**
 * Initiate a PhonePe payment
 * @param {number} amount - Amount in rupees
 * @param {string} transactionId - Unique transaction ID
 * @param {string} merchantUserId - User identifier
 * @returns {Promise<Object>} Payment response with redirect URL
 */
const initiatePayment = async (amount, transactionId, merchantUserId, mobileNumber) => {
    const merchantId = process.env.PHONEPE_MERCHANT_ID;
    const saltKey = process.env.PHONEPE_SALT_KEY;
    const saltIndex = process.env.PHONEPE_SALT_INDEX || 1;

    const payload = {
        merchantId: merchantId,
        merchantTransactionId: transactionId,
        merchantUserId: merchantUserId,
        amount: Math.round(amount * 100), // Convert to paisa
        redirectUrl: process.env.PHONEPE_REDIRECT_URL
            ? `${process.env.PHONEPE_REDIRECT_URL}?transactionId=${transactionId}`
            : `${process.env.FRONTEND_URL}/subscriptions?transactionId=${transactionId}`,
        redirectMode: 'REDIRECT',
        callbackUrl: `${process.env.BACKEND_URL}/api/v1/payments/callback`,
        mobileNumber: mobileNumber || '9999999999',
        paymentInstrument: {
            type: 'PAY_PAGE',
        },
    };

    console.log('📱 [PhonePe] Initiating payment:', {
        transactionId,
        amount: payload.amount,
        merchantId: merchantId,
    });

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');

    // Extract dynamic path from the full URL (handles /apis/hermes prefix automatically)
    const apiEndpoint = new URL(process.env.PHONEPE_API_URL).pathname;
    console.log(`🔐 [PhonePe] Using API Path for Checksum: ${apiEndpoint}`);
    const stringToSign = base64Payload + apiEndpoint + saltKey;
    const sha256 = crypto.createHash('sha256').update(stringToSign).digest('hex');
    const checksum = sha256 + '###' + saltIndex;

    // Generate cURL for debugging
    const curlCmd = `curl -X POST "${process.env.PHONEPE_API_URL}" \\
    -H "Content-Type: application/json" \\
    -H "X-VERIFY: ${checksum}" \\
    -d '{"request": "${base64Payload}"}'`;
    console.log('🐞 [Debug] Run this cURL to verify:\n', curlCmd);

    console.log('🔍 [PhonePe] Checksum (X-VERIFY) generated');

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

        console.log('✅ [PhonePe] Payment initiated successfully:', {
            code: response.data.code,
            success: response.data.success,
        });

        return {
            success: response.data.success,
            code: response.data.code,
            message: response.data.message,
            data: {
                instrumentResponse: response.data.data?.instrumentResponse,
                redirectUrl: response.data.data?.instrumentResponse?.redirectInfo?.url,
            }
        };
    } catch (error) {
        console.error('❌ [PhonePe] Payment initiation error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to initiate payment');
    }
};

/**
 * Check payment status from PhonePe
 * @param {string} merchantTransactionId - Transaction ID to check
 * @returns {Promise<Object>} Payment status
 */
const checkPaymentStatus = async (merchantTransactionId) => {
    const merchantId = process.env.PHONEPE_MERCHANT_ID;
    const saltKey = process.env.PHONEPE_SALT_KEY;
    const saltIndex = process.env.PHONEPE_SALT_INDEX || 1;
    const baseUrl = process.env.PHONEPE_API_BASE_URL;
    const statusEndpoint = `/pg/v1/status/${merchantId}/${merchantTransactionId}`;
    const statusUrl = `${baseUrl}${statusEndpoint}`;

    // Extract full path for checksum (in case baseUrl includes /apis/hermes)
    const statusPathForChecksum = new URL(statusUrl).pathname;

    const stringToSign = statusPathForChecksum + saltKey;
    const sha256 = crypto.createHash('sha256').update(stringToSign).digest('hex');
    const checksum = sha256 + '###' + saltIndex;

    console.log('🔍 [PhonePe] Checking payment status:', merchantTransactionId);

    try {
        const response = await axios.get(statusUrl, {
            headers: {
                'Content-Type': 'application/json',
                'X-VERIFY': checksum,
                'X-MERCHANT-ID': merchantId,
            },
        });

        console.log('✅ [PhonePe] Status check response:', {
            code: response.data.code,
            state: response.data.data?.state,
        });

        return {
            success: response.data.success,
            code: response.data.code,
            message: response.data.message,
            data: response.data.data,
            state: response.data.data?.state, // COMPLETED, FAILED, PENDING
            amount: response.data.data?.amount ? response.data.data.amount / 100 : 0,
            transactionId: response.data.data?.transactionId,
        };
    } catch (error) {
        console.error('❌ [PhonePe] Status check error:', error.response?.data || error.message);

        // If transaction not found, return pending status
        if (error.response?.status === 400) {
            return {
                success: false,
                code: 'PAYMENT_PENDING',
                state: 'PENDING',
                message: 'Payment is being processed',
            };
        }

        throw new Error(error.response?.data?.message || 'Failed to check payment status');
    }
};

/**
 * Verify PhonePe callback signature
 * @param {string} base64Response - Base64 encoded response from PhonePe
 * @param {string} receivedChecksum - X-VERIFY header value
 * @returns {Object} Decoded and verified response
 */
const verifyCallback = (base64Response, receivedChecksum) => {
    const saltKey = process.env.PHONEPE_SALT_KEY;
    const saltIndex = process.env.PHONEPE_SALT_INDEX || 1;

    // Calculate checksum
    const stringToSign = base64Response + saltKey;
    const sha256 = crypto.createHash('sha256').update(stringToSign).digest('hex');
    const expectedChecksum = sha256 + '###' + saltIndex;

    console.log('🔐 [PhonePe] Verifying callback checksum');

    if (expectedChecksum !== receivedChecksum) {
        console.error('❌ [PhonePe] Checksum verification failed');
        throw new Error('Invalid callback signature');
    }

    // Decode the response
    const decodedResponse = Buffer.from(base64Response, 'base64').toString('utf-8');
    const responseData = JSON.parse(decodedResponse);

    console.log('✅ [PhonePe] Callback verified successfully:', {
        state: responseData.data?.state,
        transactionId: responseData.data?.merchantTransactionId,
    });

    return responseData;
};

module.exports = {
    initiatePayment,
    checkPaymentStatus,
    verifyCallback
};
