const pool = require('./src/config/db');
const { sendPromotionalEmail } = require('./src/services/emailService');
require('dotenv').config();

async function runManualPromotion() {
    console.log('⏳ MANUALLY TRIGGERING promotional email task...');
    try {
        // Fetch only regular students (role = 'User')
        const [users] = await pool.query('SELECT fullName, email FROM users WHERE role = "User"');

        console.log(`ℹ️  Targeting ${users.length} regular users for promotions.`);

        for (const user of users) {
            if (!user.email) continue;

            console.log(`📧 Attempting to send promotion to: ${user.email} (${user.fullName})`);
            await sendPromotionalEmail(user.email, user.fullName);

            // Small delay to avoid Gmail rate limiting/spam detection
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('✅ Manual promotional email task completed.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error in manual promotional email task:', error);
        process.exit(1);
    }
}

runManualPromotion();
