const ApprovalRule = require("../models/ApprovalRule")

const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "")
const ADMIN_ROLES = new Set(["superadmin", "plantadmin", "admin"])
const APPROVER_ROLES = new Set(["qa", "departmentmanager", "assistantmanager", "deputymanager", "manager", "seniormanager", "generalmanager", "head", "director", "agm", "dgm", "gm", "planthead", "assistantvp", "asstvp", "vp", "coo", "cto", "ceo", "cfo", "vicechairman", "chairman"])

const departmentsOf = (user) => new Set([
  ...(Array.isArray(user?.departmentIds) ? user.departmentIds : []),
  ...(Array.isArray(user?.department) ? user.department : user?.department ? [user.department] : []),
].map(String))

function isAdmin(user) {
  return ADMIN_ROLES.has(normalize(user?.role))
}

function sameDepartment(user, departmentId) {
  return !departmentId || departmentsOf(user).has(String(departmentId))
}

function folderGrant(user, folder, action) {
  if (!folder?.permissions?.length) return null
  const grants = folder.permissions.filter((entry) => {
    if (entry.principalType === "user") return String(entry.principalId) === String(user.id)
    if (entry.principalType === "role") return normalize(entry.principalId) === normalize(user.role)
    if (entry.principalType === "department") return departmentsOf(user).has(String(entry.principalId))
    return false
  })
  return grants.length ? grants.some((entry) => entry.actions.includes(action) || entry.actions.includes("repository.admin")) : null
}

function can(user, action, resource = {}) {
  if (!user) return false
  if (isAdmin(user)) return true
  const explicit = folderGrant(user, resource.folder, action)
  if (explicit !== null) return explicit
  const owns = String(resource.ownerId || resource.createdBy || "") === String(user.id)
  const departmentMatch = sameDepartment(user, resource.departmentId || resource.folder?.departmentId)

  if (["repository.view", "repository.download", "document.viewRevisionHistory"].includes(action)) return departmentMatch
  if (["repository.upload", "document.create"].includes(action)) return departmentMatch
  if (["document.editMetadata", "document.submitRevision", "document.archive"].includes(action)) return owns || departmentMatch
  if (["repository.createFolder", "repository.rename", "repository.move"].includes(action)) return APPROVER_ROLES.has(normalize(user.role))
  if (["document.approve", "document.reject", "document.requestChanges"].includes(action)) return APPROVER_ROLES.has(normalize(user.role))
  if (["repository.managePermissions", "repository.manageApprovalRules", "repository.admin"].includes(action)) return false
  return false
}

async function canApprove(user, document) {
  if (!can(user, "document.approve", document)) return false
  const rule = await ApprovalRule.findOne({
    active: true,
    $and: [
      { $or: [{ departmentId: "" }, { departmentId: document.departmentId }] },
      { $or: [{ folderId: null }, { folderId: document.folderId }] },
      { $or: [{ documentType: "" }, { documentType: document.documentType }] },
      { $or: [{ controlledDocument: null }, { controlledDocument: document.controlledDocument }] },
    ],
  }).sort({ priority: 1 }).lean()
  if (!rule || !rule.stages?.length) return true
  const firstStage = [...rule.stages].sort((a, b) => a.order - b.order)[0]
  return firstStage.userIds?.some((id) => String(id) === String(user.id)) || firstStage.roleKeys?.some((role) => normalize(role) === normalize(user.role))
}

module.exports = { can, canApprove, isAdmin, normalize }
