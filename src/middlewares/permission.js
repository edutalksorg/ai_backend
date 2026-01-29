const pool = require('../config/db');

const checkPermission = (permissionName) => {
    return async (req, res, next) => {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;

            // 1. Check User Overrides (Revoke first)
            const [overrides] = await pool.query(
                'SELECT type FROM user_permissions up JOIN permissions p ON up.permissionId = p.id WHERE up.userId = ? AND p.name = ?',
                [userId, permissionName]
            );

            if (overrides.length > 0) {
                if (overrides[0].type === 'revoke') {
                    return res.status(403).json({ message: 'Permission denied (revoked)' });
                }
                if (overrides[0].type === 'grant') {
                    return next();
                }
            }

            // 2. Check Role Defaults
            const [rolePerms] = await pool.query(
                'SELECT 1 FROM role_permissions rp JOIN permissions p ON rp.permissionId = p.id WHERE rp.role = ? AND p.name = ?',
                [userRole, permissionName]
            );

            if (rolePerms.length > 0 || userRole === 'SuperAdmin') {
                return next();
            }

            return res.status(403).json({ message: 'Permission denied' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Authorization error' });
        }
    };
};

module.exports = checkPermission;
