const pool = require('../config/db');

const createUserTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fullName VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      phoneNumber VARCHAR(20),
      role ENUM('SuperAdmin', 'Admin', 'Instructor', 'User') DEFAULT 'User',
      isApproved BOOLEAN DEFAULT FALSE,
      isVerified BOOLEAN DEFAULT FALSE,
      verificationToken VARCHAR(255),
      verificationTokenExpires TIMESTAMP NULL,
      avatarUrl VARCHAR(255),
      walletBalance DECIMAL(10, 2) DEFAULT 0.00,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;
  await pool.query(query);
};

module.exports = createUserTable;
