const pool = require('../config/db');

const createQuizTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS quizzes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      topicId INT,
      instructorId INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      questions JSON,
      duration INT DEFAULT 30,
      passingScore INT DEFAULT 60,
      difficulty ENUM('Beginner', 'Intermediate', 'Advanced') DEFAULT 'Beginner',
      categoryId VARCHAR(100),
      isPublished BOOLEAN DEFAULT FALSE,
      isDeleted BOOLEAN DEFAULT FALSE,
      timeLimitMinutes INT DEFAULT 20,
      maxAttempts INT DEFAULT 2,
      randomizeQuestions BOOLEAN DEFAULT TRUE,
      showCorrectAnswers BOOLEAN DEFAULT TRUE,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (topicId) REFERENCES topics(id) ON DELETE SET NULL,
      FOREIGN KEY (instructorId) REFERENCES users(id) ON DELETE CASCADE
    )
  `;
  await pool.query(query);
};

module.exports = createQuizTable;