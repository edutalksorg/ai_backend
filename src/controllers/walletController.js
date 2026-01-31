const pool = require('../config/db');

// @desc    Get wallet balance
// @route   GET /api/v1/wallet
// @access  Private
const getWallet = async (req, res) => {
    try {
        const userId = req.user.id;
        const [user] = await pool.query('SELECT walletBalance FROM users WHERE id = ?', [userId]);
        const [transactions] = await pool.query('SELECT SUM(amount) as totalEarned FROM transactions WHERE userId = ? AND type = "credit" AND status = "completed"', [userId]);
        const [spent] = await pool.query('SELECT SUM(amount) as totalSpent FROM transactions WHERE userId = ? AND type = "debit" AND status = "completed"', [userId]);

        // Pending or processing withdrawals
        const [frozen] = await pool.query('SELECT SUM(amount) as frozen FROM transactions WHERE userId = ? AND type = "withdrawal" AND status IN ("pending", "initiated")', [userId]);

        res.json({
            success: true,
            data: {
                balance: parseFloat(user[0].walletBalance || 0),
                currency: 'INR',
                frozenAmount: parseFloat(frozen[0].frozen || 0),
                availableBalance: parseFloat(user[0].walletBalance || 0) - parseFloat(frozen[0].frozen || 0),
                totalEarnings: parseFloat(transactions[0].totalEarned || 0),
                totalSpent: Math.abs(parseFloat(spent[0].totalSpent || 0)),
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get transactions
// @route   GET /api/v1/wallet/transactions
// @access  Private
const getTransactions = async (req, res) => {
    try {
        const userId = req.user.id;
        const [transactions] = await pool.query('SELECT * FROM transactions WHERE userId = ? ORDER BY createdAt DESC', [userId]);
        res.json({ success: true, data: transactions });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Request withdrawal
// @route   POST /api/v1/wallet/withdraw
// @access  Private
const withdraw = async (req, res) => {
    try {
        const { amount, bankDetails } = req.body;
        const userId = req.user.id;

        const [user] = await pool.query('SELECT walletBalance FROM users WHERE id = ?', [userId]);
        const currentBalance = parseFloat(user[0].walletBalance || 0);

        if (amount > currentBalance) {
            return res.status(400).json({ message: 'Insufficient funds' });
        }

        await pool.query(
            'INSERT INTO transactions (userId, amount, type, description, status, metadata) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, amount, 'withdrawal', 'Withdrawal Request', 'pending', JSON.stringify(bankDetails)]
        );

        res.json({ success: true, message: 'Withdrawal request submitted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getWallet, getTransactions, withdraw };
