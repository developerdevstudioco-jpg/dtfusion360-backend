const jwt = require("jsonwebtoken")
const Project = require("../models/Project")
const User = require("../models/Users")
const Conversation = require("../models/Conversation")
const MessageAuditLog = require("../models/MessageAuditLog")
const mongoose = require("mongoose")
const { sendProjectCreationEmail } = require("../services/projectCreationEmailService")

const PROJECT_NOTIFICATION_ROLE_KEYS = new Set(["manager", "deputymanager", "assistantmanager"])
const PROJECT_APPROVER_ROLE_KEYS = new Set([
  "assistantmanager",
  "deputymanager",
  "manager",
  "agm",
  "dgm",
  "gm",
  "planthead",
  "admin",
  "plantadmin",
  "superadmin",
  "asstvp",
  "vp",
  "coo",
  "cto",
  "ceo",
  "cfo",
  "vicechairman",
  "chairman",
])
const PROJECT_EDITABLE_FIELDS = [
  "plantId",
  "plant",
  "customer",
  "name",
  "rfqNo",
  "apqpNo",
  "vehicleModel",
  "partCode",
  "sopDate",
  "sopVolume",
  "startDate",
  "endDate",
  "projectLeadId",
  "projectLead",
  "departmentId",
  "cftMemberIds",
  "cftMembers",
  "status",
  "description",
  "selectedTasks",
  "drs",
  "workflowTasks",
  "projectFiles",
  "notifiedUserIds",
  "notificationChannels",
  "phase",
  "progress",
  "monthlyForecast",
]

const DIRECT_APPROVAL_REQUIRED_FIELDS = [
  "plantId",
  "plant",
  "customer",
  "name",
  "rfqNo",
  "apqpNo",
  "vehicleModel",
  "partCode",
  "sopDate",
  "sopVolume",
  "startDate",
  "endDate",
  "projectLeadId",
  "projectLead",
  "departmentId",
  "cftMemberIds",
  "cftMembers",
  "description",
  "selectedTasks",
  "drs",
  "notifiedUserIds",
  "notificationChannels",
]

const normalizeString = (value) => (typeof value === "string" ? value.trim() : "")

const normalizeStringArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return [value.trim()]
  }

  return []
}

const normalizeMonthlyForecast = (value) => {
  const source = value instanceof Map
    ? Object.fromEntries(value.entries())
    : value && typeof value === "object" && !Array.isArray(value) ? value : {}

  return Object.fromEntries(
    Object.entries(source)
      .filter(([month, quantity]) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && quantity !== "" && quantity !== null && quantity !== undefined)
      .map(([month, quantity]) => [month, String(quantity).trim()])
      .filter(([, quantity]) => quantity !== "" && Number.isFinite(Number(quantity)) && Number(quantity) >= 0)
  )
}

const normalizeArray = (value) => (Array.isArray(value) ? value : [])

const comparableProjectValue = (value) => {
  if (value == null) {
    return ""
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim()
  }

  return JSON.stringify(value)
}

const normalizeRoleKey = (value) => (
  typeof value === "string"
    ? value.toLowerCase().replace(/[^a-z0-9]/g, "")
    : ""
)

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || "secretkey")
  } catch (error) {
    return null
  }
}

const formatPendingApprovalRequest = (request) => {
  if (!request || typeof request !== "object") {
    return null
  }

  return {
    id: normalizeString(request.id),
    type: normalizeString(request.type),
    status: normalizeString(request.status) || "pending",
    requestedById: normalizeString(request.requestedById),
    requestedByName: normalizeString(request.requestedByName),
    requestedAt: request.requestedAt ? new Date(request.requestedAt).toISOString() : "",
    reason: normalizeString(request.reason),
    proposedChanges: request.proposedChanges && typeof request.proposedChanges === "object"
      ? request.proposedChanges
      : undefined,
    approvedById: normalizeString(request.approvedById),
    approvedByName: normalizeString(request.approvedByName),
    approvedAt: request.approvedAt ? new Date(request.approvedAt).toISOString() : "",
    rejectedById: normalizeString(request.rejectedById),
    rejectedByName: normalizeString(request.rejectedByName),
    rejectedAt: request.rejectedAt ? new Date(request.rejectedAt).toISOString() : "",
    rejectionReason: normalizeString(request.rejectionReason),
  }
}

