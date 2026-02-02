const pool = require('../config/db');

const createTopicTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS topics (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      content TEXT,
      category VARCHAR(100) DEFAULT 'General',
      difficulty VARCHAR(50) DEFAULT 'Beginner' CHECK (difficulty IN ('Beginner', 'Intermediate', 'Advanced')),
      estimatedTime INT DEFAULT 15,
      imageUrl TEXT,
      vocabularyList JSONB,
      discussionPoints JSONB,
      instructorId INT NOT NULL,
      status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
      isFeatured BOOLEAN DEFAULT FALSE,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (instructorId) REFERENCES users(id)
    )
  `;
  await pool.query(query);
};

module.exports = createTopicTable;