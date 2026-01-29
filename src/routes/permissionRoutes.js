const express = require('express');
const router = express.Router();
const {
    getAllPermissions,
    getUserPermissions,
    updateUserPermission,
    grantUserPermission,
    revokeUserPermission,
    resetUserPermissions,
    getRolePermissions,
    updateRolePermissions
} = require('../controllers/superAdminController');
const { protect, authorize } = require('../middlewares/auth');

// All routes here are prefixed with /api/v1/permission-management
// And should be restricted to SuperAdmin
// All routes here are prefixed with /api/v1/permission-management
router.use(protect);

// Public-ish routes (Authenticated Admins/SuperAdmins need these for Dashboard)
router.get('/get-all-permissions', authorize('SuperAdmin', 'Admin'), getAllPermissions);
router.get('/users/:id', authorize('SuperAdmin', 'Admin'), getUserPermissions);

// Restricted routes (SuperAdmin only)
router.use(authorize('SuperAdmin'));

router.put('/users/:id', updateUserPermission);
router.post('/users/:id/grant', grantUserPermission);
router.post('/users/:id/revoke', revokeUserPermission);
router.post('/users/:id/reset', resetUserPermissions);

router.get('/roles/:id', getRolePermissions);
router.put('/roles/:id', updateRolePermissions);

module.exports = router;
