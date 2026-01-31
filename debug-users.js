const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkUsers() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const [rows] = await connection.execute('SELECT id, fullName, email, role FROM users');
    console.log('--- USERS ---');
    console.log(JSON.stringify(rows, null, 2));
    console.log('--- END USERS ---');

    await connection.end();
}

checkUsers().catch(console.error);
