const pool = require('./src/config/db');

const fixUsersSchema = async () => {
    console.log('🚀 Starting users table schema update...');
    try {
        const queries = [
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS registrationMethod VARCHAR(50) DEFAULT \'organic\'',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS registrationCode VARCHAR(50)',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS usedCouponCode VARCHAR(50)',
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS referrerName VARCHAR(255)'
        ];

        for (const query of queries) {
            console.log(`Executing: ${query}`);
            await pool.query(query);
        }

        console.log('✅ Users table updated successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating users table:', error.message);
        process.exit(1);
    }
};

fixUsersSchema();
