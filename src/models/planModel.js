const pool = require('../config/db');

const createPlanTable = async () => {
    const query = `
    CREATE TABLE IF NOT EXISTS plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10, 2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'INR',
      billingCycle ENUM('Monthly', 'Yearly', 'Quarterly') NOT NULL,
      features JSON,
      isActive BOOLEAN DEFAULT TRUE,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
    await pool.query(query);
};

module.exports = createPlanTable;
