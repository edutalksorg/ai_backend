const express = require('express');
const router = express.Router();
const {
    getParagraphs,
    getParagraph,
    createParagraph,
    updateParagraph,
    deleteParagraph,

    publishParagraph,
    convertParagraphToSpeech,
    assessPronunciation
} = require('../controllers/pronunciationController');
const { protect, authorize } = require('../middlewares/auth');

// Public/Student routes - Added protect to populate req.user for instructors
router.get('/paragraphs', protect, getParagraphs); // Handles both student (published) and instructor (all) via query param
router.get('/paragraphs/:id', protect, getParagraph);

// Instructor routes
router.post('/paragraphs', protect, authorize('Instructor', 'Admin'), createParagraph);
router.put('/paragraphs/:id', protect, authorize('Instructor', 'Admin'), updateParagraph);
router.delete('/paragraphs/:id', protect, authorize('Instructor', 'Admin'), deleteParagraph);
router.post('/paragraphs/:id/publish', protect, authorize('Instructor', 'Admin'), publishParagraph);
// Basic assess route (no ID needed if audio blob contains everything, or simplify for demo)
router.post('/assess', protect, authorize('Instructor', 'Admin', 'User', 'Learner'), assessPronunciation);
router.post('/paragraphs/assess', protect, authorize('Instructor', 'Admin', 'User', 'Learner'), assessPronunciation);
router.post('/paragraphs/:id/assess', protect, authorize('Instructor', 'Admin', 'User', 'Learner'), assessPronunciation);

router.post('/paragraphs/:id/convert-paragraph-to-speech', protect, authorize('Instructor', 'Admin', 'User', 'Learner'), convertParagraphToSpeech);

module.exports = router;
