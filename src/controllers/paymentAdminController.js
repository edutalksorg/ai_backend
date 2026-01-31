const pool = require('../config/db');

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
    try {
        const transactionId = req.params.id;
        // Status 'initiated' or 'processing' can be used as approved
        await pool.query(
            'UPDATE transactions SET status = "initiated", description = ? WHERE id = ? AND status = "pending"',
            ['Withdrawal Approved (Processing)', transactionId]
        );
        res.json({ success: true, message: 'Withdrawal approved' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
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

        // 3. Update transaction status
        await connection.query(
            'UPDATE transactions SET status = "completed", description = ? WHERE id = ?',
            ['Withdrawal Completed Successfully', transactionId]
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
            SELECT t.*, u.fullName as userName, u.email 
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
            SELECT t.*, u.fullName as userName, u.email 
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

module.exports = {
    getPendingWithdrawals,
    approveWithdrawal,
    rejectWithdrawal,
    completeWithdrawal,
    getPendingRefunds,
    getAllTransactions,
    adjustWalletBalance
};
