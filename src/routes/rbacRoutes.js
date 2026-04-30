const express = require("express");
const router = express.Router();
const rbacController = require("../controllers/rbacController");

// Get all permissions
router.get("/permissions", rbacController.getAllPermissions);

// Get role-specific permissions
router.get("/permissions/role/:role", rbacController.getRolePermissions);

// Get department-specific permissions
router.get("/permissions/department/:department", rbacController.getDepartmentPermissions);

// Update role permission
router.put("/permissions/role", rbacController.updateRolePermission);

// Update department permission
router.put("/permissions/department", rbacController.updateDepartmentPermission);

// Bulk update permissions
router.put("/permissions/bulk", rbacController.bulkUpdatePermissions);

// Delete permission
router.delete("/permissions/:id", rbacController.deletePermission);

// Get audit log
router.get("/audit-log", rbacController.getAuditLog);

module.exports = router;
