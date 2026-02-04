const pool = require('../config/db');
const razorpayService = require('../services/razorpayService');

// @desc    Get all pending withdrawals
// @route   GET /api/v1/admin/payments/withdrawals/pending
// @access  Private (Admin/SuperAdmin)
const getPendingWithdrawals = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT t.*, u.fullname as "userName", u.email, u.phonenumber as "phoneNumber" 
            FROM transactions t
            JOIN users u ON t.userid = u.id
            WHERE t.type = 'withdrawal' AND t.status = 'pending'
            ORDER BY t.createdat ASC
        `);

        const withdrawals = rows.map(row => {
            // Check if metadata is string or object (JSONB returns object)
            const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
            return {
                ...row,
                bankName: meta.bankName || '',
                accountHolderName: meta.accountHolderName || '',
                accountNumber: meta.accountNumber || '',
                ifsc: meta.ifsc || '',
                routingNumber: meta.routingNumber || '',
                upi: meta.upi || '',
                netAmount: row.amount - (row.fee || 0),
                currency: 'INR'
            };
        });

        res.json({
            success: true,
            data: withdrawals
        });
    } catch (error) {
        console.error('getPendingWithdrawals error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Approve withdrawal
// @route   POST /api/v1/admin/payments/withdrawals/:id/approve
// @access  Private (Admin/SuperAdmin)
const approveWithdrawal = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const transactionId = req.params.id;
        const { bankTransferReference } = req.body;

        if (!bankTransferReference) {
            return res.status(400).json({ message: 'Bank transfer reference is required for manual approval' });
        }

        const { rows: transactions } = await client.query(`
            SELECT t.*, u.fullname as "fullName", u.email, u.phonenumber as "phoneNumber" 
            FROM transactions t
            JOIN users u ON t.userid = u.id
            WHERE t.id = $1 AND t.type = 'withdrawal' AND t.status = 'pending'
        `, [transactionId]);

        if (transactions.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Pending withdrawal not found' });
        }

        const transaction = transactions[0];

        // Aliasing walletBalance issue check: DB has walletbalance.
        // But UPDATE statement updates column `walletBalance` which PG sees as `walletbalance`. Correct.
        // transaction.userId -> transaction.userid if not aliased.
        const userId = transaction.userId || transaction.userid;

        const updateResult = await client.query(
            'UPDATE users SET walletbalance = walletbalance - $1 WHERE id = $2 AND walletbalance >= $3',
            [transaction.amount, userId, transaction.amount]
        );

        if (updateResult.rowCount === 0) {
            throw new Error('Insufficient user balance or user not found');
        }

        const meta = typeof transaction.metadata === 'string' ? JSON.parse(transaction.metadata) : (transaction.metadata || {});
        const updatedMetadata = {
            ...meta,
            bankTransferReference,
            completedAt: new Date().toISOString(),
            payoutMode: 'manual'
        };

        await client.query(
            'UPDATE transactions SET status = \'completed\', description = $1, metadata = $2 WHERE id = $3',
            [`Withdrawal Manually Approved - Ref: ${bankTransferReference}`, JSON.stringify(updatedMetadata), transactionId]
        );

        await client.query('COMMIT');
        res.json({
            success: true,
            message: 'Withdrawal manually approved successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Manual Approval Error:', error);
        res.status(500).json({ message: 'Failed to approve withdrawal manually: ' + error.message });
    } finally {
        client.release();
    }
};

// @desc    Reject withdrawal
// @route   POST /api/v1/admin/payments/withdrawals/:id/reject
// @access  Private (Admin/SuperAdmin)
const rejectWithdrawal = async (req, res) => {
    try {
        const transactionId = req.params.id;
        const { rejectionReason } = req.body;
        await pool.query(
            'UPDATE transactions SET status = \'failed\', description = $1 WHERE id = $2 AND status = \'pending\'',
            [`Withdrawal Rejected: ${rejectionReason || 'No reason provided'}`, transactionId]
        );
        res.json({ success: true, message: 'Withdrawal rejected' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Complete withdrawal (Finalize)
// @route   POST /api/v1/admin/payments/withdrawals/:id/complete
// @access  Private (Admin/SuperAdmin)
const completeWithdrawal = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const transactionId = req.params.id;
        const { bankTransferReference } = req.body;

        if (!bankTransferReference) {
            return res.status(400).json({ message: 'Bank transfer reference is required to complete withdrawal' });
        }

        const { rows: transactions } = await client.query('SELECT * FROM transactions WHERE id = $1 AND type = \'withdrawal\'', [transactionId]);

        if (transactions.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Transaction not found' });
        }

        const transaction = transactions[0];
        const userId = transaction.userId || transaction.userid;

        const updateResult = await client.query(
            'UPDATE users SET walletbalance = walletbalance - $1 WHERE id = $2 AND walletbalance >= $3',
            [transaction.amount, userId, transaction.amount]
        );

        if (updateResult.rowCount === 0) {
            throw new Error('Insufficient user balance or user not found');
        }

        const metadata = {
            bankTransferReference,
            completedAt: new Date().toISOString()
        };

        await client.query(
            'UPDATE transactions SET status = \'completed\', description = $1, metadata = $2 WHERE id = $3',
            [`Withdrawal Completed - Ref: ${bankTransferReference}`, JSON.stringify(metadata), transactionId]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Withdrawal completed successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    } finally {
        client.release();
    }
};

// @desc    Get transaction history (Admin)
// @route   GET /api/v1/admin/payments/transactions
// @access  Private (Admin/SuperAdmin)
const getAllTransactions = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT t.*, 
                   t.createdat as "createdAt",
                   u.fullname as "userName", 
                   u.email, 
                   u.phonenumber as "phoneNumber" 
            FROM transactions t
            JOIN users u ON t.userid = u.id
            ORDER BY t.createdat DESC
            LIMIT 100
        `);

        res.json({ success: true, data: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get all pending refunds
// @route   GET /api/v1/admin/payments/refunds/pending
// @access  Private (Admin/SuperAdmin)
const getPendingRefunds = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT t.*, u.fullname as "userName", u.email, u.phonenumber as "phoneNumber" 
            FROM transactions t
            JOIN users u ON t.userid = u.id
            WHERE t.type = 'refund' AND t.status = 'pending'
            ORDER BY t.createdat ASC
        `);

        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('getPendingRefunds error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Adjust wallet balance (Credit/Debit)
// @route   POST /api/v1/admin/payments/wallets/adjust-balance
// @access  Private (Admin/SuperAdmin)
const adjustWalletBalance = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { userId, amount, type, reason } = req.body; // type: 'Credit' or 'Debit'

        if (type === 'Credit') {
            await client.query('UPDATE users SET walletbalance = walletbalance + $1 WHERE id = $2', [amount, userId]);
            await client.query(
                'INSERT INTO transactions (userid, amount, type, status, description) VALUES ($1, $2, \'credit\', \'completed\', $3)',
                [userId, amount, reason || 'Admin Adjustment (Credit)']
            );
        } else {
            await client.query('UPDATE users SET walletbalance = walletbalance - $1 WHERE id = $2', [amount, userId]);
            await client.query(
                'INSERT INTO transactions (userid, amount, type, status, description) VALUES ($1, $2, \'debit\', \'completed\', $3)',
                [userId, -amount, reason || 'Admin Adjustment (Debit)']
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Wallet balance adjusted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

const getUserForAdjustment = async (req, res) => {
    try {
        const userId = req.params.id;
        // Fixing casing errors in SELECT (u.fullName -> u.fullname in PG unless aliased)
        const query = `
            SELECT 
                u.id, 
                u.fullname as "fullName", 
                u.email, 
                u.phonenumber as "phoneNumber", 
                u.role, 
                u.isapproved as "isApproved", 
                u.createdat as "createdAt",
                u.walletbalance as "walletBalance",
                s.status as "subscriptionStatus",
                p.name as "planName"
            FROM users u
            LEFT JOIN (
                SELECT userid as "userId", status, planid as "planId"
                FROM (
                    SELECT userid, status, planid, ROW_NUMBER() OVER (PARTITION BY userid ORDER BY createdat DESC) as rn
                    FROM subscriptions
                ) t
                WHERE rn = 1
            ) s ON u.id = s."userId"
            LEFT JOIN plans p ON s."planId" = p.id
            WHERE u.id = $1
        `;
        const { rows: users } = await pool.query(query, [userId]);

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            success: true,
            data: users[0]
        });
    } catch (error) {
        console.error('getUserForAdjustment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getUserTransactions = async (req, res) => {
    try {
        const userId = req.params.id;
        const { rows } = await pool.query(
            'SELECT * FROM transactions WHERE userid = $1 ORDER BY createdat DESC LIMIT 50',
            [userId]
        );

        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('getUserTransactions error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getPendingWithdrawals,
    approveWithdrawal,
    rejectWithdrawal,
    completeWithdrawal,
    getPendingRefunds,
    getAllTransactions,
    adjustWalletBalance,
    getUserForAdjustment,
    getUserTransactions
};