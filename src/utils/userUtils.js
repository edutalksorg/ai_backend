const pool = require('../config/db');

/**
 * Check if a user is eligible to make or receive calls.
 * @param {Object} user - User object containing at least id and role.
 * @returns {Promise<boolean>}
 */
const isUserCallEligible = async (user) => {
    if (['Admin', 'SuperAdmin', 'Instructor'].includes(user.role)) {
        return true;
    }

    // 1. Check for ANY active subscription (Paid or Free Trial)
    // We strictly require an active token/subscription for calls now.
    // "Free usage is 24 hours from their joining time" -> This is handled by the subscription endDate.
    const { rows: subs } = await pool.query(`
        SELECT s.*, p.name as "planName" 
        FROM subscriptions s 
        JOIN plans p ON s.planid = p.id 
        WHERE s.userid = $1 AND s.status = 'active' AND s.enddate > NOW()
    `, [user.id]);

    if (subs.length === 0) {
        // No active subscription (expired trial or cancelled).
        // Access revoked.
        return false;
    }

    const subscription = subs[0];
    const planName = subscription.planName.toLowerCase();

    // 2. Paid Plans = Unlimited
    if (planName.includes('monthly') || planName.includes('quarterly') || planName.includes('yearly')) {
        return true;
    }

    // 3. Free Trial = 5 Minute Limit (Daily)
    // Calculate usage for TODAY only
    const { rows: calls } = await pool.query(`
        SELECT durationseconds as "durationSeconds"
        FROM call_history 
        WHERE (callerid = $1 OR calleeid = $1) 
          AND status = 'completed'
          AND startedat >= CURRENT_DATE
    `, [user.id]);

    let totalSeconds = 0;
    for (const call of calls) {
        totalSeconds += (call.durationSeconds || 0);
    }

    // 5 minutes = 300 seconds
    return totalSeconds < 300;
};

module.exports = {
    isUserCallEligible
};
