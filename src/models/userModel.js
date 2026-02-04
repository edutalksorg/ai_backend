const pool = require('../config/db');

const createUserTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      fullName VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      phoneNumber VARCHAR(20),
      role VARCHAR(50) DEFAULT 'User' CHECK (role IN ('SuperAdmin', 'Admin', 'Instructor', 'User')),
      isApproved BOOLEAN DEFAULT FALSE,
      isVerified BOOLEAN DEFAULT FALSE,
      verificationToken VARCHAR(255),
      verificationTokenExpires TIMESTAMP NULL,
      avatarUrl VARCHAR(255),
      walletBalance DECIMAL(10, 2) DEFAULT 0.00,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(50) DEFAULT 'Offline' CHECK (status IN ('Online', 'Offline', 'Busy')),
      lastActiveAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      referralCode VARCHAR(50) UNIQUE,
      resetPasswordToken VARCHAR(255),
      resetPasswordExpire TIMESTAMP,
      registrationMethod VARCHAR(50) DEFAULT 'organic',
      registrationCode VARCHAR(50),
      usedCouponCode VARCHAR(50)
    )
  `;
  await pool.query(query);
};

module.exports = createUserTable;
