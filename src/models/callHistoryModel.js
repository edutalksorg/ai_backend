const pool = require('../config/db');

const createCallHistoryTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS call_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      callerId INT NOT NULL,
      calleeId INT NOT NULL,
      channelName VARCHAR(255),
      status ENUM('initiated', 'ringing', 'accepted', 'rejected', 'completed', 'missed', 'declined', 'failed', 'busy') DEFAULT 'ringing',
      durationSeconds INT DEFAULT 0,
      startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      endedAt TIMESTAMP,
      rating INT DEFAULT NULL,
      FOREIGN KEY (callerId) REFERENCES users(id),
      FOREIGN KEY (calleeId) REFERENCES users(id)
    )
  `;
  await pool.query(query);
};

module.exports = createCallHistoryTable;
