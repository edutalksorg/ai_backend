const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// CSV Parser Helper
function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const headers = lines[0].replace(/"/g, '').split(',');
    
    return lines.slice(1).filter(line => line.trim()).map(line => {
        // Handle commas inside quotes if necessary, simplified for this case
        const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        const obj = {};
        headers.forEach((header, i) => {
            let val = values[i] ? values[i].replace(/"/g, '') : null;
            if (val === 'NULL') val = null;
            if (val === 'True') val = true;
            if (val === 'False') val = false;
            obj[header] = val;
        });
        return obj;
    });
}

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'ai',
    port: process.env.DB_PORT || 5432,
});

async function migrate() {
    try {
        console.log('🚀 Starting Migration...');

        // 1. Load Files
        const usersFile = 'c:/Users/Lenovo/Downloads/englis-ai-users';
        const subFile = 'c:/Users/Lenovo/Downloads/english-ai-usersubscription';
        const transFile = 'c:/Users/Lenovo/Downloads/english-ai-transactions';

        const sourceUsers = parseCSV(usersFile);
        const sourceSubs = parseCSV(subFile);
        const sourceTrans = parseCSV(transFile);

        console.log(`📊 Found ${sourceUsers.length} users, ${sourceSubs.length} subscriptions, ${sourceTrans.length} transactions in source files.`);

        // 2. Map for ID Translation (Old UUID -> New Int ID)
        const idMap = {};

        // 3. Migrate Users
        console.log('👤 Migrating Users...');
        for (const u of sourceUsers) {
            // Check if user already exists (by email)
            const { rows: exists } = await pool.query('SELECT id FROM users WHERE email = $1', [u.Email]);
            
            if (exists.length > 0) {
                idMap[u.Id] = exists[0].id;
                console.log(`⏩ User exists: ${u.Email} (Mapped ${u.Id} -> ${exists[0].id})`);
                continue;
            }

            const { rows: result } = await pool.query(
                `INSERT INTO users (fullName, email, password, phoneNumber, role, isApproved, isVerified, createdAt) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                [
                    u.FullName,
                    u.Email,
                    u.PasswordHash, // NOTE: ASP.NET Hash
                    u.PhoneNumber || null,
                    u.PlatformRole === 'SuperAdmin' ? 'SuperAdmin' : (u.PlatformRole === 'Admin' ? 'Admin' : (u.PlatformRole === 'Instructor' ? 'Instructor' : 'User')),
                    u.IsApproved === true,
                    u.EmailConfirmed === true,
                    u.CreatedAt
                ]
            );
            idMap[u.Id] = result[0].id;
            console.log(`✅ Migrated User: ${u.Email} (${u.Id} -> ${result[0].id})`);
        }

        // 4. Migrate Subscriptions
        console.log('💳 Migrating Subscriptions...');
        // Map Plan Names to IDs
        const planMap = {
            'plan_free_trial': 1,
            'plan_monthly': 2,
            'plan_quarterly': 3,
            'plan_yearly': 4
        };

        for (const s of sourceSubs) {
            const newUserId = idMap[s.UserId];
            if (!newUserId) {
                console.warn(`⚠️ Skipping Sub ${s.Id}: User ${s.UserId} not found in map.`);
                continue;
            }

            const planId = planMap[s.PlanId] || 1;

            await pool.query(
                `INSERT INTO subscriptions (userId, planId, status, startDate, endDate, paymentStatus, createdAt) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    newUserId,
                    planId,
                    s.Status.toLowerCase() === 'active' ? 'active' : (s.Status.toLowerCase() === 'cancelled' ? 'cancelled' : 'expired'),
                    s.StartDate,
                    s.EndDate === 'NULL' ? null : s.EndDate,
                    s.IsFreeTrial === true ? 'free' : 'paid',
                    s.CreatedAt
                ]
            );
            console.log(`✅ Migrated Subscription for User ${newUserId}`);
        }

        // 5. Migrate Transactions
        console.log('💰 Migrating Transactions...');
        for (const t of sourceTrans) {
            const newUserId = idMap[t.UserId];
            if (!newUserId) {
                console.warn(`⚠️ Skipping Txn ${t.Id}: User ${t.UserId} not found in map.`);
                continue;
            }

            const typeMap = {
                'SubscriptionPayment': 'payment',
                'ReferralReward': 'credit',
                'Withdrawal': 'withdrawal'
            };

            const statusMap = {
                'Completed': 'completed',
                'Failed': 'failed',
                'Pending': 'pending'
            };

            await pool.query(
                `INSERT INTO transactions (userId, amount, type, status, description, providerTransactionId, createdAt) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    newUserId,
                    t.Amount,
                    typeMap[t.Type] || 'payment',
                    statusMap[t.Status] || 'pending',
                    t.Description,
                    t.ExternalTransactionId || null,
                    t.CreatedAt
                ]
            );
            console.log(`✅ Migrated Transaction for User ${newUserId}`);
        }

        console.log('🎉 Migration Completed Successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Migration Failed:', error);
        process.exit(1);
    }
}

migrate();
