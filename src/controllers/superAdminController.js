const pool = require('../config/db');

// @desc    Get all permissions
// @route   GET /api/v1/superadmin/permissions
// @access  Private (SuperAdmin)
const getAllPermissions = async (req, res) => {
    try {
        // Postgres unquoted columns are lowercase. Alias them for frontend consistency.
        const { rows: permissions } = await pool.query(
            `SELECT id, name, displayname as "displayName", module, action, description 
             FROM permissions`
        );
        res.json({ success: true, data: permissions });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get user permission overrides
// @route   GET /api/v1/superadmin/users/:id/permissions
// @access  Private (SuperAdmin)
const getUserPermissions = async (req, res) => {
    try {
        const userId = req.params.id;

        const { rows: users } = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
        const userRole = users[0]?.role || 'User';

        const { rows: userPerms } = await pool.query(
            'SELECT p.name, up.type FROM user_permissions up JOIN permissions p ON up.permissionid = p.id WHERE up.userid = $1',
            [userId]
        );

        const { rows: rolePerms } = await pool.query(
            'SELECT p.name FROM role_permissions rp JOIN permissions p ON rp.permissionid = p.id WHERE rp.role = $1',
            [userRole]
        );

        const grantedPermissions = userPerms
            .filter(up => up.type === 'grant')
            .map(up => up.name);

        const revokedPermissions = userPerms
            .filter(up => up.type === 'revoke')
            .map(up => up.name);

        const rolePermissions = rolePerms.map(rp => rp.name);

        res.json({
            success: true,
            data: {
                userId,
                role: userRole,
                rolePermissions,
                grantedPermissions,
                revokedPermissions,
                // Calculated effective permissions logic can be done on frontend or repeated here if needed
                // Keeping original response structure
                effectivePermissions: [...new Set([...rolePermissions, ...grantedPermissions])].filter(p => !revokedPermissions.includes(p))
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update user permission override (Single or Bulk)
// @route   POST /api/v1/superadmin/users/:id/permissions
// @access  Private (SuperAdmin)
const updateUserPermission = async (req, res) => {
    try {
        const userId = req.params.id;
        const { grantPermissions, revokePermissions } = req.body;

        // Bulk Update
        if (grantPermissions || revokePermissions) {
            const toGrant = grantPermissions || [];
            const toRevoke = revokePermissions || [];

            // Grant
            if (toGrant.length > 0) {
                // Postgres ANY($1) for array
                const { rows: perms } = await pool.query('SELECT id, name FROM permissions WHERE name = ANY($1)', [toGrant]);
                for (const p of perms) {
                    await pool.query(
                        `INSERT INTO user_permissions (userid, permissionid, type) 
                         VALUES ($1, $2, 'grant') 
                         ON CONFLICT (userid, permissionid) DO UPDATE SET type = 'grant'`,
                        [userId, p.id]
                    );
                }
            }

            // Revoke
            if (toRevoke.length > 0) {
                const { rows: perms } = await pool.query('SELECT id, name FROM permissions WHERE name = ANY($1)', [toRevoke]);
                for (const p of perms) {
                    await pool.query(
                        `INSERT INTO user_permissions (userid, permissionid, type) 
                         VALUES ($1, $2, 'revoke') 
                         ON CONFLICT (userid, permissionid) DO UPDATE SET type = 'revoke'`,
                        [userId, p.id]
                    );
                }
            }
            return res.json({ success: true, message: 'User permissions updated' });
        }

        // Single Update (Legacy)
        let { permissionId, type, permissionName } = req.body;

        if (permissionName && !permissionId) {
            const { rows: perms } = await pool.query('SELECT id FROM permissions WHERE name = $1', [permissionName]);
            if (perms.length > 0) permissionId = perms[0].id;
            else return res.status(404).json({ message: 'Permission not found' });
        }

        if (!type) {
            await pool.query('DELETE FROM user_permissions WHERE userid = $1 AND permissionid = $2', [userId, permissionId]);
        } else {
            await pool.query(
                `INSERT INTO user_permissions (userid, permissionid, type) VALUES ($1, $2, $3) 
                 ON CONFLICT (userid, permissionid) DO UPDATE SET type = $4`,
                [userId, permissionId, type, type]
            );
        }

        res.json({ success: true, message: 'User permission updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const grantUserPermission = async (req, res) => {
    req.body.type = 'grant';
    return updateUserPermission(req, res);
};

const revokeUserPermission = async (req, res) => {
    req.body.type = 'revoke';
    return updateUserPermission(req, res);
};

const resetUserPermissions = async (req, res) => {
    try {
        const userId = req.params.id;
        await pool.query('DELETE FROM user_permissions WHERE userid = $1', [userId]);
        res.json({ success: true, message: 'User permissions reset' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getRolePermissions = async (req, res) => {
    try {
        const { id: roleName } = req.params;

        const { rows: rolePerms } = await pool.query(`
            SELECT p.name 
            FROM role_permissions rp 
            JOIN permissions p ON rp.permissionid = p.id 
            WHERE rp.role = $1
        `, [roleName]);

        const permissionNames = rolePerms.map(p => p.name);

        res.json({
            success: true,
            data: {
                roleId: roleName,
                roleName: roleName,
                permissions: permissionNames,
                userCount: 0
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updateRolePermissions = async (req, res) => {
    try {
        const { id: roleName } = req.params;
        const { permissionNames } = req.body;

        await pool.query('DELETE FROM role_permissions WHERE role = $1', [roleName]);

        if (permissionNames && permissionNames.length > 0) {
            const { rows: perms } = await pool.query('SELECT id, name FROM permissions WHERE name = ANY($1)', [permissionNames]);

            for (const p of perms) {
                await pool.query('INSERT INTO role_permissions (role, permissionid) VALUES ($1, $2)', [roleName, p.id]);
            }
        }

        res.json({ success: true, message: 'Role permissions updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getAllPermissions,
    getUserPermissions,
    updateUserPermission,
    grantUserPermission,
    revokeUserPermission,
    resetUserPermissions,
    getRolePermissions,
    updateRolePermissions
};
