const fs = require("fs")
const path = require("path")
const mongoose = require("mongoose")
const Document = require("../models/Document")
const DocumentRevision = require("../models/DocumentRevision")
const RepositoryFolder = require("../models/RepositoryFolder")
const RepositoryFavorite = require("../models/RepositoryFavorite")
const RepositoryRecent = require("../models/RepositoryRecent")
const RepositoryAudit = require("../models/RepositoryAudit")
const ApprovalRule = require("../models/ApprovalRule")
const { audit } = require("../services/repositoryAuditService")
const { can, canApprove, isAdmin } = require("../services/repositoryPermissionService")
const { assertTransition, nextRevisionNumber } = require("../services/repositoryStateService")
const storage = require("../services/repositoryStorageService")
const { watermarkControlledPdf } = require("../services/repositoryWatermarkService")

const DOCUMENT_TYPES = ["Policy", "Procedure", "SOP", "Work Instruction", "Engineering Drawing", "Specification", "Form", "Checklist", "Quality Document", "Customer Document", "Certificate", "Project Document", "General Document"]
const POPULATE_USERS = [
  { path: "ownerId", select: "name employeeCode email" },
  { path: "createdBy", select: "name employeeCode" },
]

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const objectId = (value) => mongoose.Types.ObjectId.isValid(value)
const cleanTags = (tags) => (Array.isArray(tags) ? tags : String(tags || "").split(",")).map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 30)

function fail(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  throw error
}

async function loadFolder(folderId) {
  if (!objectId(folderId)) fail(400, "A valid folder is required")
  const folder = await RepositoryFolder.findById(folderId).lean()
  if (!folder || folder.archived) fail(404, "Folder not found")
  return withEffectivePermissions(folder)
}

async function withEffectivePermissions(folder) {
  const chain = [folder]
  let cursor = folder
  const visited = new Set([String(folder._id)])
  while (cursor.inheritPermissions && cursor.parentId && !visited.has(String(cursor.parentId))) {
    visited.add(String(cursor.parentId))
    cursor = await RepositoryFolder.findById(cursor.parentId).lean()
    if (!cursor) break
    chain.unshift(cursor)
  }
  const effective = new Map()
  for (const item of chain) {
    for (const grant of item.permissions || []) effective.set(`${grant.principalType}:${grant.principalId}`, grant)
  }
  return { ...folder, permissions: [...effective.values()] }
}

async function loadDocument(documentId, includeArchived = false) {
  if (!objectId(documentId)) fail(400, "Invalid document identifier")
  const document = await Document.findOne({ _id: documentId, ...(includeArchived ? {} : { archived: false }) }).lean()
  if (!document) fail(404, "Document not found")
  const rawFolder = await RepositoryFolder.findById(document.folderId).lean()
  const folder = rawFolder ? await withEffectivePermissions(rawFolder) : null
  return { document, folder }
}

function ensure(user, action, resource) {
  if (!can(user, action, resource)) fail(403, "You do not have permission to perform this action")
}

function documentScope(user) {
  if (isAdmin(user)) return {}
  const departments = [...(user.departmentIds || []), ...(Array.isArray(user.department) ? user.department : user.department ? [user.department] : [])]
  return { $or: [{ departmentId: "" }, { departmentId: { $in: departments.map(String) } }, { ownerId: user.id }, { createdBy: user.id }] }
}

async function recordRecent(userId, documentId) {
  await RepositoryRecent.findOneAndUpdate({ userId, documentId }, { lastAccessedAt: new Date() }, { upsert: true }).catch(() => null)
}

exports.config = asyncHandler(async (req, res) => {
  res.json({
    documentTypes: DOCUMENT_TYPES,
    classifications: ["INTERNAL", "CONFIDENTIAL", "RESTRICTED"],
    maxUploadBytes: Number(process.env.REPOSITORY_MAX_FILE_SIZE || 50 * 1024 * 1024),
    permissions: {
      createFolder: can(req.user, "repository.createFolder"),
      upload: can(req.user, "repository.upload"),
      approve: can(req.user, "document.approve"),
      administer: can(req.user, "repository.admin"),
    },
  })
})

