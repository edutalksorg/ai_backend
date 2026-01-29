const pool = require('../config/db');

const createCouponTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS coupons (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      description TEXT,
      discountType ENUM('Percentage', 'Flat') NOT NULL,
      discountValue DECIMAL(10, 2) NOT NULL,
      maxDiscountAmount DECIMAL(10, 2) DEFAULT 0,
      minimumPurchaseAmount DECIMAL(10, 2) DEFAULT 0,
      applicableTo ENUM('AllSubscriptions', 'SpecificQuizzes', 'SpecificPlans') DEFAULT 'AllSubscriptions',
      maxTotalUsage INT DEFAULT 1000,
      currentUsageCount INT DEFAULT 0,
      maxUsagePerUser INT DEFAULT 1,
      startDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expiryDate TIMESTAMP,
      status ENUM('Active', 'Inactive') DEFAULT 'Active',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await pool.query(query);

  const usageQuery = `
    CREATE TABLE IF NOT EXISTS coupon_usages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      couponId INT NOT NULL,
      userId INT NOT NULL,
      orderId VARCHAR(255),
      usedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      discountAmount DECIMAL(10, 2),
      FOREIGN KEY (couponId) REFERENCES coupons(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
    `;
  await pool.query(usageQuery);
};

module.exports = createCouponTable;
