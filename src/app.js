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

// Initialize Socket.io
initSocket(server);

// Initialize Cron Jobs
startTrialExpirationJob();

// Middleware
app.use(helmet());
app.use(cors());
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
