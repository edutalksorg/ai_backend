const express = require('express');
const router = express.Router();
const { getSiteSettings, updateSiteSettings } = require('../controllers/siteSettingsController');
const { protect, authorize } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Settings
 *   description: Global site settings
 */

/**
 * @swagger
 * /settings/site:
 *   get:
 *     summary: Get public site settings
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Settings data
 */
router.get('/site', getSiteSettings);

/**
 * @swagger
 * /settings/site:
 *   post:
 *     summary: Update site settings (Admin)
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings updated
 */
router.post('/site', protect, authorize('Admin', 'SuperAdmin'), updateSiteSettings);

module.exports = router;