exports.listFolders = asyncHandler(async (req, res) => {
  const query = { archived: req.query.archived === "true" }
  if (req.query.parentId === "root" || req.query.parentId === "") query.parentId = null
  else if (req.query.parentId) query.parentId = req.query.parentId
  if (!isAdmin(req.user)) {
    const departments = [...(req.user.departmentIds || []), ...(Array.isArray(req.user.department) ? req.user.department : req.user.department ? [req.user.department] : [])]
    query.$or = [{ departmentId: "" }, { departmentId: { $in: departments.map(String) } }, { createdBy: req.user.id }]
  }
  const folders = await RepositoryFolder.find(query).sort({ name: 1 }).lean()
  res.json(folders)
})

exports.createFolder = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim()
  if (!name) fail(400, "Folder name is required")
  let parent = null
  if (req.body.parentId) parent = await loadFolder(req.body.parentId)
  const resource = { folder: parent, departmentId: req.body.departmentId || parent?.departmentId || "" }
  ensure(req.user, "repository.createFolder", resource)
  const exists = await RepositoryFolder.exists({ parentId: parent?._id || null, name: new RegExp(`^${escapeRegex(name)}$`, "i"), archived: false })
  if (exists) fail(409, "A folder with this name already exists here")
  const folder = await RepositoryFolder.create({
    name,
    parentId: parent?._id || null,
    departmentId: resource.departmentId,
    description: String(req.body.description || "").trim(),
    inheritPermissions: req.body.inheritPermissions !== false,
    createdBy: req.user.id,
  })
  await audit(req, "FOLDER_CREATED", { folderId: folder._id }, { name })
  res.status(201).json(folder)
})

exports.updateFolder = asyncHandler(async (req, res) => {
  const folder = await RepositoryFolder.findById(req.params.id)
  if (!folder || folder.archived) fail(404, "Folder not found")
  ensure(req.user, "repository.rename", { folder: await withEffectivePermissions(folder.toObject()), departmentId: folder.departmentId, createdBy: folder.createdBy })
  const oldName = folder.name
  const name = String(req.body.name || "").trim()
  if (!name) fail(400, "Folder name is required")
  const exists = await RepositoryFolder.exists({ _id: { $ne: folder._id }, parentId: folder.parentId, name: new RegExp(`^${escapeRegex(name)}$`, "i"), archived: false })
  if (exists) fail(409, "A folder with this name already exists here")
  folder.name = name
  if (typeof req.body.description === "string") folder.description = req.body.description.trim()
  await folder.save()
  await audit(req, "FOLDER_RENAMED", { folderId: folder._id }, { from: oldName, to: name })
  res.json(folder)
})

exports.updateFolderPermissions = asyncHandler(async (req, res) => {
  const folder = await RepositoryFolder.findById(req.params.id)
  if (!folder) fail(404, "Folder not found")
  ensure(req.user, "repository.managePermissions", { folder })
  const allowedActions = new Set(["repository.view", "repository.upload", "repository.download", "repository.createFolder", "repository.rename", "repository.move", "document.create", "document.editMetadata", "document.submitRevision", "document.viewRevisionHistory", "document.archive", "document.approve"])
  const permissions = Array.isArray(req.body.permissions) ? req.body.permissions.map((entry) => ({
    principalType: entry.principalType,
    principalId: String(entry.principalId || "").trim(),
    actions: Array.isArray(entry.actions) ? entry.actions.filter((action) => allowedActions.has(action)) : [],
  })).filter((entry) => ["user", "role", "department"].includes(entry.principalType) && entry.principalId) : []
  folder.permissions = permissions
  folder.inheritPermissions = req.body.inheritPermissions !== false
  await folder.save()
  await audit(req, "FOLDER_PERMISSIONS_UPDATED", { folderId: folder._id }, { permissionCount: permissions.length, inheritPermissions: folder.inheritPermissions })
  res.json(folder)
})

async function isDescendant(candidateParentId, folderId) {
  let cursor = candidateParentId
  const visited = new Set()
  while (cursor) {
    if (String(cursor) === String(folderId)) return true
    if (visited.has(String(cursor))) return true
    visited.add(String(cursor))
    const parent = await RepositoryFolder.findById(cursor).select("parentId").lean()
    cursor = parent?.parentId || null
  }
  return false
}

