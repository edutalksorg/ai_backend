const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const { protect, authorize } = require('../middlewares/auth');
const upload = require('../middlewares/uploadMiddleware'); // Import upload middleware
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
    resendVerificationEmail,
    getCouponUsageUsers
} = require('../controllers/adminController');
const { submitQuiz, getQuizAttempts, getAttemptDetails } = require('../controllers/quizAttemptController');
const {
    getAllPermissions,
    getUserPermissions,
    updateUserPermission
} = require('../controllers/superAdminController');
const { verifyRazorpayPayment, getPaymentStatus } = require('../controllers/paymentController');
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
    rateCall,
    uploadRecording // Import uploadRecording
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
const {
    sendRequest,
    acceptRequest,
    rejectRequest,
    getConnections
} = require('../controllers/userConnectionController');
const pronunciationRoutes = require('./pronunciationRoutes');
const subscriptionRoutes = require('./subscriptionRoutes');
const permissionRoutes = require('./permissionRoutes');
const carouselRoutes = require('./carouselRoutes');
const settingsRoutes = require('./settingsRoutes');

// Auth routes
router.use('/auth', authRoutes);
router.use('/pronunciation', pronunciationRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/Subscriptions', subscriptionRoutes); // Handle frontend case inconsistency
router.use('/permission-management', permissionRoutes);
router.use('/carousel', carouselRoutes);
router.use('/settings', settingsRoutes);

// User routes
/**
 * @swagger
 * tags:
 *   name: User
 *   description: User profile and progress tracking
 */

/**
 * @swagger
 * /users/progress/summary:
 *   get:
 *     summary: Get user progress summary
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Progress summary data
 */
router.get('/users/progress/summary', protect, getProgressSummary);

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Get user profile details
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile data
 */
router.get('/users/profile', protect, getUserProfile);

/**
 * @swagger
 * /users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.put('/users/profile', protect, updateProfile);
router.put('/auth/profile', protect, updateProfile); // Keep for compatibility if needed

/**
 * @swagger
 * /users/availability:
 *   post:
 *     summary: Update online availability status
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated
 */
router.post('/users/availability', protect, updateAvailability); // For Online Status

// Wallet routes
/**
 * @swagger
 * tags:
 *   name: Wallet
 *   description: User wallet and transaction management
 */

/**
 * @swagger
 * /wallet/balance:
 *   get:
 *     summary: Get wallet balance
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Balance data
 */
router.get('/wallet/balance', protect, getWallet);

/**
 * @swagger
 * /wallet/transactions:
 *   get:
 *     summary: Get wallet transaction history
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of transactions
 */
router.get('/wallet/transactions', protect, getTransactions);

/**
 * @swagger
 * /wallet/withdraw:
 *   post:
 *     summary: Request withdrawal from wallet
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Withdrawal requested
 */
router.post('/wallet/withdraw', protect, withdraw);

// Call routes
/**
 * @swagger
 * tags:
 *   name: Calls
 *   description: Voice call management and Agora integration
 */

/**
 * @swagger
 * /calls/availability:
 *   put:
 *     summary: Update call availability status
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isAvailable:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Availability updated
 */
router.put('/calls/availability', protect, updateAvailability);

/**
 * @swagger
 * /calls/available-users:
 *   get:
 *     summary: Get list of users available for calls
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of available users
 */
router.get('/calls/available-users', protect, getAvailableUsers);

/**
 * @swagger
 * /calls/initiate:
 *   post:
 *     summary: Initiate a voice call
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               receiverId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Call initiated
 */
router.post('/calls/initiate', protect, initiateCall);

/**
 * @swagger
 * /calls/initiate-random:
 *   post:
 *     summary: Initiate a random voice call
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Random call initiated
 */
router.post('/calls/initiate-random', protect, initiateRandomCall);

/**
 * @swagger
 * /calls/{id}/respond:
 *   post:
 *     summary: Respond to an incoming call
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [accepted, rejected]
 *     responses:
 *       200:
 *         description: Response recorded
 */
router.post('/calls/:id/respond', protect, respondToCall);

/**
 * @swagger
 * /calls/{id}/end:
 *   post:
 *     summary: End an active call
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Call ended
 */
router.post('/calls/:id/end', protect, endCall);

/**
 * @swagger
 * /calls/history:
 *   get:
 *     summary: Get user call history
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Call history data
 */
router.get('/calls/history', protect, getCallHistory);

/**
 * @swagger
 * /calls/agora-token:
 *   get:
 *     summary: Get Agora token for a session
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Agora token generated
 */
router.get('/calls/agora-token', protect, getAgoraToken);

/**
 * @swagger
 * /calls/{id}/rate:
 *   post:
 *     summary: Rate a completed call
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: number
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Rating submitted
 */
router.post('/calls/:id/rate', protect, rateCall);

/**
 * @swagger
 * /calls/{id}/recording:
 *   post:
 *     summary: Upload call recording
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Recording uploaded
 */
router.post('/calls/:id/recording', protect, upload.single('file'), uploadRecording);

// Connection routes (Friend Management)
/**
 * @swagger
 * tags:
 *   name: Connections
 *   description: Friend management and connection requests
 */

/**
 * @swagger
 * /connections:
 *   get:
 *     summary: Get list of friends/connections
 *     tags: [Connections]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of connections
 */
router.get('/connections', protect, getConnections);

/**
 * @swagger
 * /connections/request:
 *   post:
 *     summary: Send a friend request
 *     tags: [Connections]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               receiverId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Request sent
 */
router.post('/connections/request', protect, sendRequest);

/**
 * @swagger
 * /connections/accept/{id}:
 *   post:
 *     summary: Accept a friend request
 *     tags: [Connections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Request accepted
 */
router.post('/connections/accept/:id', protect, acceptRequest);

/**
 * @swagger
 * /connections/reject/{id}:
 *   post:
 *     summary: Reject a friend request
 *     tags: [Connections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Request rejected
 */
router.post('/connections/reject/:id', protect, rejectRequest);

// Referral routes
/**
 * @swagger
 * tags:
 *   name: Referrals
 *   description: Referral program and statistics
 */

/**
 * @swagger
 * /referrals/stats:
 *   get:
 *     summary: Get user referral statistics
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referral stats
 */
router.get('/referrals/stats', protect, getReferralStats);

/**
 * @swagger
 * /referrals/my-code:
 *   get:
 *     summary: Get user's personal referral code
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's referral code
 */
router.get('/referrals/my-code', protect, getMyCode);

/**
 * @swagger
 * /referrals/history:
 *   get:
 *     summary: Get referral conversion history
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of referral coversions
 */
router.get('/referrals/history', protect, getReferralHistory);

/**
 * @swagger
 * /referrals/validate/{code}:
 *   get:
 *     summary: Validate a referral code (Public)
 *     tags: [Referrals]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Validation result
 */
router.get('/referrals/validate/:code', validateReferralCode); // Public route
// Admin Referral Settings
router.get('/admin/referrals/settings', protect, authorize('Admin', 'SuperAdmin'), getReferralSettings);
router.put('/admin/referrals/settings', protect, authorize('Admin', 'SuperAdmin'), updateReferralSettings);

// Instructor - Topics
/**
 * @swagger
 * tags:
 *   name: Learning
 *   description: Topics and Quizzes management
 */

/**
 * @swagger
 * /topics/categories:
 *   get:
 *     summary: Get all topic categories
 *     tags: [Learning]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of categories
 */
router.get('/topics/categories', protect, getCategories);

/**
 * @swagger
 * /topics:
 *   get:
 *     summary: Get all topics
 *     tags: [Learning]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of topics
 */
router.get('/topics', protect, authorize('Instructor', 'Admin', 'SuperAdmin', 'User'), checkContentAccess, getTopics);

/**
 * @swagger
 * /topics/{id}:
 *   get:
 *     summary: Get topic by ID
 *     tags: [Learning]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Topic data
 */
router.get('/topics/:id', protect, authorize('Instructor', 'Admin', 'SuperAdmin', 'User'), checkContentAccess, getTopicById);

/**
 * @swagger
 * /topics:
 *   post:
 *     summary: Create a new topic
 *     tags: [Learning]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *     responses:
 *       201:
 *         description: Topic created
 */
router.post('/topics', protect, authorize('Instructor', 'Admin', 'SuperAdmin'), createTopic);

/**
 * @swagger
 * /topics/{id}:
 *   put:
 *     summary: Update a topic
 *     tags: [Learning]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Topic updated
 */
router.put('/topics/:id', protect, authorize('Instructor', 'Admin', 'SuperAdmin'), updateTopic);

/**
 * @swagger
 * /topics/{id}/status:
 *   patch:
 *     summary: Update topic status
 *     tags: [Learning]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch('/topics/:id/status', protect, authorize('Instructor', 'Admin'), updateTopicStatus);

/**
 * @swagger
 * /topics/{id}:
 *   delete:
 *     summary: Delete a topic
 *     tags: [Learning]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Topic deleted
 */
router.delete('/topics/:id', protect, authorize('Instructor', 'Admin'), deleteTopic);

// Instructor - Quizzes
/**
 * @swagger
 * /quizzes:
 *   get:
 *     summary: Get all quizzes
 *     tags: [Learning]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of quizzes
 */
router.get('/quizzes', protect, authorize('Instructor', 'Admin', 'SuperAdmin', 'User'), checkContentAccess, getQuizzes);

/**
 * @swagger
 * /quizzes/{id}:
 *   get:
 *     summary: Get quiz by ID
 *     tags: [Learning]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Quiz data
 */
router.get('/quizzes/:id', protect, authorize('Instructor', 'Admin', 'SuperAdmin', 'User'), checkContentAccess, getQuizById);

/**
 * @swagger
 * /quizzes:
 *   post:
 *     summary: Create a new quiz
 *     tags: [Learning]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Quiz created
 */
router.post('/quizzes', protect, authorize('Instructor', 'Admin'), createQuiz);

/**
 * @swagger
 * /quizzes/{id}:
 *   put:
 *     summary: Update a quiz
 *     tags: [Learning]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Quiz updated
 */
router.put('/quizzes/:id', protect, authorize('Instructor', 'Admin'), updateQuiz);

/**
 * @swagger
 * /quizzes/{id}:
 *   delete:
 *     summary: Delete a quiz
 *     tags: [Learning]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Quiz deleted
 */
router.delete('/quizzes/:id', protect, authorize('Instructor', 'Admin'), deleteQuiz);

/**
 * @swagger
 * /quizzes/{id}/publish:
 *   post:
 *     summary: Toggle quiz publish status
 *     tags: [Learning]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Publish status toggled
 */
router.post('/quizzes/:id/publish', protect, authorize('Instructor', 'Admin'), toggleQuizPublish);

/**
 * @swagger
 * /users/instructor-stats:
 *   get:
 *     summary: Get instructor statistics
 *     tags: [Learning]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Instructor stats
 */
router.get('/users/instructor-stats', protect, authorize('Instructor', 'Admin', 'SuperAdmin'), getInstructorStats);

// Student - Quiz Attempts
/**
 * @swagger
 * tags:
 *   name: Quiz Attempts
 *   description: Student quiz submission and attempt history
 */

/**
 * @swagger
 * /quizzes/{id}/submit:
 *   post:
 *     summary: Submit quiz answers
 *     tags: [Quiz Attempts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Quiz submitted
 */
router.post('/quizzes/:id/submit', protect, checkContentAccess, submitQuiz);

/**
 * @swagger
 * /quizzes/{id}/attempts:
 *   get:
 *     summary: Get user attempts for a quiz
 *     tags: [Quiz Attempts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of attempts
 */
router.get('/quizzes/:id/attempts', protect, checkContentAccess, getQuizAttempts);

/**
 * @swagger
 * /quizzes/{id}/attempts/{attemptId}:
 *   get:
 *     summary: Get specific attempt details
 *     tags: [Quiz Attempts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: attemptId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attempt details
 */
router.get('/quizzes/:id/attempts/:attemptId', protect, checkContentAccess, getAttemptDetails);
router.get('/quizzes/:id/results', protect, checkContentAccess, getQuizAttempts); // Alias for results if needed

// Admin routes
/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: System administration and user management
 */

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users (Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/users', protect, authorize('Admin', 'SuperAdmin'), getAllUsers);

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a new user (Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: User created
 */
router.post('/users', protect, authorize('Admin', 'SuperAdmin'), createUser);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update a user (Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User updated
 */
router.put('/users/:id', protect, authorize('Admin', 'SuperAdmin'), updateUser);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete a user (Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted
 */
router.delete('/users/:id', protect, authorize('Admin', 'SuperAdmin'), deleteUser);

/**
 * @swagger
 * /users/{id}/resend-verification:
 *   post:
 *     summary: Resend verification email to user (Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email resent
 */
router.post('/users/:id/resend-verification', protect, authorize('Admin', 'SuperAdmin'), resendVerificationEmail);

/**
 * @swagger
 * /admin/instructors/{id}/review:
 *   post:
 *     summary: Review instructor application (Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Instructor reviewed
 */
router.post('/admin/instructors/:id/review', protect, authorize('Admin', 'SuperAdmin'), reviewInstructor);

/**
 * @swagger
 * /admin/analytics/dashboard:
 *   get:
 *     summary: Get dashboard analytics (Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics data
 */
router.get('/admin/analytics/dashboard', protect, authorize('Admin', 'SuperAdmin'), getDashboardStats);

// Admin Withdrawal Management
/**
 * @swagger
 * /admin/payments/withdrawals/pending:
 *   get:
 *     summary: Get pending withdrawals (Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending withdrawals
 */
router.get('/admin/payments/withdrawals/pending', protect, authorize('Admin', 'SuperAdmin'), getPendingWithdrawals);

/**
 * @swagger
 * /admin/payments/withdrawals/{id}/approve:
 *   post:
 *     summary: Approve withdrawal (Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Withdrawal approved
 */
router.post('/admin/payments/withdrawals/:id/approve', protect, authorize('Admin', 'SuperAdmin'), approveWithdrawal);
router.post('/admin/payments/withdrawals/:id/reject', protect, authorize('Admin', 'SuperAdmin'), rejectWithdrawal);
router.post('/admin/payments/withdrawals/:id/complete', protect, authorize('Admin', 'SuperAdmin'), completeWithdrawal);
router.get('/admin/payments/refunds/pending', protect, authorize('Admin', 'SuperAdmin'), getPendingRefunds);
router.get('/admin/payments/transactions', protect, authorize('Admin', 'SuperAdmin'), getAllTransactionsAdmin);
router.post('/admin/payments/wallets/adjust-balance', protect, authorize('Admin', 'SuperAdmin'), adjustWalletBalance);
router.get('/admin/payments/wallets/user/:id', protect, authorize('Admin', 'SuperAdmin'), getUserForAdjustment);
router.get('/admin/payments/wallets/user/:id/transactions', protect, authorize('Admin', 'SuperAdmin'), getUserTransactions);

// Admin Call Management
router.get('/admin/calls', protect, authorize('Admin', 'SuperAdmin'), (req, res, next) => {
    const { getAllCalls } = require('../controllers/callController');
    getAllCalls(req, res, next);
});
router.delete('/admin/calls/:id', protect, authorize('SuperAdmin'), (req, res, next) => {
    const { adminDeleteCall } = require('../controllers/callController');
    adminDeleteCall(req, res, next);
});

// Coupon routes
/**
 * @swagger
 * tags:
 *   name: Coupons
 *   description: Discount coupon management
 */

/**
 * @swagger
 * /coupons:
 *   get:
 *     summary: Get all coupons (Admin)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of coupons
 */
router.get('/coupons', protect, authorize('Admin', 'SuperAdmin'), getAllCoupons);

/**
 * @swagger
 * /coupons:
 *   post:
 *     summary: Create a new coupon (Admin)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Coupon created
 */
router.post('/coupons', protect, authorize('Admin', 'SuperAdmin'), createCoupon);
router.put('/coupons/:id', protect, authorize('Admin', 'SuperAdmin'), updateCoupon);
router.delete('/coupons/:id', protect, authorize('Admin', 'SuperAdmin'), deleteCoupon);

/**
 * @swagger
 * /coupons/validate:
 *   post:
 *     summary: Validate a coupon code
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Validation Result
 */
router.post('/coupons/validate', protect, validateCoupon);
router.get('/admin/coupons/:id/users', protect, authorize('Admin', 'SuperAdmin'), getCouponUsageUsers);


// Super Admin routes (RBAC)
/**
 * @swagger
 * tags:
 *   name: RBAC
 *   description: Role Based Access Control management (SuperAdmin)
 */

/**
 * @swagger
 * /superadmin/permissions:
 *   get:
 *     summary: Get all system permissions
 *     tags: [RBAC]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of permissions
 */
router.get('/superadmin/permissions', protect, authorize('SuperAdmin'), getAllPermissions);

/**
 * @swagger
 * /superadmin/users/{id}/permissions:
 *   get:
 *     summary: Get permissions for a specific user
 *     tags: [RBAC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User permissions
 */
router.get('/superadmin/users/:id/permissions', protect, authorize('SuperAdmin'), getUserPermissions);

/**
 * @swagger
 * /superadmin/users/{id}/permissions:
 *   post:
 *     summary: Update permissions for a user
 *     tags: [RBAC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Permissions updated
 */
router.post('/superadmin/users/:id/permissions', protect, authorize('SuperAdmin'), updateUserPermission);

// Payment routes
/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment verification and status
 */

/**
 * @swagger
 * /payments/verify:
 *   post:
 *     summary: Verify Razorpay payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment verified
 */
router.post('/payments/verify', protect, verifyRazorpayPayment);

/**
 * @swagger
 * /payments/{orderId}/status:
 *   get:
 *     summary: Get payment status
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status data
 */
router.get('/payments/:orderId/status', protect, getPaymentStatus);

// Agora routes
/**
 * @swagger
 * tags:
 *   name: Agora
 *   description: Agora RTC token management
 */

/**
 * @swagger
 * /agora/token:
 *   get:
 *     summary: Get Agora RTC token
 *     tags: [Agora]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Agora token
 */
router.get('/agora/token', protect, getAgoraToken);

module.exports = router;
