
const pool = require('../config/db');

const addGrammarDataColumn = async () => {
    try {
        console.log('🚀 Adding grammarData column to topics table...');
        const query = `
      ALTER TABLE topics 
      ADD COLUMN IF NOT EXISTS grammarData JSONB;
    `;
        await pool.query(query);
        console.log('✅ grammarData column added successfully.');
    } catch (error) {
        console.error('❌ Failed to add grammarData column:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
};

addGrammarDataColumn();
