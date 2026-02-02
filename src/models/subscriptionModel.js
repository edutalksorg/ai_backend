const pool = require('../config/db');

const createSubscriptionTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      userId INT NOT NULL,
      planId INT NOT NULL,
      status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
      startDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      endDate TIMESTAMP,
      paymentStatus VARCHAR(50) DEFAULT 'pending' CHECK (paymentStatus IN ('paid', 'pending', 'failed', 'refunded', 'free', 'completed')),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (planId) REFERENCES plans(id)
    )
  `;
  await pool.query(query);
};

module.exports = createSubscriptionTable;
