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
router.use(protect);
router.use(authorize('SuperAdmin'));

router.get('/get-all-permissions', getAllPermissions);

router.get('/users/:id', getUserPermissions);
router.put('/users/:id', updateUserPermission);
router.post('/users/:id/grant', grantUserPermission);
router.post('/users/:id/revoke', revokeUserPermission);
router.post('/users/:id/reset', resetUserPermissions);

router.get('/roles/:id', getRolePermissions);
router.put('/roles/:id', updateRolePermissions);

module.exports = router;