exports.moveFolder = asyncHandler(async (req, res) => {
  const folder = await RepositoryFolder.findById(req.params.id)
  if (!folder || folder.archived) fail(404, "Folder not found")
  ensure(req.user, "repository.move", { folder: await withEffectivePermissions(folder.toObject()), departmentId: folder.departmentId, createdBy: folder.createdBy })
  const parentId = req.body.parentId || null
  if (parentId && (!objectId(parentId) || await isDescendant(parentId, folder._id))) fail(409, "A folder cannot be moved into itself or one of its descendants")
  const parent = parentId ? await loadFolder(parentId) : null
  const exists = await RepositoryFolder.exists({ _id: { $ne: folder._id }, parentId: parent?._id || null, name: new RegExp(`^${escapeRegex(folder.name)}$`, "i"), archived: false })
  if (exists) fail(409, "A folder with this name already exists at the destination")
  const from = folder.parentId
  folder.parentId = parent?._id || null
  await folder.save()
  await audit(req, "FOLDER_MOVED", { folderId: folder._id }, { from, to: folder.parentId })
  res.json(folder)
})

exports.archiveFolder = asyncHandler(async (req, res) => {
  const folder = await RepositoryFolder.findById(req.params.id)
  if (!folder) fail(404, "Folder not found")
  ensure(req.user, "document.archive", { folder: await withEffectivePermissions(folder.toObject()), departmentId: folder.departmentId, createdBy: folder.createdBy })
  const hasActiveChildren = await RepositoryFolder.exists({ parentId: folder._id, archived: false })
  const hasActiveDocuments = await Document.exists({ folderId: folder._id, archived: false })
  if (hasActiveChildren || hasActiveDocuments) fail(409, "Move or archive the folder contents first")
  folder.archived = true
  folder.archivedBy = req.user.id
  folder.archivedAt = new Date()
  await folder.save()
  await audit(req, "FOLDER_ARCHIVED", { folderId: folder._id })
  res.json(folder)
})

exports.browse = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50))
  const query = { ...documentScope(req.user), archived: req.query.mode === "archive" }
  if (req.query.folderId) query.folderId = req.query.folderId
  if (req.query.status) query.status = req.query.status
  if (req.query.documentType) query.documentType = req.query.documentType
  if (req.query.departmentId) query.departmentId = req.query.departmentId
  if (req.query.controlled === "true" || req.query.controlled === "false") query.controlledDocument = req.query.controlled === "true"
  if (req.query.ownerId) query.ownerId = req.query.ownerId
  if (req.query.q) {
    const pattern = new RegExp(escapeRegex(req.query.q), "i")
    query.$and = [...(query.$and || []), { $or: [{ title: pattern }, { documentNumber: pattern }, { tags: pattern }, { documentType: pattern }, { currentRevisionNumber: pattern }] }]
  }
  if (req.query.mode === "mine") query.$and = [...(query.$and || []), { $or: [{ ownerId: req.user.id }, { createdBy: req.user.id }] }]
  if (req.query.mode === "favorites") {
    const favorites = await RepositoryFavorite.find({ userId: req.user.id, targetType: "document" }).distinct("targetId")
    query._id = { $in: favorites }
  }
  if (req.query.mode === "recent") {
    const recents = await RepositoryRecent.find({ userId: req.user.id }).sort({ lastAccessedAt: -1 }).limit(100).lean()
    query._id = { $in: recents.map((item) => item.documentId) }
  }
  const sortFields = new Set(["title", "documentNumber", "status", "updatedAt", "currentRevisionNumber"])
  const sortBy = sortFields.has(req.query.sortBy) ? req.query.sortBy : "updatedAt"
  const sort = { [sortBy]: req.query.order === "asc" ? 1 : -1 }
  const [documents, total] = await Promise.all([
    Document.find(query).populate(POPULATE_USERS).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Document.countDocuments(query),
  ])
  res.json({ documents, total, page, pages: Math.ceil(total / limit) })
})

