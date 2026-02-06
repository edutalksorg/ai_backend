const pool = require('./src/config/db');

async function expireSubscriptions() {
    try {
        console.log('Expiring past-due subscriptions...');

        const result = await pool.query(
            "UPDATE subscriptions SET status = 'expired' WHERE status = 'active' AND enddate < NOW()"
        );

        console.log('Successfully expired ' + result.rowCount + ' subscriptions.');

        const { rows } = await pool.query(
            "SELECT userid, planid, status, enddate FROM subscriptions WHERE status = 'expired' ORDER BY enddate DESC LIMIT 5"
        );

        console.log('Sample expired subscriptions:');
        console.table(rows);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

expireSubscriptions();
