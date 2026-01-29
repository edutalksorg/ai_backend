const pool = require('../config/db');

const createRolePermissionTable = async () => {
    const query = `
    CREATE TABLE IF NOT EXISTS role_permissions (
      role ENUM('SuperAdmin', 'Admin', 'Instructor', 'User') NOT NULL,
      permissionId INT NOT NULL,
      PRIMARY KEY (role, permissionId),
      FOREIGN KEY (permissionId) REFERENCES permissions(id) ON DELETE CASCADE
    )
  `;
    await pool.query(query);
};

module.exports = createRolePermissionTable;