exports.createDocument = asyncHandler(async (req, res) => {
  if (!req.file) fail(400, "A file is required")
  let stored = null
  try {
    const folder = await loadFolder(req.body.folderId)
    ensure(req.user, "document.create", { folder, departmentId: req.body.departmentId || folder.departmentId })
    const documentNumber = String(req.body.documentNumber || "").trim().toUpperCase()
    if (!documentNumber) fail(400, "Document number is required")
    if (await Document.exists({ documentNumber })) fail(409, "Document number already exists")
    const document = await Document.create({
      documentNumber,
      title: String(req.body.title || path.parse(req.file.originalname).name).trim(),
      description: String(req.body.description || "").trim(),
      folderId: folder._id,
      departmentId: String(req.body.departmentId || folder.departmentId || ""),
      projectId: String(req.body.projectId || ""),
      customerId: String(req.body.customerId || ""),
      documentType: DOCUMENT_TYPES.includes(req.body.documentType) ? req.body.documentType : "General Document",
      classification: ["INTERNAL", "CONFIDENTIAL", "RESTRICTED"].includes(req.body.classification) ? req.body.classification : "INTERNAL",
      ownerId: req.user.id,
      controlledDocument: String(req.body.controlledDocument) === "true",
      tags: cleanTags(req.body.tags),
      createdBy: req.user.id,
    })
    stored = await storage.persistUpload(req.file.path, document._id, "R00", req.file.originalname)
    const revision = await DocumentRevision.create({
      documentId: document._id,
      revisionNumber: "R00",
      fileName: req.file.originalname,
      originalFileName: req.file.originalname,
      fileExtension: path.extname(req.file.originalname).slice(1),
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      storageKey: stored.storageKey,
      checksum: stored.checksum,
      revisionNotes: String(req.body.revisionNotes || "Initial issue").trim(),
      uploadedBy: req.user.id,
    })
    await audit(req, "DOCUMENT_CREATED", { documentId: document._id, revisionId: revision._id, folderId: folder._id }, { documentNumber, revision: "R00", checksum: stored.checksum })
    if (String(req.body.submit) === "true") await submitRevisionInternal(req, document, revision)
    const result = await Document.findById(document._id).populate(POPULATE_USERS).lean()
    res.status(201).json({ document: result, revision })
  } catch (error) {
    if (req.file?.path && !stored) await fs.promises.unlink(req.file.path).catch(() => null)
    if (stored) await storage.remove(stored.storageKey).catch(() => null)
    throw error
  }
})

exports.getDocument = asyncHandler(async (req, res) => {
  const { document, folder } = await loadDocument(req.params.id, true)
  ensure(req.user, "repository.view", { ...document, folder })
  await recordRecent(req.user.id, document._id)
  const [populated, revisions, favorite] = await Promise.all([
    Document.findById(document._id).populate(POPULATE_USERS).populate("currentRevisionId", "revisionNumber status approvedAt approvedBy fileSize mimeType").lean(),
    DocumentRevision.find({ documentId: document._id }).select("-storageKey").populate("uploadedBy approvedBy rejectedBy changeRequestedBy", "name employeeCode").sort({ createdAt: -1 }).lean(),
    RepositoryFavorite.exists({ userId: req.user.id, targetType: "document", targetId: document._id }),
  ])
  res.json({ document: populated, revisions, favorite: Boolean(favorite) })
})

exports.updateDocument = asyncHandler(async (req, res) => {
  const { document, folder } = await loadDocument(req.params.id)
  ensure(req.user, "document.editMetadata", { ...document, folder })
  const updates = {}
  if (typeof req.body.title === "string" && req.body.title.trim()) updates.title = req.body.title.trim()
  if (typeof req.body.description === "string") updates.description = req.body.description.trim()
  if (req.body.tags !== undefined) updates.tags = cleanTags(req.body.tags)
  if (DOCUMENT_TYPES.includes(req.body.documentType)) updates.documentType = req.body.documentType
  if (["INTERNAL", "CONFIDENTIAL", "RESTRICTED"].includes(req.body.classification)) updates.classification = req.body.classification
  if (typeof req.body.controlledDocument === "boolean") updates.controlledDocument = req.body.controlledDocument
  if (req.body.folderId && String(req.body.folderId) !== String(document.folderId)) {
    const targetFolder = await loadFolder(req.body.folderId)
    ensure(req.user, "repository.move", { ...document, folder: targetFolder, departmentId: targetFolder.departmentId })
    updates.folderId = targetFolder._id
    if (req.body.inheritDepartment !== false) updates.departmentId = targetFolder.departmentId
  }
  const updated = await Document.findByIdAndUpdate(document._id, updates, { new: true, runValidators: true }).populate(POPULATE_USERS)
  await audit(req, "DOCUMENT_METADATA_UPDATED", { documentId: document._id, folderId: updates.folderId || document.folderId }, { fields: Object.keys(updates) })
  res.json(updated)
})

