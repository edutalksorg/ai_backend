const pool = require('../config/db');

const createInstructorProfileTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS instructor_profiles (
      userId INT PRIMARY KEY,
      bio TEXT,
      expertise JSONB,
      experience VARCHAR(255),
      hourlyRate DECIMAL(10, 2),
      country VARCHAR(100),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `;
  await pool.query(query);
};

module.exports = createInstructorProfileTable;
