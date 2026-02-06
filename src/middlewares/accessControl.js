const pool = require('../config/db');

/**
 * Middleware to check if a user has access to topics, quizzes, and pronunciation.
 * Access is granted if:
 * 1. User is an Admin, SuperAdmin, or Instructor.
 * 2. User has an active pro subscription (Monthly, Quarterly, Yearly).
 * 3. User is within their 24-hour free trial (from registration timestamp).
 */
const checkContentAccess = async (req, res, next) => {
    try {
        const user = req.user;

        // 1. Admins and Instructors always have access
        if (['SuperAdmin', 'Admin', 'Instructor'].includes(user.role)) {
            return next();
        }

        // 2. Check for active PRO subscription
        const { rows: subs } = await pool.query(`
            SELECT s.*, p.name as "planName" 
            FROM subscriptions s 
            JOIN plans p ON s.planid = p.id 
            WHERE s.userid = $1 AND s.status = 'active' AND s.enddate > NOW()
        `, [user.id]);

        if (subs.length > 0) {
            const planName = (subs[0].planName || '').toLowerCase();
            if (planName.includes('monthly') ||
                planName.includes('quarterly') ||
                planName.includes('yearly') ||
                planName.includes('free') ||
                planName.includes('trial')) {
                return next();
            }
        }

        // 3. (Removed) Check for 24-hour trial (based on user registration)
        // Trial is now managed via subscriptions table and handled in step 2 above.

        // 4. Default: Access Denied
        return res.status(403).json({
            success: false,
            message: 'Your 24-hour free trial has expired. Please upgrade to a pro plan to continue accessing topics, quizzes, and pronunciation paragraphs.',
            upgradeRequired: true
        });

    } catch (error) {
        console.error('Access control error:', error);
        res.status(500).json({ message: 'Server error check access' });
    }
};

module.exports = { checkContentAccess };
