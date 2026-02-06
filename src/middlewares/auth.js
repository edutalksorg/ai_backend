const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Postgres query fixes:
            // Columns are stored lowercase (fullname, isapproved).
            // Requesting "fullName" fails.
            // We select lowercase column and alias to camelCase for the app.
            const { rows } = await pool.query(
                `SELECT 
                    u.id, 
                    u.fullname as "fullName", 
                    u.email, 
                    u.role, 
                    u.isapproved as "isApproved",
                    s.status as "subscriptionStatus",
                    p.name as "subscriptionPlan",
                    s.enddate as "trialEndDate"
                 FROM users u
                 LEFT JOIN LATERAL (
                    SELECT status, planid, enddate 
                    FROM subscriptions 
                    WHERE userid = u.id AND (status = 'active' OR status = 'expired')
                    ORDER BY enddate DESC LIMIT 1
                 ) s ON true
                 LEFT JOIN plans p ON s.planid = p.id
                 WHERE u.id = $1`,
                [decoded.id]
            );

            req.user = rows[0];

            if (!req.user) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `Role ${req.user.role} is not authorized to access this route`,
            });
        }
        next();
    };
};

module.exports = { protect, authorize };
