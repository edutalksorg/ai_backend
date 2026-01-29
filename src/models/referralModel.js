const pool = require('../config/db');

const createReferralTable = async () => {
    const query = `
    CREATE TABLE IF NOT EXISTS referrals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      referrerId INT NOT NULL,
      referredUserId INT UNIQUE,
      referralCode VARCHAR(50) NOT NULL,
      status ENUM('pending', 'completed') DEFAULT 'pending',
      rewardAmount DECIMAL(10, 2) DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (referrerId) REFERENCES users(id),
      FOREIGN KEY (referredUserId) REFERENCES users(id)
    )
  `;
    await pool.query(query);
};

module.exports = createReferralTable;
