const pool = require('../config/db');

const createPermissionTable = async () => {
    const query = `
    CREATE TABLE IF NOT EXISTS permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      displayName VARCHAR(255) NOT NULL,
      module VARCHAR(100) NOT NULL,
      action VARCHAR(100) NOT NULL,
      description TEXT
    )
  `;
    await pool.query(query);
};

module.exports = createPermissionTable;
