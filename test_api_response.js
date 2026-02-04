const pool = require('./src/config/db');

const getAllPermissions = async () => {
    try {
        const { rows: permissions } = await pool.query(
            `SELECT id, name, displayname as "displayName", module, action, description 
             FROM permissions`
        );
        console.log('Total Permissions found:', permissions.length);
        const modules = [...new Set(permissions.map(p => p.module))];
        console.log('Available Modules:', modules);

        const footerPerms = permissions.filter(p => p.module === 'FooterManagement');
        console.log('Footer Permissions in API response:', footerPerms);

    } catch (error) {
        console.error(error);
    } finally {
        process.exit(0);
    }
};

getAllPermissions();
