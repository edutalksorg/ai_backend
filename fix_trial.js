const pool = require('./src/config/db');

async function fixTrial() {
    try {
        const email = 'vineethabusireddy52@gmail.com'; // User's email

        console.log(`Fixing trial for ${email}...`);

        const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            console.log('User not found!');
            process.exit(1);
        }
        const userId = users[0].id;

        // 1. Extend the subscription end date to 24 hours from NOW (to give them a fresh full day)
        const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await pool.query(
            'UPDATE subscriptions SET endDate = ?, status = "active" WHERE userId = ? AND planId = (SELECT id FROM plans WHERE name = "Free Trial" LIMIT 1)',
            [expiry, userId]
        );

        console.log(`✅ Updated subscription endDate to ${expiry}`);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

fixTrial();
