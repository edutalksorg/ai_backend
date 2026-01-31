const { sendPromotionalEmail } = require('./src/services/emailService');
require('dotenv').config();

async function testEmail() {
    const email = 'vineetha@edutalksacademy.in';
    const fullName = 'Test User';
    console.log(`🚀 Sending test promotional email to ${email}...`);
    await sendPromotionalEmail(email, fullName);
    console.log('✅ Test script finished.');
}

testEmail().catch(console.error);