exports.addRevision = asyncHandler(async (req, res) => {
  if (!req.file) fail(400, "A file is required")
  let stored = null
  try {
    const { document, folder } = await loadDocument(req.params.id)
    ensure(req.user, "document.submitRevision", { ...document, folder })
    const openRevision = await DocumentRevision.exists({ documentId: document._id, status: { $in: ["DRAFT", "PENDING_APPROVAL", "UNDER_REVIEW", "CHANGES_REQUESTED"] } })
    if (openRevision) fail(409, "This document already has an active proposed revision")
    const latest = await DocumentRevision.findOne({ documentId: document._id }).sort({ createdAt: -1 }).lean()
    const revisionNumber = nextRevisionNumber(latest?.revisionNumber)
    stored = await storage.persistUpload(req.file.path, document._id, revisionNumber, req.file.originalname)
    const duplicate = await DocumentRevision.exists({ documentId: document._id, checksum: stored.checksum })
    if (duplicate) fail(409, "This exact file already exists in the document history")
    const revision = await DocumentRevision.create({
      documentId: document._id, revisionNumber, fileName: req.file.originalname, originalFileName: req.file.originalname,
      fileExtension: path.extname(req.file.originalname).slice(1), mimeType: req.file.mimetype, fileSize: req.file.size,
      storageKey: stored.storageKey, checksum: stored.checksum, revisionNotes: String(req.body.revisionNotes || "").trim(), uploadedBy: req.user.id,
    })
    await audit(req, "REVISION_UPLOADED", { documentId: document._id, revisionId: revision._id, folderId: document.folderId }, { revision: revisionNumber, checksum: stored.checksum })
    if (String(req.body.submit) === "true") await submitRevisionInternal(req, document, revision)
    res.status(201).json(revision)
  } catch (error) {
    if (req.file?.path && !stored) await fs.promises.unlink(req.file.path).catch(() => null)
    if (stored) await storage.remove(stored.storageKey).catch(() => null)
    throw error
  }
})

exports.replaceDraftRevision = asyncHandler(async (req, res) => {
  if (!req.file) fail(400, "A file is required")
  const revision = await DocumentRevision.findById(req.params.id).select("+storageKey")
  if (!revision) fail(404, "Revision not found")
  const { document, folder } = await loadDocument(revision.documentId)
  ensure(req.user, "document.submitRevision", { ...document, folder })
  if (String(revision.uploadedBy) !== String(req.user.id) && !isAdmin(req.user)) fail(403, "Only the uploader can update this proposed revision")
  if (!["DRAFT", "CHANGES_REQUESTED", "REJECTED"].includes(revision.status)) fail(409, "Only draft, rejected, or changes-requested revisions can be updated")
  let stored = null
  try {
    stored = await storage.persistUpload(req.file.path, document._id, revision.revisionNumber, req.file.originalname)
    const duplicate = await DocumentRevision.exists({ documentId: document._id, checksum: stored.checksum, _id: { $ne: revision._id } })
    if (duplicate) fail(409, "This exact file already exists in the document history")
    const oldStorageKey = revision.storageKey
    revision.fileName = req.file.originalname
    revision.originalFileName = req.file.originalname
    revision.fileExtension = path.extname(req.file.originalname).slice(1)
    revision.mimeType = req.file.mimetype
    revision.fileSize = req.file.size
    revision.storageKey = stored.storageKey
    revision.checksum = stored.checksum
    revision.revisionNotes = String(req.body.revisionNotes || revision.revisionNotes).trim()
    revision.status = "DRAFT"
    await revision.save()
    await storage.remove(oldStorageKey).catch(() => null)
    await audit(req, "REVISION_FILE_UPDATED", { documentId: document._id, revisionId: revision._id, folderId: document.folderId }, { revision: revision.revisionNumber, checksum: stored.checksum })
    if (String(req.body.submit) === "true") await submitRevisionInternal(req, document, revision)
    res.json(revision)
  } catch (error) {
    if (req.file?.path && !stored) await fs.promises.unlink(req.file.path).catch(() => null)
    if (stored) await storage.remove(stored.storageKey).catch(() => null)
    throw error
  }
})

async function submitRevisionInternal(req, document, revision) {
  assertTransition(revision.status, "PENDING_APPROVAL")
  revision.status = "PENDING_APPROVAL"
  revision.submittedBy = req.user.id
  revision.submittedAt = new Date()
  revision.rejectionReason = ""
  revision.changeRequestComment = ""
  await revision.save()
  if (!document.currentRevisionId) await Document.updateOne({ _id: document._id }, { status: "PENDING_APPROVAL" })
  await audit(req, "REVISION_SUBMITTED", { documentId: document._id, revisionId: revision._id, folderId: document.folderId }, { revision: revision.revisionNumber })
}