const formatProject = (project, detailsLoaded = true) => ({
  id: project.id || project._id?.toString(),
  customer: project.customer || "",
  name: project.name || "",
  plantId: project.plantId || "",
  plant: project.plant || "",
  rfqNo: project.rfqNo || "",
  apqpNo: project.apqpNo || "",
  vehicleModel: project.vehicleModel || "",
  partCode: project.partCode || "",
  sopDate: project.sopDate || "",
  sopVolume: project.sopVolume || "",
  startDate: project.startDate || "",
  endDate: project.endDate || "",
  projectLeadId: project.projectLeadId || "",
  projectLead: project.projectLead || "",
  departmentId: project.departmentId || "",
  cftMemberIds: normalizeStringArray(project.cftMemberIds),
  cftMembers: normalizeStringArray(project.cftMembers),
  status: project.status || "Active",
  description: project.description || "",
  selectedTasks: normalizeStringArray(project.selectedTasks),
  drs: normalizeArray(project.drs),
  workflowTasks: normalizeArray(project.workflowTasks),
  projectFiles: normalizeArray(project.projectFiles),
  notifiedUserIds: normalizeStringArray(project.notifiedUserIds),
  notificationChannels: normalizeStringArray(project.notificationChannels),
  phase: project.phase || "",
  progress: typeof project.progress === "number" ? project.progress : 0,
  monthlyForecast: normalizeMonthlyForecast(project.monthlyForecast),
  createdById: project.createdById || "",
  createdByName: project.createdByName || "",
  pendingApprovalRequest: formatPendingApprovalRequest(project.pendingApprovalRequest),
  createdAt: project.createdAt ? new Date(project.createdAt).toISOString() : new Date().toISOString(),
  detailsLoaded,
})

const isApproverRole = (role) => PROJECT_APPROVER_ROLE_KEYS.has(normalizeRoleKey(role))
const isDeputyManagerRole = (role) => normalizeRoleKey(role) === "deputymanager"
const isSuperAdminRole = (role) => normalizeRoleKey(role) === "superadmin"

const getAccessiblePlantIds = (user) => normalizeStringArray(user?.plantIds ?? user?.plant)

const canAccessPlant = (user, plantId) => {
  if (isSuperAdminRole(user?.role)) {
    return true
  }

  return Boolean(plantId) && getAccessiblePlantIds(user).includes(plantId)
}

const getScopedPlantIds = (user, requestedPlantIds = []) => {
  const normalizedRequestedPlantIds = normalizeStringArray(requestedPlantIds)

  if (isSuperAdminRole(user?.role)) {
    return normalizedRequestedPlantIds
  }

  const accessiblePlantIds = getAccessiblePlantIds(user)

  if (normalizedRequestedPlantIds.length === 0) {
    return accessiblePlantIds
  }

  return normalizedRequestedPlantIds.filter((plantId) => accessiblePlantIds.includes(plantId))
}

const normalizeProjectEditChanges = (value) => {
  if (!value || typeof value !== "object") {
    return {}
  }

  const changes = {}

  for (const field of PROJECT_EDITABLE_FIELDS) {
    if (!(field in value)) {
      continue
    }

    if (["progress"].includes(field)) {
      if (typeof value[field] === "number" || typeof value[field] === "string") {
        changes[field] = Number(value[field]) || 0
      }
      continue
    }

    if (["cftMemberIds", "cftMembers", "selectedTasks", "notifiedUserIds", "notificationChannels"].includes(field)) {
      changes[field] = normalizeStringArray(value[field])
      continue
    }

    if (["drs", "workflowTasks", "projectFiles"].includes(field)) {
      changes[field] = normalizeArray(value[field])
      continue
    }

    if (field === "monthlyForecast") {
      changes[field] = normalizeMonthlyForecast(value[field])
      continue
    }

    if (typeof value[field] === "string" || typeof value[field] === "number") {
      changes[field] = String(value[field]).trim()
    }
  }

  return changes
}

