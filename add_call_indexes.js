const pool = require('./src/config/db');

async function addIndexes() {
    try {
        console.log('Starting index creation...');

        // calls by caller/callee
        await pool.query('CREATE INDEX IF NOT EXISTS idx_call_history_callerid ON call_history(callerid)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_call_history_calleeid ON call_history(calleeid)');

        // calls by date (for sorting)
        await pool.query('CREATE INDEX IF NOT EXISTS idx_call_history_startedat ON call_history(startedat DESC)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_call_history_created_at ON call_history(created_at DESC)');

        // combined for searching/filtering often used together
        await pool.query('CREATE INDEX IF NOT EXISTS idx_call_history_status ON call_history(status)');

        console.log('✅ Indexes created successfully!');
    } catch (err) {
        console.error('❌ Error creating indexes:', err);
    } finally {
        pool.end();
    }
}

addIndexes();
