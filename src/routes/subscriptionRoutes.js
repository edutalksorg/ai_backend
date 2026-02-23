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
    getCurrentSubscription,
    cancelSubscription
} = require('../controllers/subscriptionController');
const { protect, authorize } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Subscriptions
 *   description: Subscription plan and user subscription management
 */

/**
 * @swagger
 * /subscriptions/plans:
 *   get:
 *     summary: Get all subscription plans
 *     tags: [Subscriptions]
 *     responses:
 *       200:
 *         description: List of plans
 */
router.get('/plans', getPlans);

/**
 * @swagger
 * /subscriptions/subscribe:
 *   post:
 *     summary: Subscribe to a plan
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               planId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Subscription initiated
 */
router.post('/subscribe', protect, subscribe);

/**
 * @swagger
 * /subscriptions/cancel:
 *   post:
 *     summary: Cancel current subscription
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription cancelled
 */
router.post('/cancel', protect, cancelSubscription);

/**
 * @swagger
 * /subscriptions/current:
 *   get:
 *     summary: Get current user subscription
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current subscription details
 */
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