const applyProjectChanges = (project, updates) => {
  if (typeof updates.plantId === "string") project.plantId = updates.plantId.trim()
  if (typeof updates.plant === "string") project.plant = updates.plant.trim()
  if (typeof updates.customer === "string") project.customer = updates.customer.trim()
  if (typeof updates.name === "string") project.name = updates.name.trim()
  if (typeof updates.rfqNo === "string") project.rfqNo = updates.rfqNo.trim()
  if (typeof updates.apqpNo === "string") project.apqpNo = updates.apqpNo.trim()
  if (typeof updates.vehicleModel === "string") project.vehicleModel = updates.vehicleModel.trim()
  if (typeof updates.partCode === "string") project.partCode = updates.partCode.trim()
  if (typeof updates.sopDate === "string") project.sopDate = updates.sopDate.trim()
  if (typeof updates.sopVolume === "string" || typeof updates.sopVolume === "number") project.sopVolume = String(updates.sopVolume).trim()
  if (typeof updates.startDate === "string") project.startDate = updates.startDate.trim()
  if (typeof updates.endDate === "string") project.endDate = updates.endDate.trim()
  if (typeof updates.projectLeadId === "string") project.projectLeadId = updates.projectLeadId.trim()
  if (typeof updates.projectLead === "string") project.projectLead = updates.projectLead.trim()
  if (typeof updates.departmentId === "string") project.departmentId = updates.departmentId.trim()
  if ("cftMemberIds" in updates) project.cftMemberIds = normalizeStringArray(updates.cftMemberIds)
  if ("cftMembers" in updates) project.cftMembers = normalizeStringArray(updates.cftMembers)
  if (typeof updates.status === "string") project.status = updates.status.trim()
  if (typeof updates.description === "string") project.description = updates.description.trim()
  if ("selectedTasks" in updates) project.selectedTasks = normalizeStringArray(updates.selectedTasks)
  if ("drs" in updates) project.drs = normalizeArray(updates.drs)
  if ("workflowTasks" in updates) project.workflowTasks = normalizeArray(updates.workflowTasks)
  if ("projectFiles" in updates) project.projectFiles = normalizeArray(updates.projectFiles)
  if ("notifiedUserIds" in updates) project.notifiedUserIds = normalizeStringArray(updates.notifiedUserIds)
  if ("notificationChannels" in updates) project.notificationChannels = normalizeStringArray(updates.notificationChannels)
  if (typeof updates.phase === "string") project.phase = updates.phase.trim()
  if (typeof updates.progress === "number" || typeof updates.progress === "string") project.progress = Number(updates.progress) || 0
  if ("monthlyForecast" in updates) project.monthlyForecast = normalizeMonthlyForecast(updates.monthlyForecast)
}

const hasDirectProjectEditChanges = (project, updates) => DIRECT_APPROVAL_REQUIRED_FIELDS.some((field) => {
  if (!(field in updates)) {
    return false
  }

  const nextValue = comparableProjectValue(updates[field])
  const currentValue = comparableProjectValue(project[field])
  return nextValue !== currentValue
})

const hasWorkflowTaskDateChanges = (currentTasks, nextTasks) => {
  if (!Array.isArray(nextTasks)) return false
  const currentById = new Map(normalizeArray(currentTasks).map((task) => [normalizeString(task?.id), task]))
  return nextTasks.some((task) => {
    const current = currentById.get(normalizeString(task?.id))
    if (!current) return false
    return ["planDate", "dueDate", "plannedStartDate", "plannedEndDate"].some(
      (field) => normalizeString(task?.[field]) !== normalizeString(current?.[field])
    )
  })
}

const getCurrentUserFromRequest = async (req, { required = true } = {}) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    if (required) {
      throw Object.assign(new Error("No token provided"), { statusCode: 401 })
    }
    return null
  }

  const decoded = verifyToken(authHeader.substring(7))

  if (!decoded) {
    throw Object.assign(new Error("Invalid token"), { statusCode: 401 })
  }

  const user = await User.findById(decoded.id)

  if (!user) {
    throw Object.assign(new Error("User not found"), { statusCode: 401 })
  }

  if (user.isActive === false) {
    throw Object.assign(new Error("User is inactive"), { statusCode: 403 })
  }

  return user
}

const notifyProjectCreationRecipients = async (project) => {
  const notificationChannels = normalizeStringArray(project.notificationChannels)

  if (!notificationChannels.includes("email")) {
    return
  }

  const recipients = await User.find({
    isActive: true,
    plantIds: project.plantId,
  }).select("name email role")

  const managerRecipients = recipients.filter((user) =>
    user.email && PROJECT_NOTIFICATION_ROLE_KEYS.has(normalizeRoleKey(user.role))
  )

  if (managerRecipients.length === 0) {
    return
  }

  const drNumbers = normalizeArray(project.drs)
    .map((dr) => dr?.number || dr?.fileName || "")
    .filter(Boolean)

  const cftMembers = normalizeStringArray(project.cftMembers)

  await Promise.allSettled(
    managerRecipients.map((recipient) =>
      sendProjectCreationEmail({
        to: recipient.email,
        recipientName: recipient.name,
        project: {
          name: project.name,
          plant: project.plant,
          customer: project.customer,
          projectLead: project.projectLead,
          sopDate: project.sopDate,
          partCode: project.partCode,
        },
        drNumbers,
        cftMembers,
      })
    )
  )
}

