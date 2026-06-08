const jwt = require("jsonwebtoken")
const Project = require("../models/Project")
const User = require("../models/Users")
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
  "description",
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

const normalizeArray = (value) => (Array.isArray(value) ? value : [])

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

const formatProject = (project) => ({
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
  createdById: project.createdById || "",
  createdByName: project.createdByName || "",
  pendingApprovalRequest: formatPendingApprovalRequest(project.pendingApprovalRequest),
  createdAt: project.createdAt ? new Date(project.createdAt).toISOString() : new Date().toISOString(),
})

const isApproverRole = (role) => PROJECT_APPROVER_ROLE_KEYS.has(normalizeRoleKey(role))

const normalizeProjectEditChanges = (value) => {
  if (!value || typeof value !== "object") {
    return {}
  }

  const changes = {}

  for (const field of PROJECT_EDITABLE_FIELDS) {
    if (!(field in value)) {
      continue
    }

    if (field === "description") {
      if (typeof value[field] === "string") {
        changes[field] = value[field].trim()
      }
      continue
    }

    if (typeof value[field] === "string" || typeof value[field] === "number") {
      changes[field] = String(value[field]).trim()
    }
  }

  return changes
}

const applyProjectChanges = (project, updates) => {
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
  if (typeof updates.description === "string") project.description = updates.description.trim()
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

const ensureProjectExists = async (id) => {
  const project = await Project.findOne({ id })

  if (!project) {
    throw Object.assign(new Error("Project not found"), { statusCode: 404 })
  }

  return project
}

exports.listProjects = async (req, res) => {
  try {
    const plantIds = normalizeStringArray(req.body?.plantIds)
    const query = plantIds.length > 0 ? { plantId: { $in: plantIds } } : {}

    const projects = await Project.find(query).sort({ createdAt: -1 })
    res.json(projects.map(formatProject))
  } catch (error) {
    console.error("Error listing projects:", error)
    res.status(500).json({ message: error.message || "Failed to fetch projects" })
  }
}

exports.addProject = async (req, res) => {
  try {
    const payload = req.body || {}
    const currentUser = await getCurrentUserFromRequest(req, { required: false })
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
      createdById: currentUser?.id || normalizeString(payload.createdById),
      createdByName: currentUser?.name || normalizeString(payload.createdByName),
      pendingApprovalRequest: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    void notifyProjectCreationRecipients(project).catch((error) => {
      console.error("Project creation email notification failed:", error)
    })

    res.status(201).json(formatProject(project))
  } catch (error) {
    console.error("Error creating project:", error)
    res.status(error.statusCode || 500).json({ message: error.message || "Failed to create project" })
  }
}

exports.updateProject = async (req, res) => {
  try {
    const id = normalizeString(req.body?.id)

    if (!id) {
      return res.status(400).json({ message: "Project id is required" })
    }

    const project = await ensureProjectExists(id)
    const updates = req.body || {}

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

    project.updatedAt = new Date()
    await project.save()

    res.json(formatProject(project))
  } catch (error) {
    console.error("Error updating project:", error)
    res.status(error.statusCode || 500).json({ message: error.message || "Failed to update project" })
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

    if (!isCreator && !isLegacyProjectLead && !isApproverRole(currentUser.role)) {
      return res.status(403).json({ message: "Only the project creator or a manager-level approver can request an edit" })
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

    if (!isCreator && !isLegacyProjectLead) {
      return res.status(403).json({ message: "Only the project creator can request project deletion" })
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

    if (!pendingRequest || pendingRequest.status !== "pending") {
      return res.status(400).json({ message: "No pending project approval request found" })
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
