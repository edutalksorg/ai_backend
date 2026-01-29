const cron = require('node-cron');
const pool = require('../config/db');

// Task to run every day at midnight to check for expired subscriptions
const subscriptionExpiryTask = cron.schedule('0 0 * * *', async () => {
    console.log('⏳ Running subscription expiry check...');
    try {
        const [result] = await pool.query(
            'UPDATE subscriptions SET status = "expired" WHERE endDate < NOW() AND status = "active"'
        );
        console.log(`✅ Expired ${result.affectedRows} subscriptions.`);
    } catch (error) {
        console.error('❌ Error in subscription expiry task:', error);
    }
});

module.exports = { subscriptionExpiryTask };
