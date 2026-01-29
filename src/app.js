const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const initDb = require('./db/init');
const routes = require('./routes');
const { subscriptionExpiryTask } = require('./schedulers/subscriptionScheduler');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize DB and Seed Data
initDb();

// Routes
app.use('/api/v1', routes);

app.get('/', (req, res) => {
    res.json({ message: 'AI Pronunciation Backend API is running' });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
