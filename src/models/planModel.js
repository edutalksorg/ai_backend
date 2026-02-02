const pool = require('../config/db');

const createPlanTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS plans (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10, 2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'INR',
      billingCycle VARCHAR(50) NOT NULL CHECK (billingCycle IN ('Monthly', 'Yearly', 'Quarterly', 'Free')),
      features JSONB,
      isActive BOOLEAN DEFAULT TRUE,
      displayOrder INT DEFAULT 0,
      trialDays INT DEFAULT 0,
      isMostPopular BOOLEAN DEFAULT FALSE,
      marketingTagline VARCHAR(255),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await pool.query(query);
};

module.exports = createPlanTable;
