const pool = require('../config/db');

const createCallHistoryTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS call_history (
      id SERIAL PRIMARY KEY,
      callerId INT NOT NULL,
      calleeId INT NOT NULL,
      channelName VARCHAR(255),
      status VARCHAR(50) DEFAULT 'ringing' CHECK (status IN ('initiated', 'ringing', 'accepted', 'rejected', 'completed', 'missed', 'declined', 'failed', 'busy')),
      durationSeconds INT DEFAULT 0,
      startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      endedAt TIMESTAMP,
      rating INT DEFAULT NULL,
      topicId INT DEFAULT NULL,
      FOREIGN KEY (callerId) REFERENCES users(id),
      FOREIGN KEY (calleeId) REFERENCES users(id),
      FOREIGN KEY (topicId) REFERENCES topics(id)
    )
  `;
  await pool.query(query);

  // Migration: Add topicId and recording_url if they don't exist
  try {
    await pool.query('ALTER TABLE call_history ADD COLUMN IF NOT EXISTS topicId INT REFERENCES topics(id)');
    await pool.query('ALTER TABLE call_history ADD COLUMN IF NOT EXISTS recording_url TEXT');
  } catch (e) {
    console.error('Migration failed for call_history columns:', e.message);
  }
};

module.exports = createCallHistoryTable;
