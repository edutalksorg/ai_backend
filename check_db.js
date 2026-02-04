const pool = require('./src/config/db');
pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'carousel_items'
`).then(res => {
    console.log('Columns for carousel_items:', res.rows);
    process.exit(0);
}).catch(err => {
    console.error('Error checking table:', err.message);
    process.exit(1);
});
