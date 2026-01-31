const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    getProfile,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerification
} = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', protect, getProfile);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

module.exports = router;