const createProjectCommunicationChannel = async (project, currentUser) => {
  const rawMemberIds = [project.projectLeadId, ...normalizeStringArray(project.cftMemberIds), String(currentUser._id), currentUser.employeeCode].filter(Boolean)
  const objectIds = rawMemberIds.filter((value) => mongoose.isValidObjectId(value))
  const linkedUsers = await User.find({
    isActive: true,
    $or: [
      { employeeCode: { $in: rawMemberIds } },
      ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
    ],
  }).select("employeeCode").lean()
  const participants = [...new Set(linkedUsers.map((user) => user.employeeCode).filter(Boolean))]
  if (!participants.includes(currentUser.employeeCode)) participants.push(currentUser.employeeCode)
  const channel = await Conversation.create({
    name: `${project.id} · ${project.name}`,
    description: project.description || `Project communication channel for ${project.name}`,
    channelType: "PROJECT",
    participants,
    members: participants.map((userId) => ({ userId, role: userId === currentUser.employeeCode ? "OWNER" : "MEMBER" })),
    projectId: project.id,
    plantId: project.plantId,
    departmentId: project.departmentId || null,
    createdBy: currentUser.employeeCode,
  })
  await MessageAuditLog.create({ conversationId: String(channel._id), action: "CHANNEL_CREATED", performedBy: currentUser.employeeCode, newValue: { projectId: project.id, name: channel.name } })
  return channel
}

const ensureProjectExists = async (id) => {
  const project = await Project.findOne({ id })

  if (!project) {
    throw Object.assign(new Error("Project not found"), { statusCode: 404 })
  }

  return project
}

exports.listProjects = async (req, res) => {
  try {
    const currentUser = await getCurrentUserFromRequest(req)
    const plantIds = normalizeStringArray(req.body?.plantIds)
    const scopedPlantIds = getScopedPlantIds(currentUser, plantIds)
    const query = isSuperAdminRole(currentUser.role) && scopedPlantIds.length === 0
      ? {}
      : { plantId: { $in: scopedPlantIds } }

    // Lists only need project metadata. The embedded workflow/file/DR arrays can
    // make this response many megabytes and are loaded from the detail route.
    const projects = await Project.find(query)
      .select("-workflowTasks -projectFiles -drs")
      .sort({ createdAt: -1 })
      .lean()
    res.json(projects.map((project) => formatProject(project, false)))
  } catch (error) {
    if (!error.statusCode || error.statusCode >= 500) {
      console.error("Error listing projects:", error)
    }
    res.status(error.statusCode || 500).json({ message: error.message || "Failed to fetch projects" })
  }
}

const splitTaskAssignees = (value) => (
  typeof value === "string"
    ? value.split(",").map((entry) => entry.trim()).filter(Boolean)
    : []
)

const isCompletedTask = (task) => ["completed", "approved"].includes(normalizeString(task?.status).toLowerCase())

exports.getDashboardSummary = async (req, res) => {
  try {
    const currentUser = await getCurrentUserFromRequest(req)
    const requestedPlantIds = normalizeStringArray(req.body?.plantIds)
    const scopedPlantIds = getScopedPlantIds(currentUser, requestedPlantIds)
    const projectQuery = isSuperAdminRole(currentUser.role) && scopedPlantIds.length === 0
      ? {}
      : { plantId: { $in: scopedPlantIds } }
    const projects = await Project.find(projectQuery).select("status phase workflowTasks").lean()

    const userTeams = normalizeStringArray(currentUser.teams)
    const userDepartmentIds = normalizeStringArray(currentUser.departmentIds)
    const peerQuery = { _id: { $ne: currentUser._id }, isActive: { $ne: false } }
    if (scopedPlantIds.length > 0) peerQuery.plantIds = { $in: scopedPlantIds }
    if (userTeams.length > 0) peerQuery.teams = { $in: userTeams }
    else if (userDepartmentIds.length > 0) peerQuery.departmentIds = { $in: userDepartmentIds }

    const peers = await User.find(peerQuery).select("_id name employeeCode").lean()
    const myAssignmentKeys = new Set([
      String(currentUser._id),
      normalizeString(currentUser.name),
      normalizeString(currentUser.employeeCode),
    ].filter(Boolean))
    const teamAssignmentKeys = new Set(peers.flatMap((peer) => [
      String(peer._id),
      normalizeString(peer.name),
      normalizeString(peer.employeeCode),
    ]).filter(Boolean))

    let myTasks = 0
    let teamTasks = 0
    let overdueItems = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (const project of projects) {
      for (const task of normalizeArray(project.workflowTasks)) {
        const assignmentKeys = [
          ...splitTaskAssignees(task?.assigneeId),
          ...splitTaskAssignees(task?.assignedTo),
        ]
        const isMine = assignmentKeys.some((key) => myAssignmentKeys.has(key))
        const isTeamTask = !isMine && assignmentKeys.some((key) => teamAssignmentKeys.has(key))
        if (isMine) myTasks += 1
        if (isTeamTask) teamTasks += 1

        const dueDateValue = normalizeString(task?.dueDate) || normalizeString(task?.planDate)
        const dueDate = dueDateValue ? new Date(dueDateValue) : null
        if ((isMine || isTeamTask) && !isCompletedTask(task) && dueDate && !Number.isNaN(dueDate.getTime()) && dueDate < today) {
          overdueItems += 1
        }
      }
    }

    const projectsByPhase = projects.reduce((counts, project) => {
      const phase = normalizeString(project.phase) || "Unknown"
      counts[phase] = (counts[phase] || 0) + 1
      return counts
    }, {})

    res.json({
      totalProjects: projects.length,
      activeProjects: projects.filter((project) => normalizeString(project.status).toLowerCase() === "active").length,
      inProgressProjects: projects.filter((project) => normalizeString(project.status).toLowerCase() === "in progress").length,
      myTasks,
      teamTasks,
      overdueItems,
      projectsByPhase,
    })
  } catch (error) {
    if (!error.statusCode || error.statusCode >= 500) console.error("Error loading dashboard summary:", error)
    res.status(error.statusCode || 500).json({ message: error.message || "Failed to load dashboard summary" })
  }
}

