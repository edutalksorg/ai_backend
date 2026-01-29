const pool = require('../config/db');

const createTransactionTable = async () => {
    const query = `
    CREATE TABLE IF NOT EXISTS transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      type ENUM('payment', 'withdrawal', 'refund', 'wallet_add') NOT NULL,
      status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
      provider VARCHAR(50) DEFAULT 'PhonePe',
      providerTransactionId VARCHAR(255),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `;
    await pool.query(query);
};

module.exports = createTransactionTable;
