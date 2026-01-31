const cron = require('node-cron');
const pool = require('../config/db');

// Run every hour
const startTrialExpirationJob = () => {
    cron.schedule('0 * * * *', async () => {
        console.log('⏳ Checking for expired free trials...');
        try {
            // Find "Free Trial" plan ID
            const [plans] = await pool.query('SELECT id FROM plans WHERE name = "Free Trial" LIMIT 1');
            if (plans.length === 0) return;

            const planId = plans[0].id;

            // Update subscriptions that have passed their endDate
            const [result] = await pool.query(
                'UPDATE subscriptions SET status = "expired" WHERE planId = ? AND status = "active" AND endDate < NOW()',
                [planId]
            );

            if (result.affectedRows > 0) {
                console.log(`✅ Expired ${result.affectedRows} free trials.`);
            }
        } catch (error) {
            console.error('❌ Error checking trial expiration:', error);
        }
    });
};

module.exports = startTrialExpirationJob;