exports.getProject = async (req, res) => {
  try {
    const currentUser = await getCurrentUserFromRequest(req)
    const project = await Project.findOne({ id: normalizeString(req.params.id) }).lean()

    if (!project) {
      return res.status(404).json({ message: "Project not found" })
    }

    if (!canAccessPlant(currentUser, project.plantId)) {
      return res.status(403).json({ message: "This project is outside your plant access" })
    }

    res.json(formatProject(project, true))
  } catch (error) {
    if (!error.statusCode || error.statusCode >= 500) {
      console.error("Error loading project:", error)
    }
    res.status(error.statusCode || 500).json({ message: error.message || "Failed to load project" })
  }
}

exports.addProject = async (req, res) => {
  try {
    const payload = req.body || {}
    const currentUser = await getCurrentUserFromRequest(req)
    const customer = normalizeString(payload.customer)
    const name = normalizeString(payload.name)
    const plantId = normalizeString(payload.plantId)
    const partCode = normalizeString(payload.partCode)
    const sopDate = normalizeString(payload.sopDate)
    const projectLead = normalizeString(payload.projectLead)

    if (!customer || !name || !plantId || !partCode || !sopDate || !projectLead) {
      return res.status(400).json({
        message: "Customer, name, plantId, partCode, sopDate, and projectLead are required",
      })
    }

    if (!canAccessPlant(currentUser, plantId)) {
      return res.status(403).json({ message: "You can only create projects for your assigned plants" })
    }

    const project = await Project.create({
      id: `PROJECT${Date.now()}`,
      customer,
      name,
      plantId,
      plant: normalizeString(payload.plant),
      rfqNo: normalizeString(payload.rfqNo),
      apqpNo: normalizeString(payload.apqpNo),
      vehicleModel: normalizeString(payload.vehicleModel),
      partCode,
      sopDate,
      sopVolume: payload.sopVolume != null ? String(payload.sopVolume).trim() : "",
      startDate: normalizeString(payload.startDate),
      endDate: normalizeString(payload.endDate),
      projectLeadId: normalizeString(payload.projectLeadId),
      projectLead,
      departmentId: normalizeString(payload.departmentId),
      cftMemberIds: normalizeStringArray(payload.cftMemberIds),
      cftMembers: normalizeStringArray(payload.cftMembers),
      status: normalizeString(payload.status) || "Active",
      description: normalizeString(payload.description),
      selectedTasks: normalizeStringArray(payload.selectedTasks),
      drs: normalizeArray(payload.drs),
      workflowTasks: normalizeArray(payload.workflowTasks),
      projectFiles: normalizeArray(payload.projectFiles),
      notifiedUserIds: normalizeStringArray(payload.notifiedUserIds),
      notificationChannels: normalizeStringArray(payload.notificationChannels),
      phase: normalizeString(payload.phase),
      progress: typeof payload.progress === "number" ? payload.progress : Number(payload.progress) || 0,
      monthlyForecast: normalizeMonthlyForecast(payload.monthlyForecast),
      createdById: currentUser?.id || normalizeString(payload.createdById),
      createdByName: currentUser?.name || normalizeString(payload.createdByName),
      pendingApprovalRequest: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    void notifyProjectCreationRecipients(project).catch((error) => {
      console.error("Project creation email notification failed:", error)
    })

    if (payload.createCommunicationChannel !== false) {
      void createProjectCommunicationChannel(project, currentUser).catch((error) => {
        console.error("Project communication channel creation failed:", error)
      })
    }

    res.status(201).json(formatProject(project))
  } catch (error) {
    console.error("Error creating project:", error)
    res.status(error.statusCode || 500).json({ message: error.message || "Failed to create project" })
  }
}

exports.updateProject = async (req, res) => {
  try {
    const currentUser = await getCurrentUserFromRequest(req)
    const id = normalizeString(req.body?.id)

    if (!id) {
      return res.status(400).json({ message: "Project id is required" })
    }

    const project = await ensureProjectExists(id)
    const updates = req.body || {}
    const isCreator = normalizeString(project.createdById) === String(currentUser.id)
    const isLegacyProjectLead = !normalizeString(project.createdById) && normalizeString(project.projectLeadId) === String(currentUser.id)
    const isApprover = isApproverRole(currentUser.role)

    if (!canAccessPlant(currentUser, project.plantId)) {
      return res.status(403).json({ message: "You can only update projects in your assigned plants" })
    }

    if (typeof updates.plantId === "string" && updates.plantId.trim() && !canAccessPlant(currentUser, updates.plantId.trim())) {
      return res.status(403).json({ message: "You cannot move projects to another plant" })
    }

    if (!isCreator && !isLegacyProjectLead && !isApprover) {
      return res.status(403).json({ message: "Only the project creator or a manager-level approver can update this project" })
    }

    if (!isApprover && hasWorkflowTaskDateChanges(project.workflowTasks, updates.workflowTasks)) {
      return res.status(403).json({ message: "Only Assistant Manager and above can edit APQP task dates" })
    }

    if (project.pendingApprovalRequest?.status === "pending" && !isApprover) {
      return res.status(409).json({ message: "A project approval request is already pending" })
    }

    if (hasDirectProjectEditChanges(project, updates)) {
      return res.status(409).json({ message: "Project edits must be submitted through the approval request flow" })
    }

    if (typeof updates.customer === "string") project.customer = updates.customer.trim()
    if (typeof updates.name === "string") project.name = updates.name.trim()
    if (typeof updates.plantId === "string") project.plantId = updates.plantId.trim()
    if (typeof updates.plant === "string") project.plant = updates.plant.trim()
    if (typeof updates.rfqNo === "string") project.rfqNo = updates.rfqNo.trim()
    if (typeof updates.apqpNo === "string") project.apqpNo = updates.apqpNo.trim()
    if (typeof updates.vehicleModel === "string") project.vehicleModel = updates.vehicleModel.trim()
    if (typeof updates.partCode === "string") project.partCode = updates.partCode.trim()
    if (typeof updates.sopDate === "string") project.sopDate = updates.sopDate.trim()
    if (typeof updates.sopVolume === "string" || typeof updates.sopVolume === "number") project.sopVolume = String(updates.sopVolume).trim()
    if (typeof updates.startDate === "string") project.startDate = updates.startDate.trim()
    if (typeof updates.endDate === "string") project.endDate = updates.endDate.trim()
    if (typeof updates.projectLeadId === "string") project.projectLeadId = updates.projectLeadId.trim()
    if (typeof updates.projectLead === "string") project.projectLead = updates.projectLead.trim()
    if (typeof updates.departmentId === "string") project.departmentId = updates.departmentId.trim()
    if ("cftMemberIds" in updates) project.cftMemberIds = normalizeStringArray(updates.cftMemberIds)
    if ("cftMembers" in updates) project.cftMembers = normalizeStringArray(updates.cftMembers)
    if (typeof updates.status === "string") project.status = updates.status.trim()
    if (typeof updates.description === "string") project.description = updates.description
    if ("selectedTasks" in updates) project.selectedTasks = normalizeStringArray(updates.selectedTasks)
    if ("drs" in updates) project.drs = normalizeArray(updates.drs)
    if ("workflowTasks" in updates) project.workflowTasks = normalizeArray(updates.workflowTasks)
    if ("projectFiles" in updates) project.projectFiles = normalizeArray(updates.projectFiles)
    if ("notifiedUserIds" in updates) project.notifiedUserIds = normalizeStringArray(updates.notifiedUserIds)
    if ("notificationChannels" in updates) project.notificationChannels = normalizeStringArray(updates.notificationChannels)
    if (typeof updates.phase === "string") project.phase = updates.phase.trim()
    if (typeof updates.progress === "number" || typeof updates.progress === "string") project.progress = Number(updates.progress) || 0
    if ("monthlyForecast" in updates) project.monthlyForecast = normalizeMonthlyForecast(updates.monthlyForecast)

    project.updatedAt = new Date()
    await project.save()

    if (["completed", "closed"].includes(normalizeRoleKey(project.status))) {
      const archived = await Conversation.findOneAndUpdate(
        { projectId: project.id, channelType: "PROJECT", status: "ACTIVE" },
        { status: "ARCHIVED", updatedAt: new Date() },
        { new: true },
      )
      if (archived) {
        await MessageAuditLog.create({ conversationId: String(archived._id), action: "CHANNEL_ARCHIVED", performedBy: currentUser.employeeCode, newValue: { projectStatus: project.status } })
      }
    }

    res.json(formatProject(project))
  } catch (error) {
    console.error("Error updating project:", error)
    res.status(error.statusCode || 500).json({ message: error.message || "Failed to update project" })
  }
}

exports.updateProjectForecast = async (req, res) => {
  try {
    const currentUser = await getCurrentUserFromRequest(req)
    const id = normalizeString(req.body?.id)

    if (!id) {
      return res.status(400).json({ message: "Project id is required" })
    }

    const project = await ensureProjectExists(id)

    if (!canAccessPlant(currentUser, project.plantId)) {
      return res.status(403).json({ message: "You can only plan forecasts for projects in your assigned plants" })
    }

    const monthlyForecast = normalizeMonthlyForecast(req.body?.monthlyForecast)

    // monthlyForecast is a Mongoose Map. Setting the complete value and marking
    // it modified makes additions, edits, and removed months persist reliably.
    project.set("monthlyForecast", monthlyForecast)
    project.markModified("monthlyForecast")
    project.updatedAt = new Date()
    await project.save()

    // Read back the stored document so the client receives the persisted value,
    // rather than relying on the in-memory Map conversion.
    const savedProject = await Project.findOne({ id }).lean()
    res.json(formatProject(savedProject || project))
  } catch (error) {
    console.error("Error updating project forecast:", error)
    res.status(error.statusCode || 500).json({ message: error.message || "Failed to update project forecast" })
  }
}

exports.requestProjectUpdate = async (req, res) => {
  try {
    const currentUser = await getCurrentUserFromRequest(req)
    const id = normalizeString(req.body?.id)
    const reason = normalizeString(req.body?.reason)
    const changes = normalizeProjectEditChanges(req.body?.changes)

    if (!id) {
      return res.status(400).json({ message: "Project id is required" })
    }

    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ message: "At least one project field must be changed" })
    }

    const project = await ensureProjectExists(id)
    const isCreator = normalizeString(project.createdById) === String(currentUser.id)
    const isLegacyProjectLead = !normalizeString(project.createdById) && normalizeString(project.projectLeadId) === String(currentUser.id)

    if (!canAccessPlant(currentUser, project.plantId)) {
      return res.status(403).json({ message: "You can only request edits for projects in your assigned plants" })
    }

    if (typeof changes.plantId === "string" && changes.plantId && !canAccessPlant(currentUser, changes.plantId)) {
      return res.status(403).json({ message: "You cannot move projects to another plant" })
    }

    if (!isCreator && !isLegacyProjectLead) {
      return res.status(403).json({ message: "Only the project creator can request an edit" })
    }

    if (project.pendingApprovalRequest?.status === "pending") {
      return res.status(409).json({ message: "A project approval request is already pending" })
    }

    project.pendingApprovalRequest = {
      id: `approval-${Date.now()}`,
      type: "edit",
      status: "pending",
      requestedById: String(currentUser.id),
      requestedByName: currentUser.name,
      requestedAt: new Date(),
      reason,
      proposedChanges: changes,
    }

    project.updatedAt = new Date()
    await project.save()

    res.json({
      message: "Project edit request submitted for manager approval",
      project: formatProject(project),
    })
  } catch (error) {
    console.error("Error requesting project edit:", error)
    res.status(error.statusCode || 500).json({ message: error.message || "Failed to submit project edit request" })
  }
}

