const pool = require('../config/db');

const createTransactionTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      fee DECIMAL(10, 2) DEFAULT 0,
      type ENUM('payment', 'withdrawal', 'refund', 'wallet_add', 'credit') NOT NULL,
      status ENUM('pending', 'initiated', 'completed', 'failed', 'refunded') DEFAULT 'pending',
      description TEXT,
      metadata JSON,
      provider VARCHAR(50) DEFAULT 'Razorpay',
      providerTransactionId VARCHAR(255),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `;
  await pool.query(query);
};

module.exports = createTransactionTable;
