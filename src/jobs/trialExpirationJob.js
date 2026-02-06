const cron = require('node-cron');
const pool = require('../config/db');

// Run every hour
const startTrialExpirationJob = () => {
    cron.schedule('0 * * * *', async () => {
        console.log('⏳ Checking for expired free trials...');
        try {
            // Find "Free Trial" plan ID
            const { rows: plans } = await pool.query('SELECT id FROM plans WHERE name = \'Free Trial\' LIMIT 1');
            if (plans.length === 0) return;

            const planId = plans[0].id;

            // Update subscriptions that have passed their endDate
            const result = await pool.query(
                'UPDATE subscriptions SET status = \'expired\' WHERE planid = $1 AND status = \'active\' AND enddate < NOW()',
                [planId]
            );

            if (result.rowCount > 0) {
                console.log(`✅ Expired ${result.rowCount} free trials.`);
            }
        } catch (error) {
            console.error('❌ Error checking trial expiration:', error);
        }
    });
};

module.exports = startTrialExpirationJob;
