const express = require('express');
const router = express.Router();
const { getSiteSettings, updateSiteSettings } = require('../controllers/siteSettingsController');
const { protect, authorize } = require('../middlewares/auth');

router.get('/site', getSiteSettings);
router.post('/site', protect, authorize('Admin', 'SuperAdmin'), updateSiteSettings);

module.exports = router;
