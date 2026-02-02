const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const { protect, authorize } = require('../middlewares/auth');
const { checkContentAccess } = require('../middlewares/accessControl');
const { getProgressSummary, updateProfile, getUserProfile } = require('../controllers/userController');
const {
    getTopics,
    getTopicById,
    getCategories,
    createTopic,
    updateTopic,
    updateTopicStatus,
    deleteTopic,
    getQuizzes,
    getQuizById,
    createQuiz,
    updateQuiz,
    deleteQuiz,
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
    updateUser,
    validateCoupon,
    resendVerificationEmail
} = require('../controllers/adminController');
const { submitQuiz, getQuizAttempts, getAttemptDetails } = require('../controllers/quizAttemptController');
const {
    getAllPermissions,
    getUserPermissions,
    updateUserPermission
} = require('../controllers/superAdminController');
const { verifyRazorpayPayment } = require('../controllers/paymentController');
const { getAgoraToken } = require('../controllers/agoraController');
const { getWallet, getTransactions, withdraw } = require('../controllers/walletController');
const {
    getReferralStats,
    getMyCode,
    getReferralHistory,
    validateReferralCode,
    getReferralSettings,
    updateReferralSettings
} = require('../controllers/referralController');
const {
    updateAvailability,
    getAvailableUsers,
    initiateCall,
    initiateRandomCall,
    respondToCall,
    endCall,
    getCallHistory,
    rateCall
} = require('../controllers/callController');
const {
    getPendingWithdrawals,
    approveWithdrawal,
    rejectWithdrawal,
    completeWithdrawal,
    getPendingRefunds,
    getAllTransactions: getAllTransactionsAdmin,
    adjustWalletBalance,
    getUserForAdjustment,
    getUserTransactions
} = require('../controllers/paymentAdminController');
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
router.get('/users/profile', protect, getUserProfile);
router.put('/users/profile', protect, updateProfile);
router.put('/auth/profile', protect, updateProfile); // Keep for compatibility if needed
router.post('/users/availability', protect, updateAvailability); // For Online Status

// Wallet routes
router.get('/wallet/balance', protect, getWallet);
router.get('/wallet/transactions', protect, getTransactions);
router.post('/wallet/withdraw', protect, withdraw);

// Call routes
router.put('/calls/availability', protect, updateAvailability);
router.get('/calls/available-users', protect, getAvailableUsers);
router.post('/calls/initiate', protect, initiateCall);
router.post('/calls/initiate-random', protect, initiateRandomCall);
router.post('/calls/:id/respond', protect, respondToCall);
router.post('/calls/:id/end', protect, endCall);
router.get('/calls/history', protect, getCallHistory);
router.get('/calls/agora-token', protect, getAgoraToken); // Main route for Agora token
router.post('/calls/:id/rate', protect, rateCall); // Rate a completed call

// Referral routes
router.get('/referrals/stats', protect, getReferralStats);
router.get('/referrals/my-code', protect, getMyCode);
router.get('/referrals/history', protect, getReferralHistory);
router.get('/referrals/validate/:code', validateReferralCode); // Public route
// Admin Referral Settings
router.get('/admin/referrals/settings', protect, authorize('Admin', 'SuperAdmin'), getReferralSettings);
router.put('/admin/referrals/settings', protect, authorize('Admin', 'SuperAdmin'), updateReferralSettings);

// Instructor - Topics
router.get('/topics/categories', protect, getCategories);
router.get('/topics', protect, authorize('Instructor', 'Admin', 'SuperAdmin', 'User'), checkContentAccess, getTopics);
router.get('/topics/:id', protect, authorize('Instructor', 'Admin', 'SuperAdmin', 'User'), checkContentAccess, getTopicById);
router.post('/topics', protect, authorize('Instructor', 'Admin', 'SuperAdmin'), createTopic);
router.put('/topics/:id', protect, authorize('Instructor', 'Admin', 'SuperAdmin'), updateTopic);
router.patch('/topics/:id/status', protect, authorize('Instructor', 'Admin'), updateTopicStatus);
router.delete('/topics/:id', protect, authorize('Instructor', 'Admin'), deleteTopic);

