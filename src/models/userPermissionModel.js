const pool = require('../config/db');

const createUserPermissionTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS user_permissions (
      userId INT NOT NULL,
      permissionId INT NOT NULL,
      type VARCHAR(50) NOT NULL CHECK (type IN ('grant', 'revoke')),
      PRIMARY KEY (userId, permissionId),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (permissionId) REFERENCES permissions(id) ON DELETE CASCADE
    )
  `;
  await pool.query(query);
};

module.exports = createUserPermissionTable;