exports.submitRevision = asyncHandler(async (req, res) => {
  const revision = await DocumentRevision.findById(req.params.id).select("+storageKey")
  if (!revision) fail(404, "Revision not found")
  const { document, folder } = await loadDocument(revision.documentId)
  ensure(req.user, "document.submitRevision", { ...document, folder })
  if (String(revision.uploadedBy) !== String(req.user.id) && !isAdmin(req.user)) fail(403, "Only the uploader can submit this revision")
  await submitRevisionInternal(req, document, revision)
  res.json(revision)
})

exports.approvalQueue = asyncHandler(async (req, res) => {
  ensure(req.user, "document.approve")
  const revisions = await DocumentRevision.find({ status: { $in: ["PENDING_APPROVAL", "UNDER_REVIEW"] } })
    .populate({ path: "documentId", populate: [...POPULATE_USERS, { path: "currentRevisionId", select: "revisionNumber status fileName originalFileName mimeType fileSize" }] }).populate("submittedBy uploadedBy", "name employeeCode").sort({ submittedAt: 1 }).lean()
  const allowed = []
  for (const revision of revisions) {
    if (revision.documentId && await canApprove(req.user, revision.documentId)) allowed.push(revision)
  }
  res.json(allowed)
})

exports.decideRevision = asyncHandler(async (req, res) => {
  const revision = await DocumentRevision.findById(req.params.id)
  if (!revision) fail(404, "Revision not found")
  const { document, folder } = await loadDocument(revision.documentId)
  if (!await canApprove(req.user, document)) fail(403, "You are not an approver for this document")
  if (String(revision.uploadedBy) === String(req.user.id) && !isAdmin(req.user)) fail(409, "Uploaders cannot approve their own revisions")
  const decision = String(req.body.decision || "").toUpperCase()
  const comment = String(req.body.comment || "").trim()
  if (decision === "REJECT" && !comment) fail(400, "A rejection reason is required")
  if (decision === "REQUEST_CHANGES" && !comment) fail(400, "A change request comment is required")

  if (decision === "APPROVE") {
    assertTransition(revision.status, "APPROVED")
    const session = await mongoose.startSession()
    let transactionUnavailable = false
    try {
      await session.withTransaction(async () => {
        const freshDocument = await Document.findById(document._id).session(session)
        const freshRevision = await DocumentRevision.findOne({ _id: revision._id, status: { $in: ["PENDING_APPROVAL", "UNDER_REVIEW"] } }).session(session)
        if (!freshRevision) fail(409, "This revision has already been reviewed")
        if (freshDocument.currentRevisionId) {
          await DocumentRevision.updateOne({ _id: freshDocument.currentRevisionId, status: "APPROVED" }, { status: "SUPERSEDED", supersededAt: new Date() }, { session })
          await audit(req, "REVISION_SUPERSEDED", { documentId: freshDocument._id, revisionId: freshDocument.currentRevisionId, folderId: freshDocument.folderId }, { replacedBy: freshRevision.revisionNumber }, session)
        }
        freshRevision.status = "APPROVED"
        freshRevision.approvedBy = req.user.id
        freshRevision.approvedAt = new Date()
        freshRevision.reviewComment = comment
        freshRevision.effectiveDate = req.body.effectiveDate || new Date()
        await freshRevision.save({ session })
        freshDocument.currentRevisionId = freshRevision._id
        freshDocument.currentRevisionNumber = freshRevision.revisionNumber
        freshDocument.status = "APPROVED"
        await freshDocument.save({ session })
        await audit(req, "REVISION_APPROVED", { documentId: freshDocument._id, revisionId: freshRevision._id, folderId: freshDocument.folderId }, { revision: freshRevision.revisionNumber, comment }, session)
      })
    } catch (error) {
      transactionUnavailable = error.code === 20 || /transaction numbers|replica set|mongos/i.test(error.message)
      if (!transactionUnavailable) throw error
    } finally {
      await session.endSession()
    }
    if (transactionUnavailable) {
      const freshDocument = await Document.findById(document._id)
      const oldRevisionId = freshDocument.currentRevisionId
      const approvedRevision = await DocumentRevision.findOneAndUpdate(
        { _id: revision._id, status: { $in: ["PENDING_APPROVAL", "UNDER_REVIEW"] } },
        { status: "APPROVED", approvedBy: req.user.id, approvedAt: new Date(), reviewComment: comment, effectiveDate: req.body.effectiveDate || new Date() },
        { new: true },
      )
      if (!approvedRevision) fail(409, "This revision has already been reviewed")
      const swapped = await Document.findOneAndUpdate(
        { _id: freshDocument._id, __v: freshDocument.__v, currentRevisionId: oldRevisionId || null },
        { $set: { currentRevisionId: approvedRevision._id, currentRevisionNumber: approvedRevision.revisionNumber, status: "APPROVED" }, $inc: { __v: 1 } },
        { new: true },
      )
      if (!swapped) {
        await DocumentRevision.updateOne({ _id: approvedRevision._id, status: "APPROVED" }, { status: revision.status, $unset: { approvedBy: 1, approvedAt: 1, effectiveDate: 1, reviewComment: 1 } })
        fail(409, "Another approval changed this document; refresh and review again")
      }
      if (oldRevisionId) {
        await DocumentRevision.updateOne({ _id: oldRevisionId, status: "APPROVED" }, { status: "SUPERSEDED", supersededAt: new Date() })
        await audit(req, "REVISION_SUPERSEDED", { documentId: freshDocument._id, revisionId: oldRevisionId, folderId: freshDocument.folderId }, { replacedBy: approvedRevision.revisionNumber })
      }
      await audit(req, "REVISION_APPROVED", { documentId: freshDocument._id, revisionId: approvedRevision._id, folderId: freshDocument.folderId }, { revision: approvedRevision.revisionNumber, comment, atomicMode: "compare-and-swap" })
    }
  } else if (decision === "REJECT") {
    assertTransition(revision.status, "REJECTED")
    revision.status = "REJECTED"; revision.rejectedBy = req.user.id; revision.rejectedAt = new Date(); revision.rejectionReason = comment
    await revision.save()
    await audit(req, "REVISION_REJECTED", { documentId: document._id, revisionId: revision._id, folderId: document.folderId }, { revision: revision.revisionNumber, reason: comment })
  } else if (decision === "REQUEST_CHANGES") {
    assertTransition(revision.status, "CHANGES_REQUESTED")
    revision.status = "CHANGES_REQUESTED"; revision.changeRequestedBy = req.user.id; revision.changeRequestedAt = new Date(); revision.changeRequestComment = comment
    await revision.save()
    await audit(req, "REVISION_CHANGES_REQUESTED", { documentId: document._id, revisionId: revision._id, folderId: document.folderId }, { revision: revision.revisionNumber, comment })
  } else fail(400, "Decision must be APPROVE, REJECT, or REQUEST_CHANGES")
  res.json(await DocumentRevision.findById(revision._id).select("-storageKey"))
})

