const RBAC = require("../models/RBAC");

// Get all RBAC permissions
exports.getAllPermissions = async (req, res) => {
  try {
    const permissions = await RBAC.find({});
    res.json(permissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get role-wise permissions
exports.getRolePermissions = async (req, res) => {
  try {
    const { role } = req.params;
    const permissions = await RBAC.find({ type: "role", name: role });
    res.json(permissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get department-wise permissions
exports.getDepartmentPermissions = async (req, res) => {
  try {
    const { department } = req.params;
    const permissions = await RBAC.find({ type: "department", name: department });
    res.json(permissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update role permission
exports.updateRolePermission = async (req, res) => {
  try {
    const { role, page, access, reason } = req.body;
    const userId = req.user?.id || "system";

    if (!role || !page || !access) {
      return res
        .status(400)
        .json({ error: "Missing required fields: role, page, access" });
    }

    const permission = await RBAC.findOneAndUpdate(
      { type: "role", name: role, page },
      {
        access,
        reason: reason || "Custom rule",
        updatedBy: userId,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({
      message: "Permission updated successfully",
      permission,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update department permission
exports.updateDepartmentPermission = async (req, res) => {
  try {
    const { department, page, access, reason } = req.body;
    const userId = req.user?.id || "system";

    if (!department || !page || !access) {
      return res.status(400).json({
        error: "Missing required fields: department, page, access",
      });
    }

    const permission = await RBAC.findOneAndUpdate(
      { type: "department", name: department, page },
      {
        access,
        reason: reason || "Custom rule",
        updatedBy: userId,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({
      message: "Permission updated successfully",
      permission,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete permission
exports.deletePermission = async (req, res) => {
  try {
    const { id } = req.params;
    await RBAC.findByIdAndDelete(id);
    res.json({ message: "Permission deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Bulk update permissions
exports.bulkUpdatePermissions = async (req, res) => {
  try {
    const { permissions } = req.body;
    const userId = req.user?.id || "system";

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: "permissions must be an array" });
    }

    const updates = permissions.map((perm) =>
      RBAC.findOneAndUpdate(
        { type: perm.type, name: perm.name, page: perm.page },
        {
          access: perm.access,
          reason: perm.reason || "Custom rule",
          updatedBy: userId,
          updatedAt: new Date(),
        },
        { upsert: true, new: true }
      )
    );

    const results = await Promise.all(updates);
    res.json({
      message: `${results.length} permissions updated successfully`,
      permissions: results,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get permission audit log
exports.getAuditLog = async (req, res) => {
  try {
    const { type, name } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (name) filter.name = name;

    const logs = await RBAC.find(filter).sort({ updatedAt: -1 }).limit(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
