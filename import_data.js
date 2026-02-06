const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Robust CSV Parser Helper
function parseCSV(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        return [];
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].replace(/"/g, '').split(',');

    return lines.slice(1).map((line, index) => {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());

        const obj = {};
        headers.forEach((header, i) => {
            let val = values[i] !== undefined ? values[i] : null;
            if (val === 'NULL' || val === '') val = null;
            if (val === 'True') val = true;
            if (val === 'False') val = false;
            obj[header] = val;
        });
        return obj;
    });
}

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'ai',
    port: process.env.DB_PORT || 5432,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const pool = new Pool(dbConfig);

async function migrate() {
    try {
        console.log('🚀 Connecting to Database:', dbConfig.host, '/', dbConfig.database);
        const testConn = await pool.query('SELECT NOW()');
        console.log('✅ Connection Successful:', testConn.rows[0].now);

        // 1. Load Files (Using relative paths for compatibility)
        const dataDir = path.join(__dirname, 'data');
        const usersFile = path.join(dataDir, 'englis-ai-users');
        const subFile = path.join(dataDir, 'english-ai-usersubscription');
        const transFile = path.join(dataDir, 'english-ai-transactions');

        console.log('📂 Loading files from:', dataDir);

        const sourceUsers = parseCSV(usersFile);
        const sourceSubs = parseCSV(subFile);
        const sourceTrans = parseCSV(transFile);

        console.log(`📊 Found ${sourceUsers.length} users, ${sourceSubs.length} subscriptions, ${sourceTrans.length} transactions.`);

        const idMap = {};

        // 3. Migrate Users
        console.log('👤 Migrating Users...');
        for (const u of sourceUsers) {
            if (!u.Email) continue;

            const { rows: exists } = await pool.query('SELECT id FROM users WHERE email = $1', [u.Email]);

            if (exists.length > 0) {
                idMap[u.Id] = exists[0].id;
                console.log(`⏩ User exists: ${u.Email} (Mapped to ID ${exists[0].id})`);
                continue;
            }

            try {
                const { rows: result } = await pool.query(
                    `INSERT INTO users (fullName, email, password, phoneNumber, role, isApproved, isVerified, createdAt) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                    [
                        u.FullName,
                        u.Email,
                        u.PasswordHash || 'default_hashed_password',
                        u.PhoneNumber || null,
                        u.PlatformRole === 'SuperAdmin' ? 'SuperAdmin' : (u.PlatformRole === 'Admin' ? 'Admin' : (u.PlatformRole === 'Instructor' ? 'Instructor' : 'User')),
                        u.IsApproved === true,
                        u.EmailConfirmed === true,
                        u.CreatedAt || new Date()
                    ]
                );
                idMap[u.Id] = result[0].id;
                console.log(`✅ Migrated User: ${u.Email} (${u.Id} -> ${result[0].id})`);
            } catch (err) {
                console.error(`❌ Failed to insert user ${u.Email}:`, err.message);
            }
        }

        // 4. Migrate Subscriptions
        console.log('💳 Migrating Subscriptions...');
        const planMap = {
            'plan_free_trial': 1,
            'plan_monthly': 2,
            'plan_quarterly': 3,
            'plan_yearly': 4
        };

        for (const s of sourceSubs) {
            const newUserId = idMap[s.UserId];
            if (!newUserId) continue;

            const planId = planMap[s.PlanId] || 1;

            try {
                await pool.query(
                    `INSERT INTO subscriptions (userId, planId, status, startDate, endDate, paymentStatus, createdAt) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        newUserId,
                        planId,
                        (s.Status || 'pending').toLowerCase(),
                        s.StartDate || new Date(),
                        s.EndDate === 'NULL' || !s.EndDate ? null : s.EndDate,
                        s.IsFreeTrial === true ? 'free' : 'paid',
                        s.CreatedAt || new Date()
                    ]
                );
                console.log(`✅ Subscribed User: ${newUserId}`);
            } catch (err) {
                if (!err.message.includes('unique constraint')) {
                    console.error(`❌ Sub error for User ${newUserId}:`, err.message);
                }
            }
        }

        // 5. Migrate Transactions
        console.log('💰 Migrating Transactions...');
        for (const t of sourceTrans) {
            const newUserId = idMap[t.UserId];
            if (!newUserId) continue;

            const typeMap = {
                'SubscriptionPayment': 'payment',
                'ReferralReward': 'credit',
                'Withdrawal': 'withdrawal'
            };
            const statusMap = {
                'Completed': 'completed',
                'Failed': 'failed',
                'Pending': 'pending',
                'Succeeded': 'completed'
            };

            try {
                await pool.query(
                    `INSERT INTO transactions (userId, amount, type, status, description, providerTransactionId, createdAt) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        newUserId,
                        t.Amount || 0,
                        typeMap[t.Type] || 'payment',
                        statusMap[t.Status] || 'pending',
                        t.Description || '',
                        t.ExternalTransactionId || null,
                        t.CreatedAt || new Date()
                    ]
                );
                console.log(`✅ Transaction added for User: ${newUserId}`);
            } catch (err) {
                if (!err.message.includes('unique constraint')) {
                    console.error(`❌ Transaction error for User ${newUserId}:`, err.message);
                }
            }
        }

        console.log('🎉 Migration finished. Check your database now!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Critical Error during migration:', error.message);
        process.exit(1);
    }
}

migrate();