exports.requestProjectDelete = async (req, res) => {
  try {
    const currentUser = await getCurrentUserFromRequest(req)
    const id = normalizeString(req.body?.id)
    const reason = normalizeString(req.body?.reason)

    if (!id) {
      return res.status(400).json({ message: "Project id is required" })
    }

    const project = await ensureProjectExists(id)
    const isCreator = normalizeString(project.createdById) === String(currentUser.id)
    const isLegacyProjectLead = !normalizeString(project.createdById) && normalizeString(project.projectLeadId) === String(currentUser.id)

    if (!canAccessPlant(currentUser, project.plantId)) {
      return res.status(403).json({ message: "You can only delete projects in your assigned plants" })
    }

    if (isDeputyManagerRole(currentUser.role)) {
      await Project.deleteOne({ _id: project._id })

      return res.json({
        message: "Project deleted successfully",
        deletedProjectId: project.id,
      })
    }

    if (!isCreator && !isLegacyProjectLead && !isApproverRole(currentUser.role)) {
      return res.status(403).json({ message: "Only the project creator or a manager-level approver can request project deletion" })
    }

    if (project.pendingApprovalRequest?.status === "pending") {
      return res.status(409).json({ message: "A project approval request is already pending" })
    }

    project.pendingApprovalRequest = {
      id: `approval-${Date.now()}`,
      type: "delete",
      status: "pending",
      requestedById: String(currentUser.id),
      requestedByName: currentUser.name,
      requestedAt: new Date(),
      reason,
    }

    project.updatedAt = new Date()
    await project.save()

    res.json({
      message: "Project deletion request submitted for manager approval",
      project: formatProject(project),
    })
  } catch (error) {
    console.error("Error requesting project deletion:", error)
    res.status(error.statusCode || 500).json({ message: error.message || "Failed to submit project deletion request" })
  }
}