exports.content = asyncHandler(async (req, res) => {
  const revision = await DocumentRevision.findById(req.params.id).select("+storageKey").lean()
  if (!revision) fail(404, "Revision not found")
  const { document, folder } = await loadDocument(revision.documentId, true)
  const historical = String(document.currentRevisionId || "") !== String(revision._id)
  ensure(req.user, historical ? "document.viewRevisionHistory" : "repository.download", { ...document, folder })
  const filePath = storage.safeResolve(revision.storageKey)
  if (!fs.existsSync(filePath)) fail(404, "The stored file is unavailable")
  const download = req.query.disposition === "attachment"
  const isPdf = String(revision.mimeType).toLowerCase().startsWith("application/pdf") || String(revision.fileExtension).toLowerCase() === "pdf"
  const addControlledWatermark = download && document.controlledDocument && isPdf
  let responseBody = null
  if (addControlledWatermark) {
    try {
      responseBody = await watermarkControlledPdf(filePath)
    } catch (error) {
      console.error("Unable to watermark controlled repository PDF:", error.message)
      fail(422, "This controlled PDF could not be prepared for download")
    }
  }
  await Promise.all([recordRecent(req.user.id, document._id), audit(req, download ? "REVISION_DOWNLOADED" : "REVISION_PREVIEWED", { documentId: document._id, revisionId: revision._id, folderId: document.folderId }, { revision: revision.revisionNumber, historical, watermark: addControlledWatermark ? "CONTROLLED COPY" : null })])
  res.setHeader("Content-Type", revision.mimeType)
  res.setHeader("Content-Length", responseBody ? responseBody.length : revision.fileSize)
  res.setHeader("X-Document-Revision", revision.revisionNumber)
  res.setHeader("X-Document-Status", historical ? "SUPERSEDED" : revision.status)
  if (addControlledWatermark) res.setHeader("X-Document-Watermark", "CONTROLLED COPY")
  res.setHeader("Cache-Control", "private, no-store")
  const disposition = download ? "attachment" : "inline"
  res.setHeader("Content-Disposition", `${disposition}; filename*=UTF-8''${encodeURIComponent(revision.originalFileName)}`)
  if (responseBody) return res.end(responseBody)
  fs.createReadStream(filePath).on("error", (error) => res.destroy(error)).pipe(res)
})

