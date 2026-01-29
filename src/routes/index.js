const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const { protect, authorize } = require('../middlewares/auth');
const { getProgressSummary, updateProfile } = require('../controllers/userController');
const {
    getTopics,
    createTopic,
    updateTopicStatus,
    deleteTopic,
    getQuizzes,
    createQuiz,
    updateQuiz,
    toggleQuizPublish,
    getInstructorStats
} = require('../controllers/instructorController');
const {
    getAllUsers,
    reviewInstructor,
    getDashboardStats,
    getAllCoupons,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    createUser,
    deleteUser,
    updateUser
} = require('../controllers/adminController');
const { submitQuiz, getQuizAttempts, getAttemptDetails } = require('../controllers/quizAttemptController');
const {
    getAllPermissions,
    getUserPermissions,
    updateUserPermission
} = require('../controllers/superAdminController');
const { initiatePhonePe, paymentCallback } = require('../controllers/paymentController');
const { getAgoraToken } = require('../controllers/agoraController');
const { getWallet, getTransactions, withdraw } = require('../controllers/walletController');
const { updateAvailability, getAvailableUsers, initiateRandomCall, getCallHistory } = require('../controllers/callController');
const { getReferralStats, getMyCode, getReferralHistory, validateReferralCode } = require('../controllers/referralController');
const pronunciationRoutes = require('./pronunciationRoutes');
const subscriptionRoutes = require('./subscriptionRoutes');
const permissionRoutes = require('./permissionRoutes');

// Auth routes
router.use('/auth', authRoutes);
router.use('/pronunciation', pronunciationRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/Subscriptions', subscriptionRoutes); // Handle frontend case inconsistency
router.use('/permission-management', permissionRoutes);

// User routes
router.get('/users/progress/summary', protect, getProgressSummary);
router.put('/auth/profile', protect, updateProfile);
router.post('/users/availability', protect, updateAvailability); // For Online Status

// Wallet routes
router.get('/wallet/balance', protect, getWallet); // Frontend expects /balance
router.get('/wallet/transactions', protect, getTransactions);
router.post('/wallet/withdraw', protect, withdraw);

// Call routes
router.put('/calls/availability', protect, updateAvailability); // Frontend uses PUT /calls/availability
router.get('/calls/available-users', protect, getAvailableUsers); // Frontend call
router.post('/calls/initiate-random', protect, initiateRandomCall); // Frontend call
router.get('/calls/history', protect, getCallHistory);

// Referral routes
router.get('/referrals/stats', protect, getReferralStats);
router.get('/referrals/my-code', protect, getMyCode);
router.get('/referrals/history', protect, getReferralHistory);
router.get('/referrals/validate/:code', validateReferralCode); // Public route

// Instructor - Topics
router.get('/topics', protect, authorize('Instructor', 'Admin', 'SuperAdmin'), getTopics);
router.post('/topics', protect, authorize('Instructor', 'Admin', 'SuperAdmin'), createTopic);
router.patch('/topics/:id/status', protect, authorize('Instructor', 'Admin'), updateTopicStatus);
router.delete('/topics/:id', protect, authorize('Instructor', 'Admin'), deleteTopic);

// Instructor - Quizzes
router.get('/quizzes', protect, authorize('Instructor', 'Admin', 'SuperAdmin'), getQuizzes);
router.post('/quizzes', protect, authorize('Instructor', 'Admin'), createQuiz);
router.put('/quizzes/:id', protect, authorize('Instructor', 'Admin'), updateQuiz);
router.patch('/quizzes/:id/publish', protect, authorize('Instructor', 'Admin'), toggleQuizPublish);
router.patch('/quizzes/:id/publish', protect, authorize('Instructor', 'Admin'), toggleQuizPublish);
router.get('/users/instructor-stats', protect, authorize('Instructor', 'Admin', 'SuperAdmin'), getInstructorStats);

// Student - Quiz Attempts
router.post('/quizzes/:id/submit', protect, submitQuiz);
router.get('/quizzes/:id/attempts', protect, getQuizAttempts);
router.get('/quizzes/:id/attempts/:attemptId', protect, getAttemptDetails);
router.get('/quizzes/:id/results', protect, getQuizAttempts); // Alias for results if needed

// Admin routes
router.get('/users', protect, authorize('Admin', 'SuperAdmin'), getAllUsers);
router.post('/users', protect, authorize('Admin', 'SuperAdmin'), createUser);
router.put('/users/:id', protect, authorize('Admin', 'SuperAdmin'), updateUser);
router.delete('/users/:id', protect, authorize('SuperAdmin'), deleteUser);
router.post('/admin/instructors/:id/review', protect, authorize('Admin', 'SuperAdmin'), reviewInstructor);
router.get('/admin/analytics/dashboard', protect, authorize('Admin', 'SuperAdmin'), getDashboardStats);

// Coupon routes
// Coupon routes
router.get('/coupons', protect, authorize('Admin', 'SuperAdmin'), getAllCoupons);
router.post('/coupons', protect, authorize('Admin', 'SuperAdmin'), createCoupon);
router.put('/coupons/:id', protect, authorize('Admin', 'SuperAdmin'), updateCoupon);
router.delete('/coupons/:id', protect, authorize('Admin', 'SuperAdmin'), deleteCoupon);

// Super Admin routes (RBAC)
router.get('/superadmin/permissions', protect, authorize('SuperAdmin'), getAllPermissions);
router.get('/superadmin/users/:id/permissions', protect, authorize('SuperAdmin'), getUserPermissions);
router.post('/superadmin/users/:id/permissions', protect, authorize('SuperAdmin'), updateUserPermission);

// Payment routes
router.post('/payments/phonepe/initiate', protect, initiatePhonePe);
router.post('/payments/callback', paymentCallback);

// Agora routes
router.get('/agora/token', protect, getAgoraToken);

module.exports = router;
