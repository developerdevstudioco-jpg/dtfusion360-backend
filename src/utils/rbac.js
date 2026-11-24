const normalizeKey = (value) => (typeof value === "string" ? value.toLowerCase().replace(/[^a-z0-9]/g, "") : "")

const PROJECT_ACCESS_DEPARTMENTS = new Set(["rd", "npd", "researchdevelopment", "researchanddevelopment"])

const PROJECT_LEVEL_ROLE_KEYS = new Set([
  "assistantmanager",
  "deputymanager",
  "manager",
  "seniormanager",
  "generalmanager",
  "head",
  "director",
  "agm",
  "dgm",
  "gm",
])

const PROJECT_PERMISSIONS = Object.freeze({
  CREATE_TASKS: "create_tasks",
  EDIT_TASKS: "edit_tasks",
  DELETE_TASKS: "delete_tasks",
  ASSIGN_TASKS: "assign_tasks",
  REASSIGN_TASKS: "reassign_tasks",
  APPROVE_TASKS: "approve_tasks",
  REJECT_TASKS: "reject_tasks",
  UPDATE_TASK_STATUS: "update_task_status",
  VIEW_ALL_DEPARTMENTS: "view_all_departments",
  MANAGE_OVERALL_PROJECT: "manage_overall_project",
  ACCESS_COMPLETE_PROJECT_TIMELINE: "access_complete_project_timeline",
  VIEW_ALL_PROJECT_DOCUMENTS: "view_all_project_documents",
  MANAGE_CROSS_DEPARTMENT_ACTIVITIES: "manage_cross_department_activities",
})

const normalizeStringArray = (value) => {
  if (Array.isArray(value)) return value.filter((entry) => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean)
  if (typeof value === "string" && value.trim()) return [value.trim()]
  return []
}

const userDepartments = (user) => [
  ...normalizeStringArray(user?.department),
  ...normalizeStringArray(user?.departments),
  ...normalizeStringArray(user?.departmentIds),
]

const isAssistantManagerOrAbove = (role) => PROJECT_LEVEL_ROLE_KEYS.has(normalizeKey(role))

const isProjectAccessDepartment = (department) => PROJECT_ACCESS_DEPARTMENTS.has(normalizeKey(department))

const hasProjectWideAccess = (user) => (
  isAssistantManagerOrAbove(user?.role) && userDepartments(user).some(isProjectAccessDepartment)
)

const hasDepartmentLevelAccess = (user) => isAssistantManagerOrAbove(user?.role)

const hasDepartmentOverlap = (user, departmentIds) => {
  const normalizedUserDepartments = new Set(userDepartments(user).map(normalizeKey))
  return normalizeStringArray(departmentIds).some((departmentId) => normalizedUserDepartments.has(normalizeKey(departmentId)))
}

const canAccessDepartmentScope = (user, departmentIds) => (
  hasProjectWideAccess(user) || (hasDepartmentLevelAccess(user) && hasDepartmentOverlap(user, departmentIds))
)

const requireTaskPermission = (permission, getDepartmentIds) => (req, res, next) => {
  const departmentIds = getDepartmentIds(req)
  if (canAccessDepartmentScope(req.user, departmentIds)) return next()

  return res.status(403).json({
    message: "You do not have permission to perform this task action for the selected department",
    permission,
  })
}

module.exports = {
  PROJECT_PERMISSIONS,
  canAccessDepartmentScope,
  hasProjectWideAccess,
  hasDepartmentLevelAccess,
  requireTaskPermission,
}
