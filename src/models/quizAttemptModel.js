const pool = require('../config/db');

const createQuizAttemptTable = async () => {
    const query = `
    CREATE TABLE IF NOT EXISTS quiz_attempts (
        id SERIAL PRIMARY KEY,
        userId INT NOT NULL,
        quizId INT NOT NULL,
        score DECIMAL(5, 2) DEFAULT 0,
        totalQuestions INT DEFAULT 0,
        correctAnswers INT DEFAULT 0,
        answers JSONB,
        startedAt TIMESTAMP,
        completedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        feedback TEXT,
        rating INT,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (quizId) REFERENCES quizzes(id) ON DELETE CASCADE
    )`;

    try {
        await pool.query(query);
    } catch (error) {
        console.error('❌ Error creating quiz_attempts table:', error);
        throw error;
    }
};

module.exports = createQuizAttemptTable;
