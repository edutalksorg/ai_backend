const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const upload = require('../middlewares/imageUploadMiddleware');
const { checkPermission } = require('../middlewares/accessControl'); // Assuming this middleware handles permissions? 
// Wait, init.js seeded 'Carousel.Manage' permission.
// Usually 'authorize' checks Roles. Does the system use specific Permissions middleware?
// In init.js: "['Carousel.Manage', 'Manage Carousel', 'SystemManagement', 'Manage']"
// In routes/index.js: "authorize('Admin', 'SuperAdmin')"
// I should use "protect, authorize('Admin', 'SuperAdmin')" for management routes.
// And maybe check the specific permission if RBAC is granular?
// The user said "add these persmiiisons also if super admin give persmiions to this carousel also it the card of carousal has to appear".
// So I should probably check for the *Permission* 'Carousel.Manage' if possible, or stick to Role for now and let the Permission UI handle the frontend visibility.
// Looking at existing routes (Step 263), I only see `authorize('Role')` ... oh wait, `permissionRoutes` uses `authorize('SuperAdmin')`.
// Is there a `checkPermission` middleware?
// I see `checkContentAccess` imported in index.js.
// Let's look at `middlewares/auth.js`.

const {
    getCarouselItems,
    getAllCarouselItemsAdmin,
    createCarouselItem,
    updateCarouselItem,
    deleteCarouselItem
} = require('../controllers/carouselController');

// Public/User route
router.get('/', protect, getCarouselItems); // Or maybe public? Dashboard is protected usually.

// Admin routes
router.get('/admin', protect, authorize('Admin', 'SuperAdmin'), getAllCarouselItemsAdmin);
router.post('/', protect, authorize('Admin', 'SuperAdmin'), upload.single('image'), createCarouselItem);
router.put('/:id', protect, authorize('Admin', 'SuperAdmin'), upload.single('image'), updateCarouselItem);
router.delete('/:id', protect, authorize('Admin', 'SuperAdmin'), deleteCarouselItem);

module.exports = router;
