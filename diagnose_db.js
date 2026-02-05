const pool = require('./src/config/db');
const fs = require('fs');

async function check() {
    try {
        const { rows: connections } = await pool.query('SELECT * FROM user_connections ORDER BY id DESC LIMIT 50');

        const results = {
            connections,
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync('db_diagnostic.json', JSON.stringify(results, null, 2));
        console.log('✅ Diagnostic results written to db_diagnostic.json');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
