const pool = require('../config/db');

const createTopicTable = async () => {
    const query = `
    CREATE TABLE IF NOT EXISTS topics (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      instructorId INT NOT NULL,
      status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
      isFeatured BOOLEAN DEFAULT FALSE,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (instructorId) REFERENCES users(id)
    )
  `;
    await pool.query(query);
};

module.exports = createTopicTable;
