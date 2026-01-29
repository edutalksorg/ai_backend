const pool = require('../config/db');

const createSubscriptionTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      planId INT NOT NULL,
      status ENUM('active', 'expired', 'cancelled', 'pending') DEFAULT 'pending',
      startDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      endDate TIMESTAMP,
      paymentStatus ENUM('paid', 'pending', 'failed', 'refunded') DEFAULT 'pending',
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (planId) REFERENCES plans(id)
    )
  `;
  await pool.query(query);
};

module.exports = createSubscriptionTable;
