const pool = require('../config/db');

const createRolePermissionTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS role_permissions (
      role VARCHAR(50) NOT NULL CHECK (role IN ('SuperAdmin', 'Admin', 'Instructor', 'User')),
      permissionId INT NOT NULL,
      PRIMARY KEY (role, permissionId),
      FOREIGN KEY (permissionId) REFERENCES permissions(id) ON DELETE CASCADE
    )
  `;
  await pool.query(query);
};

module.exports = createRolePermissionTable;
