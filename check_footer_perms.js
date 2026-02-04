const pool = require('./src/config/db');
pool.query(`
    SELECT * FROM permissions WHERE module = 'FooterManagement'
`).then(res => {
    console.log('Footer Permissions:', res.rows);
    process.exit(0);
}).catch(err => {
    console.error('Error checking permissions:', err.message);
    process.exit(1);
});