exports.approveProjectRequest = async (req, res) => {
  try {
    const currentUser = await getCurrentUserFromRequest(req)
    const id = normalizeString(req.body?.id)

    if (!id) {
      return res.status(400).json({ message: "Project id is required" })
    }

    if (!isApproverRole(currentUser.role)) {
      return res.status(403).json({ message: "Only manager-level users can approve project changes" })
    }

    const project = await ensureProjectExists(id)
    const pendingRequest = project.pendingApprovalRequest

    if (!canAccessPlant(currentUser, project.plantId)) {
      return res.status(403).json({ message: "You can only approve projects in your assigned plants" })
    }

    if (!pendingRequest || pendingRequest.status !== "pending") {
      return res.status(400).json({ message: "No pending project approval request found" })
    }

    if (normalizeString(pendingRequest.requestedById) === String(currentUser.id)) {
      return res.status(403).json({ message: "Project approval requests must be approved by another manager-level user" })
    }

    if (pendingRequest.type === "edit") {
      applyProjectChanges(project, pendingRequest.proposedChanges || {})
      project.pendingApprovalRequest = null
      project.updatedAt = new Date()
      await project.save()

      return res.json({
        message: "Project edit approved successfully",
        project: formatProject(project),
      })
    }

    if (pendingRequest.type === "delete") {
      await Project.deleteOne({ _id: project._id })

      return res.json({
        message: "Project deletion approved successfully",
        deletedProjectId: project.id,
      })
    }

    return res.status(400).json({ message: "Unsupported project approval request type" })
  } catch (error) {
    console.error("Error approving project request:", error)
    res.status(error.statusCode || 500).json({ message: error.message || "Failed to approve project request" })
  }
}

exports.rejectProjectRequest = async (req, res) => {
  try {
    const currentUser = await getCurrentUserFromRequest(req)
    const id = normalizeString(req.body?.id)
    const rejectionReason = normalizeString(req.body?.rejectionReason)

    if (!id) {
      return res.status(400).json({ message: "Project id is required" })
    }

    if (!isApproverRole(currentUser.role)) {
      return res.status(403).json({ message: "Only manager-level users can reject project changes" })
    }

    const project = await ensureProjectExists(id)
    const pendingRequest = project.pendingApprovalRequest

    if (!canAccessPlant(currentUser, project.plantId)) {
      return res.status(403).json({ message: "You can only reject projects in your assigned plants" })
    }

    if (!pendingRequest || pendingRequest.status !== "pending") {
      return res.status(400).json({ message: "No pending project approval request found" })
    }

    project.pendingApprovalRequest = null
    project.updatedAt = new Date()
    await project.save()

    res.json({
      message: rejectionReason
        ? `Project request rejected: ${rejectionReason}`
        : "Project request rejected successfully",
      project: formatProject(project),
    })
  } catch (error) {
    console.error("Error rejecting project request:", error)
    res.status(error.statusCode || 500).json({ message: error.message || "Failed to reject project request" })
  }
}
