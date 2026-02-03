const pool = require('../config/db');

const createUserConnectionTable = async () => {
    const query = `
    CREATE TABLE IF NOT EXISTS user_connections (
      id SERIAL PRIMARY KEY,
      requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(requester_id, recipient_id)
    )
  `;
    try {
        await pool.query(query);
        console.log('✅ User Connections table initialized.');
    } catch (error) {
        console.error('❌ Error creating User Connections table:', error);
        throw error;
    }
};

module.exports = createUserConnectionTable;