// Instructor - Quizzes
router.get('/quizzes', protect, authorize('Instructor', 'Admin', 'SuperAdmin', 'User'), checkContentAccess, getQuizzes);
router.get('/quizzes/:id', protect, authorize('Instructor', 'Admin', 'SuperAdmin', 'User'), checkContentAccess, getQuizById);
router.post('/quizzes', protect, authorize('Instructor', 'Admin'), createQuiz);
router.put('/quizzes/:id', protect, authorize('Instructor', 'Admin'), updateQuiz);
router.delete('/quizzes/:id', protect, authorize('Instructor', 'Admin'), deleteQuiz);
router.post('/quizzes/:id/publish', protect, authorize('Instructor', 'Admin'), toggleQuizPublish);
router.get('/users/instructor-stats', protect, authorize('Instructor', 'Admin', 'SuperAdmin'), getInstructorStats);

// Student - Quiz Attempts
router.post('/quizzes/:id/submit', protect, checkContentAccess, submitQuiz);
router.get('/quizzes/:id/attempts', protect, checkContentAccess, getQuizAttempts);
router.get('/quizzes/:id/attempts/:attemptId', protect, checkContentAccess, getAttemptDetails);
router.get('/quizzes/:id/results', protect, checkContentAccess, getQuizAttempts); // Alias for results if needed

// Admin routes
router.get('/users', protect, authorize('Admin', 'SuperAdmin'), getAllUsers);
router.post('/users', protect, authorize('Admin', 'SuperAdmin'), createUser);
router.put('/users/:id', protect, authorize('Admin', 'SuperAdmin'), updateUser);
router.delete('/users/:id', protect, authorize('Admin', 'SuperAdmin'), deleteUser);
router.post('/users/:id/resend-verification', protect, authorize('Admin', 'SuperAdmin'), resendVerificationEmail);
router.post('/admin/instructors/:id/review', protect, authorize('Admin', 'SuperAdmin'), reviewInstructor);
router.get('/admin/analytics/dashboard', protect, authorize('Admin', 'SuperAdmin'), getDashboardStats);

// Admin Withdrawal Management
router.get('/admin/payments/withdrawals/pending', protect, authorize('Admin', 'SuperAdmin'), getPendingWithdrawals);
router.post('/admin/payments/withdrawals/:id/approve', protect, authorize('Admin', 'SuperAdmin'), approveWithdrawal);
router.post('/admin/payments/withdrawals/:id/reject', protect, authorize('Admin', 'SuperAdmin'), rejectWithdrawal);
router.post('/admin/payments/withdrawals/:id/complete', protect, authorize('Admin', 'SuperAdmin'), completeWithdrawal);
router.get('/admin/payments/refunds/pending', protect, authorize('Admin', 'SuperAdmin'), getPendingRefunds);
router.get('/admin/payments/transactions', protect, authorize('Admin', 'SuperAdmin'), getAllTransactionsAdmin);
router.post('/admin/payments/wallets/adjust-balance', protect, authorize('Admin', 'SuperAdmin'), adjustWalletBalance);
router.get('/admin/payments/wallets/user/:id', protect, authorize('Admin', 'SuperAdmin'), getUserForAdjustment);
router.get('/admin/payments/wallets/user/:id/transactions', protect, authorize('Admin', 'SuperAdmin'), getUserTransactions);

// Coupon routes
// Coupon routes
router.get('/coupons', protect, authorize('Admin', 'SuperAdmin'), getAllCoupons);
router.post('/coupons', protect, authorize('Admin', 'SuperAdmin'), createCoupon);
router.put('/coupons/:id', protect, authorize('Admin', 'SuperAdmin'), updateCoupon);
router.delete('/coupons/:id', protect, authorize('Admin', 'SuperAdmin'), deleteCoupon);
router.post('/coupons/validate', protect, validateCoupon);

// Super Admin routes (RBAC)
router.get('/superadmin/permissions', protect, authorize('SuperAdmin'), getAllPermissions);
router.get('/superadmin/users/:id/permissions', protect, authorize('SuperAdmin'), getUserPermissions);
router.post('/superadmin/users/:id/permissions', protect, authorize('SuperAdmin'), updateUserPermission);

// Payment routes
router.post('/payments/verify', protect, verifyRazorpayPayment);

// Agora routes
router.get('/agora/token', protect, getAgoraToken);

module.exports = router;
