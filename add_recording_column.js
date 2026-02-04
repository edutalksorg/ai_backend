const pool = require('./src/config/db');

async function run() {
    try {
        await pool.query('ALTER TABLE call_history ADD COLUMN IF NOT EXISTS recording_url TEXT;');
        console.log('✅ Successfully added recording_url column to call_history');
    } catch (err) {
        console.error('❌ Failed to update database:', err);
    } finally {
        process.exit();
    }
}

run();
