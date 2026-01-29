const pool = require('../config/db');

const createQuizTable = async () => {
    const query = `
    CREATE TABLE IF NOT EXISTS quizzes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      topicId INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      questions JSON,
      FOREIGN KEY (topicId) REFERENCES topics(id) ON DELETE CASCADE
    )
  `;
    await pool.query(query);
};

module.exports = createQuizTable;
