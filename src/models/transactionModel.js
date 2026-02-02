const pool = require('../config/db');

const createTransactionTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      userId INT NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      fee DECIMAL(10, 2) DEFAULT 0,
      type VARCHAR(50) NOT NULL CHECK (type IN ('payment', 'withdrawal', 'refund', 'wallet_add', 'credit')),
      status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'initiated', 'completed', 'failed', 'refunded')),
      description TEXT,
      metadata JSONB,
      provider VARCHAR(50) DEFAULT 'Razorpay',
      providerTransactionId VARCHAR(255),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `;
  await pool.query(query);
};

module.exports = createTransactionTable;
