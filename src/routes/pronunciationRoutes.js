const express = require('express');
const router = express.Router();
const {
    getParagraphs,
    getParagraph,
    createParagraph,
    updateParagraph,
    deleteParagraph,

    publishParagraph, // Changed from togglePublish to publishParagraph
    convertParagraphToSpeech,
    assessPronunciation
} = require('../controllers/pronunciationController');
const { protect, authorize } = require('../middlewares/auth');
const { checkContentAccess } = require('../middlewares/accessControl'); // Added checkContentAccess import

// Public/Student routes - Added protect to populate req.user for instructors
/**
 * @swagger
 * tags:
 *   name: Pronunciation
 *   description: AI Pronunciation assessment and TTS
 */

/**
 * @swagger
 * /pronunciation/paragraphs:
 *   get:
 *     summary: Get practice paragraphs
 *     tags: [Pronunciation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of paragraphs
 */
router.get('/paragraphs', protect, checkContentAccess, getParagraphs);

/**
 * @swagger
 * /pronunciation/paragraphs/{id}:
 *   get:
 *     summary: Get a specific paragraph
 *     tags: [Pronunciation]
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
 *         description: Paragraph data
 */
router.get('/paragraphs/:id', protect, checkContentAccess, getParagraph);

/**
 * @swagger
 * /pronunciation/paragraphs:
 *   post:
 *     summary: Create a new paragraph (Instructor)
 *     tags: [Pronunciation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Paragraph created
 */
router.post('/paragraphs', protect, authorize('Instructor', 'Admin'), createParagraph);
router.put('/paragraphs/:id', protect, authorize('Instructor', 'Admin'), updateParagraph);
router.delete('/paragraphs/:id', protect, authorize('Instructor', 'Admin'), deleteParagraph);
router.post('/paragraphs/:id/publish', protect, authorize('Instructor', 'Admin'), publishParagraph);

/**
 * @swagger
 * /pronunciation/assess:
 *   post:
 *     summary: Assess pronunciation of audio
 *     tags: [Pronunciation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Assessment result
 */
router.post('/assess', protect, authorize('Instructor', 'Admin', 'User', 'Learner'), assessPronunciation);
router.post('/paragraphs/assess', protect, authorize('Instructor', 'Admin', 'User', 'Learner'), assessPronunciation);
router.post('/paragraphs/:id/assess', protect, authorize('Instructor', 'Admin', 'User', 'Learner'), assessPronunciation);

/**
 * @swagger
 * /pronunciation/paragraphs/{id}/convert-paragraph-to-speech:
 *   post:
 *     summary: Convert paragraph to speech (TTS)
 *     tags: [Pronunciation]
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
 *         description: Audio stream
 */
router.post('/paragraphs/:id/convert-paragraph-to-speech', protect, authorize('Instructor', 'Admin', 'User', 'Learner'), convertParagraphToSpeech);

module.exports = router;