exports.toggleFavorite = asyncHandler(async (req, res) => {
  const targetType = req.body.targetType === "folder" ? "folder" : "document"
  if (!objectId(req.body.targetId)) fail(400, "Invalid favorite target")
  const query = { userId: req.user.id, targetType, targetId: req.body.targetId }
  const existing = await RepositoryFavorite.findOne(query)
  if (existing) { await existing.deleteOne(); return res.json({ favorite: false }) }
  await RepositoryFavorite.create(query)
  res.json({ favorite: true })
})

exports.archiveDocument = asyncHandler(async (req, res) => {
  const { document, folder } = await loadDocument(req.params.id, true)
  ensure(req.user, "document.archive", { ...document, folder })
  const archived = req.body.restore === true ? false : true
  await Document.updateOne({ _id: document._id }, { archived, archivedBy: archived ? req.user.id : null, archivedAt: archived ? new Date() : null, status: archived ? "ARCHIVED" : (document.currentRevisionId ? "APPROVED" : "DRAFT") })
  await audit(req, archived ? "DOCUMENT_ARCHIVED" : "DOCUMENT_RESTORED", { documentId: document._id, folderId: document.folderId })
  res.json({ archived })
})

exports.auditHistory = asyncHandler(async (req, res) => {
  const { document, folder } = await loadDocument(req.params.id, true)
  ensure(req.user, "document.viewRevisionHistory", { ...document, folder })
  const events = await RepositoryAudit.find({ documentId: document._id }).sort({ createdAt: -1 }).limit(250).lean()
  res.json(events)
})

exports.listApprovalRules = asyncHandler(async (req, res) => {
  ensure(req.user, "repository.manageApprovalRules")
  res.json(await ApprovalRule.find({ active: true }).sort({ priority: 1, name: 1 }).lean())
})

exports.createApprovalRule = asyncHandler(async (req, res) => {
  ensure(req.user, "repository.manageApprovalRules")
  if (!String(req.body.name || "").trim() || !Array.isArray(req.body.stages) || !req.body.stages.length) fail(400, "Rule name and at least one approval stage are required")
  const rule = await ApprovalRule.create({
    name: req.body.name.trim(), priority: Number(req.body.priority) || 100, departmentId: String(req.body.departmentId || ""),
    folderId: req.body.folderId || null, documentType: DOCUMENT_TYPES.includes(req.body.documentType) ? req.body.documentType : "",
    controlledDocument: typeof req.body.controlledDocument === "boolean" ? req.body.controlledDocument : null,
    stages: req.body.stages.map((stage, index) => ({ order: Number(stage.order) || index + 1, roleKeys: Array.isArray(stage.roleKeys) ? stage.roleKeys : [], userIds: Array.isArray(stage.userIds) ? stage.userIds : [] })),
    createdBy: req.user.id,
  })
  await audit(req, "APPROVAL_RULE_CREATED", {}, { ruleId: rule._id, name: rule.name })
  res.status(201).json(rule)
})

exports.archiveApprovalRule = asyncHandler(async (req, res) => {
  ensure(req.user, "repository.manageApprovalRules")
  const rule = await ApprovalRule.findByIdAndUpdate(req.params.id, { active: false }, { new: true })
  if (!rule) fail(404, "Approval rule not found")
  await audit(req, "APPROVAL_RULE_ARCHIVED", {}, { ruleId: rule._id, name: rule.name })
  res.json(rule)
})

exports.errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error)
  if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => null)
  const status = error.statusCode || (error.code === 11000 ? 409 : 500)
  if (status >= 500) console.error("Repository error:", error)
  res.status(status).json({ message: status >= 500 ? "Repository operation failed" : error.message })
}
