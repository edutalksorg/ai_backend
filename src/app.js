console.log('\n\n##############################################');
console.log('🚀 BACKEND RESTARTED - VERSION 2.4 (PLAIN TEXT + UNIQUE SUBJECT)');
console.log('##############################################\n');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const initDb = require('./db/init');
const routes = require('./routes');
const { subscriptionExpiryTask } = require('./schedulers/subscriptionScheduler');
const { promotionTask } = require('./schedulers/promotionScheduler');
const startTrialExpirationJob = require('./jobs/trialExpirationJob');

const http = require('http');
const { initSocket } = require('./services/socketService');

const app = express();
const server = http.createServer(app);
const path = require('path');

// Serve uploaded files statically with CORS headers
app.use('/uploads', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
}, express.static(path.join(__dirname, '../uploads')));

// Initialize Socket.io
initSocket(server);

// Initialize Cron Jobs
startTrialExpirationJob();

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "media-src": ["'self'", "https:", "blob:", process.env.BACKEND_URL],
            "img-src": ["'self'", "data:", "https:", process.env.BACKEND_URL],
            "connect-src": ["'self'", "https:", process.env.BACKEND_URL, "ws://localhost:5000", "wss://localhost:5000"]
        },
    },
}));
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://d1ls14uofwgojt.cloudfront.net'
    ];
console.log(`📡 [CONFIG] Allowed Origins: ${allowedOrigins.join(', ')}`);

app.use(cors({
    origin: function (origin, callback) {
        // allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) === -1) {
            console.error(`>>> [CORS ERROR] Origin not allowed: ${origin}`);
            var msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ strict: false }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    console.log(`\n>>> [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        const silentBody = { ...req.body };
        if (silentBody.password) silentBody.password = '***';
        console.log('>>> Body:', silentBody);
    }
    next();
});

// Initialize DB and Seed Data
initDb();

// Routes
app.use('/api/v1', routes);

app.get('/', (req, res) => {
    res.json({ message: 'AI Pronunciation Backend API is running' });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} (PID: ${process.pid})`);
});

