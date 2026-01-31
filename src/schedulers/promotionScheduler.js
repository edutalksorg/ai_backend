const cron = require('node-cron');
const pool = require('../config/db');
const { sendPromotionalEmail } = require('../services/emailService');

// Task to run every day at 10:00 AM
// Cron format: minute hour day-of-month month day-of-week
const promotionTask = cron.schedule('20 10 * * *', async () => {
    console.log('⏳ Running daily promotional email task (10:00 AM)...');
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

        console.log('✅ Daily promotional email task completed.');
    } catch (error) {
        console.error('❌ Error in promotional email task:', error);
    }
});

module.exports = { promotionTask };
