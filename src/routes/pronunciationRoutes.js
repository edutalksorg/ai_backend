const express = require('express');
const router = express.Router();
const {
    getParagraphs,
    getParagraph,
    createParagraph,
    updateParagraph,
    deleteParagraph,
    publishParagraph
} = require('../controllers/pronunciationController');
const { protect, authorize } = require('../middlewares/auth');

// Public/Student routes
router.get('/paragraphs', getParagraphs); // Handles both student (published) and instructor (all) via query param
router.get('/paragraphs/:id', getParagraph);

// Instructor routes
router.post('/paragraphs', protect, authorize('Instructor', 'Admin'), createParagraph);
router.put('/paragraphs/:id', protect, authorize('Instructor', 'Admin'), updateParagraph);
router.delete('/paragraphs/:id', protect, authorize('Instructor', 'Admin'), deleteParagraph);
router.post('/paragraphs/:id/publish', protect, authorize('Instructor', 'Admin'), publishParagraph);

module.exports = router;
