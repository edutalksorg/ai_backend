const pool = require('./src/config/db');

async function fixAllTrials() {
    try {
        console.log('🔧 Fixing all premature trial expirations...');

        // Find users registered in last 24h
        const [users] = await pool.query(
            `SELECT u.id, u.createdAt, s.id as subId, s.endDate, s.status 
             FROM users u 
             JOIN subscriptions s ON u.id = s.userId 
             JOIN plans p ON s.planId = p.id
             WHERE p.name = 'Free Trial' 
             AND u.createdAt > (NOW() - INTERVAL 24 HOUR)`
        );

        let fixedCount = 0;

        for (const user of users) {
            // Calculate correct expiry: Created Time + 24h
            const correctExpiry = new Date(new Date(user.createdAt).getTime() + 24 * 60 * 60 * 1000);

            // If the current endDate is WRONG (e.g. expired or too short), fix it
            if (new Date(user.endDate) < correctExpiry || user.status !== 'active') {
                await pool.query(
                    'UPDATE subscriptions SET endDate = ?, status = "active" WHERE id = ?',
                    [correctExpiry, user.subId]
                );
                fixedCount++;
            }
        }

        console.log(`✅ Fixed ${fixedCount} users' trials.`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

fixAllTrials();
