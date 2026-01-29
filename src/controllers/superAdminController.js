const pool = require('../config/db');

// @desc    Get all permissions
// @route   GET /api/v1/superadmin/permissions
// @access  Private (SuperAdmin)
const getAllPermissions = async (req, res) => {
    try {
        const [permissions] = await pool.query('SELECT * FROM permissions');
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
        const [userPerms] = await pool.query(
            'SELECT p.id, p.name, up.type FROM user_permissions up JOIN permissions p ON up.permissionId = p.id WHERE up.userId = ?',
            [userId]
        );
        res.json({ success: true, data: userPerms });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update user permission override
// @route   POST /api/v1/superadmin/users/:id/permissions
// @access  Private (SuperAdmin)
const updateUserPermission = async (req, res) => {
    try {
        const userId = req.params.id;
        // Check if body has permissionId/type OR permissionName/type
        let { permissionId, type, permissionName } = req.body;

        // Frontend service sends permissionName for grant/revoke
        if (permissionName && !permissionId) {
            const [perms] = await pool.query('SELECT id FROM permissions WHERE name = ?', [permissionName]);
            if (perms.length > 0) permissionId = perms[0].id;
            else return res.status(404).json({ message: 'Permission not found' });
        }

        if (!type) {
            // For legacy or reset single
            await pool.query('DELETE FROM user_permissions WHERE userId = ? AND permissionId = ?', [userId, permissionId]);
        } else {
            await pool.query(
                'INSERT INTO user_permissions (userId, permissionId, type) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE type = ?',
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
        await pool.query('DELETE FROM user_permissions WHERE userId = ?', [userId]);
        res.json({ success: true, message: 'User permissions reset' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getRolePermissions = async (req, res) => {
    try {
        const { id: roleName } = req.params; // Frontend sends roleId as 'Admin', 'Instructor'

        // Get all permissions assigned to this role
        const [rolePerms] = await pool.query(`
            SELECT p.name 
            FROM role_permissions rp 
            JOIN permissions p ON rp.permissionId = p.id 
            WHERE rp.role = ?
        `, [roleName]);

        const permissionNames = rolePerms.map(p => p.name);

        res.json({
            success: true,
            data: {
                roleId: roleName,
                roleName: roleName,
                permissions: permissionNames,
                userCount: 0 // Mock count or fetch real count
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

        // 1. Clear existing
        await pool.query('DELETE FROM role_permissions WHERE role = ?', [roleName]);

        // 2. Insert new
        if (permissionNames && permissionNames.length > 0) {
            // Get IDs
            const [perms] = await pool.query('SELECT id, name FROM permissions WHERE name IN (?)', [permissionNames]);

            if (perms.length > 0) {
                const values = perms.map(p => [roleName, p.id]);
                await pool.query('INSERT INTO role_permissions (role, permissionId) VALUES ?', [values]);
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
