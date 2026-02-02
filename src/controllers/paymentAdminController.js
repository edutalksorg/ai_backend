const pool = require('../config/db');
const razorpayService = require('../services/razorpayService');

// @desc    Get all pending withdrawals
// @route   GET /api/v1/admin/payments/withdrawals/pending
// @access  Private (Admin/SuperAdmin)
const getPendingWithdrawals = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT t.*, u.fullName as userName, u.email, u.phoneNumber 
            FROM transactions t
            JOIN users u ON t.userId = u.id
            WHERE t.type = 'withdrawal' AND t.status = 'pending'
            ORDER BY t.createdAt ASC
        `);

        // Parse metadata and flatten for frontend
        const withdrawals = rows.map(row => {
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
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const transactionId = req.params.id;
        const { bankTransferReference } = req.body;

        if (!bankTransferReference) {
            return res.status(400).json({ message: 'Bank transfer reference is required for manual approval' });
        }

        // 1. Get the transaction and user details
        const [transactions] = await connection.query(`
            SELECT t.*, u.fullName, u.email, u.phoneNumber 
            FROM transactions t
            JOIN users u ON t.userId = u.id
            WHERE t.id = ? AND t.type = "withdrawal" AND t.status = "pending"
        `, [transactionId]);

        if (transactions.length === 0) {
            return res.status(404).json({ message: 'Pending withdrawal not found' });
        }

        const transaction = transactions[0];

        // 2. Deduct from user balance
        const [updateResult] = await connection.query(
            'UPDATE users SET walletBalance = walletBalance - ? WHERE id = ? AND walletBalance >= ?',
            [transaction.amount, transaction.userId, transaction.amount]
        );

        if (updateResult.affectedRows === 0) {
            throw new Error('Insufficient user balance or user not found');
        }

        // 3. Update transaction status to "completed" and store reference
        const meta = typeof transaction.metadata === 'string' ? JSON.parse(transaction.metadata) : (transaction.metadata || {});
        const updatedMetadata = {
            ...meta,
            bankTransferReference,
            completedAt: new Date().toISOString(),
            payoutMode: 'manual'
        };

        await connection.query(
            'UPDATE transactions SET status = "completed", description = ?, metadata = ? WHERE id = ?',
            [`Withdrawal Manually Approved - Ref: ${bankTransferReference}`, JSON.stringify(updatedMetadata), transactionId]
        );

        await connection.commit();
        res.json({
            success: true,
            message: 'Withdrawal manually approved successfully'
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('❌ Manual Approval Error:', error);
        res.status(500).json({ message: 'Failed to approve withdrawal manually: ' + error.message });
    } finally {
        if (connection) connection.release();
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
            'UPDATE transactions SET status = "failed", description = ? WHERE id = ? AND status = "pending"',
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
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const transactionId = req.params.id;
        const { bankTransferReference } = req.body;

        if (!bankTransferReference) {
            return res.status(400).json({ message: 'Bank transfer reference is required to complete withdrawal' });
        }

        // 1. Get the transaction
        const [transactions] = await connection.query('SELECT * FROM transactions WHERE id = ? AND type = "withdrawal"', [transactionId]);

        if (transactions.length === 0) {
            await connection.release();
            return res.status(404).json({ message: 'Transaction not found' });
        }

        const transaction = transactions[0];

        // 2. Deduct from user balance
        const [updateResult] = await connection.query(
            'UPDATE users SET walletBalance = walletBalance - ? WHERE id = ? AND walletBalance >= ?',
            [transaction.amount, transaction.userId, transaction.amount]
        );

        if (updateResult.affectedRows === 0) {
            throw new Error('Insufficient user balance or user not found');
        }

        // 3. Update transaction status and store reference in metadata
        const metadata = {
            bankTransferReference,
            completedAt: new Date().toISOString()
        };

        await connection.query(
            'UPDATE transactions SET status = "completed", description = ?, metadata = ? WHERE id = ?',
            [`Withdrawal Completed - Ref: ${bankTransferReference}`, JSON.stringify(metadata), transactionId]
        );

        await connection.commit();
        res.json({ success: true, message: 'Withdrawal completed successfully' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    } finally {
        connection.release();
    }
};

// @desc    Get transaction history (Admin)
// @route   GET /api/v1/admin/payments/transactions
// @access  Private (Admin/SuperAdmin)
const getAllTransactions = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT t.*, u.fullName as userName, u.email, u.phoneNumber 
            FROM transactions t
            JOIN users u ON t.userId = u.id
            ORDER BY t.createdAt DESC
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
        const [rows] = await pool.query(`
            SELECT t.*, u.fullName as userName, u.email, u.phoneNumber 
            FROM transactions t
            JOIN users u ON t.userId = u.id
            WHERE t.type = 'refund' AND t.status = 'pending'
            ORDER BY t.createdAt ASC
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
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { userId, amount, type, reason } = req.body; // type: 'Credit' or 'Debit'

        if (type === 'Credit') {
            await connection.query('UPDATE users SET walletBalance = walletBalance + ? WHERE id = ?', [amount, userId]);
            await connection.query(
                'INSERT INTO transactions (userId, amount, type, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, amount, 'credit', 'completed', reason || 'Admin Adjustment (Credit)']
            );
        } else {
            await connection.query('UPDATE users SET walletBalance = walletBalance - ? WHERE id = ?', [amount, userId]);
            await connection.query(
                'INSERT INTO transactions (userId, amount, type, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, -amount, 'debit', 'completed', reason || 'Admin Adjustment (Debit)']
            );
        }

        await connection.commit();
        res.json({ success: true, message: 'Wallet balance adjusted successfully' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        connection.release();
    }
};

const getUserForAdjustment = async (req, res) => {
    try {
        const userId = req.params.id;
        const query = `
            SELECT 
                u.id, 
                u.fullName, 
                u.email, 
                u.phoneNumber, 
                u.role, 
                u.isApproved, 
                u.createdAt,
                u.walletBalance,
                s.status as subscriptionStatus,
                p.name as planName
            FROM users u
            LEFT JOIN (
                SELECT userId, status, planId
                FROM (
                    SELECT userId, status, planId, ROW_NUMBER() OVER (PARTITION BY userId ORDER BY createdAt DESC) as rn
                    FROM subscriptions
                ) t
                WHERE rn = 1
            ) s ON u.id = s.userId
            LEFT JOIN plans p ON s.planId = p.id
            WHERE u.id = ?
        `;
        const [users] = await pool.query(query, [userId]);

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
        const [rows] = await pool.query(
            'SELECT * FROM transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT 50',
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
