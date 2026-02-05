const pool = require('../config/db');

const createCouponTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS coupons (
      id SERIAL PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      description TEXT,
      discountType VARCHAR(50) NOT NULL CHECK (discountType IN ('Percentage', 'Flat')),
      discountValue DECIMAL(10, 2) NOT NULL,
      maxDiscountAmount DECIMAL(10, 2) DEFAULT 0,
      minimumPurchaseAmount DECIMAL(10, 2) DEFAULT 0,
      applicableTo VARCHAR(50) DEFAULT 'AllSubscriptions' CHECK (applicableTo IN ('AllSubscriptions', 'SpecificQuizzes', 'SpecificPlans')),
      maxTotalUsage INT DEFAULT 1000,
      currentUsageCount INT DEFAULT 0,
      maxUsagePerUser INT DEFAULT 1,
      startDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expiryDate TIMESTAMP,
      status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await pool.query(query);

  const usageQuery = `
    CREATE TABLE IF NOT EXISTS coupon_usages (
      id SERIAL PRIMARY KEY,
      couponId INT NOT NULL,
      userId INT NOT NULL,
      orderId VARCHAR(255),
      status VARCHAR(50) DEFAULT 'pending',
      usedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      discountAmount DECIMAL(10, 2),
      FOREIGN KEY (couponId) REFERENCES coupons(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `;
  await pool.query(usageQuery);

  // Ensure 'status' column exists for existing tables
  await pool.query(`
    ALTER TABLE coupon_usages ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending'
  `);
};

module.exports = createCouponTable;
