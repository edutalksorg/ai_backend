const express = require('express');
const router = express.Router();
const {
    getPlans,
    createPlan,
    updatePlan,
    deletePlan,
    addFeature,
    deleteFeature,
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
// Admin
router.post('/plans', protect, authorize('Admin', 'SuperAdmin'), createPlan);
router.put('/plans/:id', protect, authorize('Admin', 'SuperAdmin'), updatePlan);
router.delete('/plans/:id', protect, authorize('Admin', 'SuperAdmin'), deletePlan);

// Feature Management
router.post('/plans/:id/features', protect, authorize('Admin', 'SuperAdmin'), addFeature);
router.delete('/plans/:id/features/:key', protect, authorize('Admin', 'SuperAdmin'), deleteFeature);

module.exports = router;
