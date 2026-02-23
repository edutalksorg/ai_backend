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

/**
 * @swagger
 * tags:
 *   name: Permissions
 *   description: Fine-grained user and role permission management
 */

/**
 * @swagger
 * /permission-management/get-all-permissions:
 *   get:
 *     summary: Get all system permissions (Admin/SuperAdmin)
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of permissions
 */
router.get('/get-all-permissions', authorize('SuperAdmin', 'Admin'), getAllPermissions);

/**
 * @swagger
 * /permission-management/users/{id}:
 *   get:
 *     summary: Get permissions for a specific user
 *     tags: [Permissions]
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
router.get('/users/:id', authorize('SuperAdmin', 'Admin'), getUserPermissions);

// Restricted routes (SuperAdmin only)
router.use(authorize('SuperAdmin'));

/**
 * @swagger
 * /permission-management/users/{id}:
 *   put:
 *     summary: Update user permissions (SuperAdmin)
 *     tags: [Permissions]
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
router.put('/users/:id', updateUserPermission);

/**
 * @swagger
 * /permission-management/users/{id}/grant:
 *   post:
 *     summary: Grant specific permission to user
 *     tags: [Permissions]
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
 *         description: Permission granted
 */
router.post('/users/:id/grant', grantUserPermission);
router.post('/users/:id/revoke', revokeUserPermission);
router.post('/users/:id/reset', resetUserPermissions);

router.get('/roles/:id', getRolePermissions);
router.put('/roles/:id', updateRolePermissions);

module.exports = router;
