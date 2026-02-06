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

        // 2. Check for active PRO subscription (Info fetched in auth middleware)
        const status = (user.subscriptionStatus || '').toLowerCase();
        const plan = (user.subscriptionPlan || '').toLowerCase();

        if (status === 'active') {
            // Check if the plan matches one of the allowed pro plans
            if (plan.includes('monthly') ||
                plan.includes('quarterly') ||
                plan.includes('yearly') ||
                plan.includes('free') ||
                plan.includes('trial')) {
                return next();
            }
        }

        // 3. (Removed) Old check for registration timestamp

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
