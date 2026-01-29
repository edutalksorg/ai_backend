const pool = require('../config/db');

const createUserProgressTable = async () => {
    const query = `
    CREATE TABLE IF NOT EXISTS user_progress (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      topicId INT NOT NULL,
      status ENUM('in_progress', 'completed') DEFAULT 'in_progress',
      progressPercentage DECIMAL(5, 2) DEFAULT 0.00,
      startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completedAt TIMESTAMP NULL,
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (topicId) REFERENCES topics(id)
    )
  `;
    await pool.query(query);
};

module.exports = createUserProgressTable;
