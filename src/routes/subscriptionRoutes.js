const express = require('express');
const router = express.Router();
const {
    getPlans,
    createPlan,
    subscribe,
    getCurrentSubscription
} = require('../controllers/subscriptionController');
const { protect, authorize } = require('../middlewares/auth');

// Public
router.get('/plans', getPlans);

// Protected
router.post('/subscribe', protect, subscribe);
router.get('/current', protect, getCurrentSubscription);

// Admin
router.post('/plans', protect, authorize('Admin', 'SuperAdmin'), createPlan);

module.exports = router;
