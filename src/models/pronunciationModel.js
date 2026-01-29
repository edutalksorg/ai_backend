const pool = require('../config/db');

const createPronunciationTable = async () => {
    const query = `
    CREATE TABLE IF NOT EXISTS pronunciation_paragraphs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        level ENUM('Beginner', 'Intermediate', 'Advanced') DEFAULT 'Beginner',
        instructorId INT NOT NULL,
        isPublished BOOLEAN DEFAULT FALSE,
        isDeleted BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (instructorId) REFERENCES users(id) ON DELETE CASCADE
    )`;

    try {
        await pool.query(query);
        console.log('✅ Pronunciation Paragraphs table ready');
    } catch (error) {
        console.error('❌ Error creating pronunciation_paragraphs table:', error);
        throw error;
    }
};

module.exports = createPronunciationTable;
