const pool = require('../config/db');

const createPronunciationTable = async () => {
    const query = `
    CREATE TABLE IF NOT EXISTS pronunciation_paragraphs (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        level VARCHAR(50) DEFAULT 'Beginner' CHECK (level IN ('Beginner', 'Intermediate', 'Advanced')),
        instructorId INT NOT NULL,
        isPublished BOOLEAN DEFAULT FALSE,
        isDeleted BOOLEAN DEFAULT FALSE,
        language VARCHAR(50) DEFAULT 'en-US',
        phoneticTranscription TEXT,
        referenceAudioUrl TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (instructorId) REFERENCES users(id) ON DELETE CASCADE
    )`;

    try {
        await pool.query(query);
    } catch (error) {
        console.error('❌ Error creating pronunciation_paragraphs table:', error);
        throw error;
    }
};

module.exports = createPronunciationTable;
