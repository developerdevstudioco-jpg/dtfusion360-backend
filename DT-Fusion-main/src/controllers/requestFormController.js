const mongoose = require("mongoose")
const RequestForm = require("../models/RequestForm")
const Sequence = require("../models/Sequence")
const Project = require("../models/Project")
const Department = require("../models/Department")
const PurchasePlanning = require("../models/PurchasePlanning")
const PurchaseRequestDraft = require("../models/PurchaseRequestDraft")
const { recordActivity } = require("../services/activityLogService")

const TYPES = new Set(["UCL", "FT", "MACHINE"])
const UCL_STATUSES = new Set(["INPUT_PENDING", "RFQ", "UNDER_PR_APPROVAL", "UNDER_PO_APPROVAL", "PO_ISSUED", "IN_TRANSIT", "COMPLETED"])
const MANAGER_ROLES = new Set(["superadmin", "plantadmin", "admin", "qa", "departmentmanager", "assistantmanager", "deputymanager", "manager", "seniormanager", "generalmanager", "head", "director", "agm", "dgm", "gm", "planthead"])
const APPROVER_ROLES = new Set(["superadmin", "plantadmin", "admin", "qa", "departmentmanager", "manager", "seniormanager", "generalmanager", "head", "director", "agm", "dgm", "gm", "planthead"])
const TRANSITIONS = {
  SUBMITTED: new Set(["UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"]),
  UNDER_REVIEW: new Set(["APPROVED", "REJECTED"]),
  APPROVED: new Set(), REJECTED: new Set(), CANCELLED: new Set(),
}

const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "")
const array = (value) => Array.isArray(value) ? value.map(String) : value ? [String(value)] : []
const isAdmin = (user) => ["superadmin", "plantadmin", "admin"].includes(normalize(user.role))
const canManage = (user) => MANAGER_ROLES.has(normalize(user.role))
const canApprove = (user) => APPROVER_ROLES.has(normalize(user.role))
const fail = (statusCode, message) => { const error = new Error(message); error.statusCode = statusCode; throw error }
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const canAccessPlant = (user, plantId) => normalize(user.role) === "superadmin" || array(user.plantIds).includes(String(plantId))
const ownsDepartment = (user, departmentId) => array(user.departmentIds).includes(String(departmentId))
const canCorrectPurchase = (user, form) => isAdmin(user) || (canManage(user) && ownsDepartment(user, form.receiverDepartmentId))
const purchaseEntryNumber = (value, label) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) fail(400, `${label} must be greater than zero`)
  return parsed
}
const purchaseDate = (value, label) => {
  const parsed = value ? new Date(value) : null
  if (!parsed || Number.isNaN(parsed.getTime())) fail(400, `${label} is required`)
  return parsed
}
const signedInventoryQuantity = (entry) => entry.kind === "RECEIPT" ? Number(entry.quantity) : -Number(entry.quantity)
const recalculateStock = (form) => {
  form.stockBalance = Math.max(0, Number(form.openingStockQty || 0) + form.inventoryTransactions.reduce((total, entry) => total + signedInventoryQuantity(entry), 0))
}

async function purchaseForm(req) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail(400, "Invalid form identifier")
  const form = await RequestForm.findOne({ _id: req.params.id, ...scopeFor(req.user) })
  if (!form) fail(404, "Request form not found")
  if (form.type !== "UCL") fail(400, "Purchase tracking applies only to UCL forms")
  if (form.status === "VOID") fail(409, "A voided form cannot be updated")
  return form
}

async function adjustPlanningStock(form, delta, user) {
  const mpn = String(form.supplierPartNumber || "").trim().toUpperCase()
  if (!mpn || !delta) return
  const current = await PurchasePlanning.findOne({ plantId: form.plantId, mpn })
  const nextAvailable = Math.max(0, Number(current?.availableQty || 0) + delta)
  await PurchasePlanning.findOneAndUpdate(
    { plantId: form.plantId, mpn },
    { $set: { availableQty: nextAvailable, materialCode: String(form.dtplPartNumber || "").trim(), updatedBy: user.id, updatedByName: user.name }, $setOnInsert: { safetyBufferDays: 7 } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  )
}

async function nextFormNumber(type) {
  const year = new Date().getFullYear()
  const sequence = await Sequence.findOneAndUpdate({ key: `request-form:${type}:${year}` }, { $inc: { value: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true })
  return `${type}-${year}-${String(sequence.value).padStart(5, "0")}`
}

async function nextPurchaseDraftNumber() {
  const year = new Date().getFullYear()
  const sequence = await Sequence.findOneAndUpdate({ key: `purchase-request-draft:${year}` }, { $inc: { value: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true })
  return `PR-DRAFT-${year}-${String(sequence.value).padStart(5, "0")}`
}

function scopeFor(user) {
  if (normalize(user.role) === "superadmin") return {}
  const plantIds = array(user.plantIds)
  const departmentIds = array(user.departmentIds)
  return { $and: [{ plantId: { $in: plantIds } }, { $or: [{ createdBy: user.id }, { senderDepartmentId: { $in: departmentIds } }, { receiverDepartmentId: { $in: departmentIds } }] }] }
}

async function buildPayload(body, user) {
  const type = String(body.type || "").toUpperCase()
  if (!TYPES.has(type)) fail(400, "Form type must be UCL, FT, or MACHINE")
  const quantity = Number(body.quantity ?? body.qty)
  if (!Number.isFinite(quantity) || quantity <= 0) fail(400, "Quantity must be greater than zero")
  const project = await Project.findOne({ id: String(body.projectId || body.project || "") }).lean()
  if (!project) fail(404, "Project not found")
  const senderId = String(body.senderDepartmentId || "")
  const receiverId = String(body.receiverDepartmentId || "")
  const [sender, receiver] = await Promise.all([Department.findOne({ id: senderId, isActive: true }).lean(), Department.findOne({ id: receiverId, isActive: true }).lean()])
  if (!sender || !receiver) fail(400, "Select valid active sender and receiver departments")
  if (sender.plantId !== receiver.plantId || sender.plantId !== project.plantId) fail(409, "Project, sender, and receiver departments must belong to the same plant")
  if (!isAdmin(user) && !array(user.plantIds).includes(project.plantId)) fail(403, "This project is outside your plant access")
  if (!canManage(user) && !array(user.departmentIds).includes(sender.id)) fail(403, "You can only submit requests from your own department")
  if (type === "UCL" && !/r\s*&\s*d|research\s*(and|&)\s*development/i.test(sender.name)) fail(403, "UCL requests can only be created by R&D")
  if (type === "UCL" && !/purchase/i.test(receiver.name)) fail(400, "The receiving department for a UCL request must be Purchase")
  if (type === "UCL" && !array(user.departmentIds).includes(sender.id)) fail(403, "Only R&D can create a UCL request")
  if (type === "UCL" && !body.targetDate) fail(400, "Target date is required for a UCL request")
  if (type === "FT" && !/\bped\b|process\s*engineering/i.test(receiver.name)) fail(400, "The receiving department for a Fixture request must be PED")
  if (type === "FT" && !array(user.departmentIds).includes(sender.id)) fail(403, "The requester must raise a Fixture request from their own department")
  if (type === "FT" && !body.targetDate) fail(400, "Target date is required for a Fixture request")
  if (type === "MACHINE" && !/maintenance/i.test(receiver.name)) fail(400, "The receiving department for a Machine request must be Maintenance")
  if (type === "MACHINE" && !array(user.departmentIds).includes(sender.id)) fail(403, "The requester must raise a Machine request from their own department")
  if (type === "MACHINE" && !body.targetDate) fail(400, "Target date is required for a Machine request")
  const optionalNumber = (value, label, minimum = 0) => {
    if (value === "" || value === null || value === undefined) return null
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < minimum) fail(400, `${label} must be ${minimum > 0 ? "greater than zero" : "zero or greater"}`)
    return parsed
  }
  return {
    type, projectId: project.id, projectName: project.name, customer: project.customer, partNumber: project.partCode,
    dtplPartNumber: type === "UCL" ? String(body.dtplPartNumber || "").trim() : "",
    description: String(body.description || project.description || "").trim(), supplier: String(body.supplier || "").trim(),
    functionName: String(body.functionName || "").trim(), materials: String(body.materials || "").trim(),
    specification: String(body.specification || body.spec || "").trim(), range: String(body.range || "").trim(), make: String(body.make || "").trim(),
    supplierPartNumber: String(body.supplierPartNumber || "").trim(), quantity, sopDate: body.sopDate || project.sopDate || null,
    sopVolume: optionalNumber(body.sopVolume ?? project.sopVolume, "SOP volume"),
    rfqNumber: String(body.rfqNumber || body.rfqNo || project.rfqNo || "").trim(), eta: body.eta || null,
    prNumber: String(body.prNumber || "").trim(), m1Month: String(body.m1Month || "").trim(),
    m1Quantity: optionalNumber(body.m1Quantity, "M1 quantity"), m3Quantity: optionalNumber(body.m3Quantity, "M+3 quantity"),
    targetDate: body.targetDate || null,
    remarks: String(body.remarks || "").trim(), senderDepartmentId: sender.id, senderDepartmentName: sender.name,
    receiverDepartmentId: receiver.id, receiverDepartmentName: receiver.name, plantId: project.plantId,
  }
}

exports.config = asyncHandler(async (_req, res) => res.json({ types: [...TYPES], statuses: [...new Set([...Object.keys(TRANSITIONS), ...UCL_STATUSES, "VOID"])] }))

exports.listPurchasePlanning = asyncHandler(async (req, res) => {
  const plantId = String(req.query.plantId || "")
  const query = plantId ? { plantId } : normalize(req.user.role) === "superadmin" ? {} : { plantId: { $in: array(req.user.plantIds) } }
  if (plantId && !canAccessPlant(req.user, plantId)) fail(403, "This plant is outside your access")
  const records = await PurchasePlanning.find(query).sort({ mpn: 1 }).lean()
  res.json({ records })
})

exports.savePurchasePlanning = asyncHandler(async (req, res) => {
  const plantId = String(req.body.plantId || "")
  const mpn = String(req.params.mpn || "").trim().toUpperCase()
  const availableQty = Number(req.body.availableQty)
  const safetyBufferDays = req.body.safetyBufferDays == null ? 7 : Number(req.body.safetyBufferDays)
  if (!plantId || !canAccessPlant(req.user, plantId)) fail(403, "This plant is outside your access")
  if (!mpn) fail(400, "MPN is required")
  if (!Number.isFinite(availableQty) || availableQty < 0) fail(400, "Available quantity must be zero or greater")
  if (!Number.isFinite(safetyBufferDays) || safetyBufferDays < 0) fail(400, "Safety buffer must be zero or greater")
  const record = await PurchasePlanning.findOneAndUpdate(
    { plantId, mpn },
    { $set: { availableQty, safetyBufferDays, materialCode: String(req.body.materialCode || "").trim(), updatedBy: req.user.id, updatedByName: req.user.name } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  ).lean()
  await recordActivity({ type: "governance", category: "Purchase Planning", action: "Availability Updated", actorId: req.user.id, actorName: req.user.name, employeeCode: req.user.employeeCode, actorRole: req.user.role, target: mpn, details: `Available quantity set to ${availableQty}`, status: "Success", plantId })
  res.json(record)
})

exports.createPurchaseRequestDraft = asyncHandler(async (req, res) => {
  const plantId = String(req.body.plantId || "")
  const lines = Array.isArray(req.body.lines) ? req.body.lines : []
  if (!plantId || !canAccessPlant(req.user, plantId)) fail(403, "This plant is outside your access")
  if (!lines.length) fail(400, "Select at least one material")
  const normalizedLines = lines.map(line => ({
    mpn: String(line.mpn || "").trim().toUpperCase(), materialCode: String(line.materialCode || "").trim(), description: String(line.description || "").trim(),
    projectCodes: array(line.projectCodes), requiredQty: Number(line.requiredQty), availableQty: Number(line.availableQty), confirmedIncomingQty: Number(line.confirmedIncomingQty), netRequiredQty: Number(line.netRequiredQty), suggestedPrQty: Number(line.suggestedPrQty),
    requiredDate: line.requiredDate || null, plannedPrRaiseDate: line.plannedPrRaiseDate || null,
  }))
  if (normalizedLines.some(line => !line.mpn || !Number.isFinite(line.suggestedPrQty) || line.suggestedPrQty <= 0)) fail(400, "Every draft line requires an MPN and a suggested quantity greater than zero")
  const mpns = [...new Set(normalizedLines.map(line => line.mpn))]
  const mpnPatterns = mpns.map(mpn => new RegExp(`^${escapeRegex(mpn)}$`, "i"))
  const [existingDrafts, existingForms] = await Promise.all([
    PurchaseRequestDraft.find({ plantId, status: { $in: ["DRAFT", "SUBMITTED"] }, "lines.mpn": { $in: mpns } }).select("draftNumber lines.mpn").lean(),
    RequestForm.find({ plantId, type: "UCL", supplierPartNumber: { $in: mpnPatterns }, $or: [{ status: { $in: ["UNDER_PR_APPROVAL", "UNDER_PO_APPROVAL", "PO_ISSUED", "IN_TRANSIT"] } }, { prNumber: { $nin: ["", null] } }] }).select("supplierPartNumber prNumber formNumber").lean(),
  ])
  const duplicateMpns = new Set()
  existingDrafts.forEach(draft => draft.lines.forEach(line => { if (mpns.includes(line.mpn)) duplicateMpns.add(line.mpn) }))
  existingForms.forEach(form => duplicateMpns.add(String(form.supplierPartNumber || "").toUpperCase()))
  if (duplicateMpns.size) fail(409, `Existing PR/PO or draft found for: ${[...duplicateMpns].join(", ")}`)
  const draftNumber = await nextPurchaseDraftNumber()
  const draft = await PurchaseRequestDraft.create({ draftNumber, plantId, lines: normalizedLines, createdBy: req.user.id, createdByName: req.user.name })
  await PurchasePlanning.bulkWrite(normalizedLines.map(line => ({ updateOne: { filter: { plantId, mpn: line.mpn }, update: { $set: { materialCode: line.materialCode, draftNumber, draftStatus: "DRAFT", updatedBy: req.user.id, updatedByName: req.user.name }, $setOnInsert: { availableQty: line.availableQty, safetyBufferDays: 7 } }, upsert: true } })))
  await recordActivity({ type: "governance", category: "Purchase Planning", action: "PR Draft Created", actorId: req.user.id, actorName: req.user.name, employeeCode: req.user.employeeCode, actorRole: req.user.role, target: draftNumber, details: `${normalizedLines.length} material line(s)`, status: "Success", plantId })
  res.status(201).json(draft)
})

exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 25))
  const query = { ...scopeFor(req.user) }
  if (TYPES.has(String(req.query.type || "").toUpperCase())) query.type = String(req.query.type).toUpperCase()
  if (TRANSITIONS[req.query.status] || UCL_STATUSES.has(req.query.status) || req.query.status === "VOID") query.status = req.query.status
  if (req.query.plantId) query.plantId = req.query.plantId
  if (req.query.projectId) query.projectId = String(req.query.projectId)
  if (req.query.partNumber) {
    const pattern = new RegExp(escapeRegex(req.query.partNumber), "i")
    query.$and = [...(query.$and || []), { $or: [{ partNumber: pattern }, { dtplPartNumber: pattern }, { supplierPartNumber: pattern }] }]
  }
  if (req.query.from || req.query.to) {
    const range = {}
    if (req.query.from) range.$gte = new Date(`${req.query.from}T00:00:00.000Z`)
    if (req.query.to) range.$lte = new Date(`${req.query.to}T23:59:59.999Z`)
    if (Object.values(range).some(value => Number.isNaN(value.getTime()))) fail(400, "Select a valid report date range")
    query.$and = [...(query.$and || []), { $or: [
      { createdAt: range }, { "purchaseOrders.releaseDate": range }, { "etaCommitments.etaDate": range }, { "inventoryTransactions.transactionDate": range },
    ] }]
  }
  if (req.query.q) { const pattern = new RegExp(escapeRegex(req.query.q), "i"); query.$and = [...(query.$and || []), { $or: [{ formNumber: pattern }, { projectName: pattern }, { customer: pattern }, { partNumber: pattern }, { dtplPartNumber: pattern }, { supplier: pattern }] }] }
  const includeTotal = req.query.includeTotal === "true"
  const [forms, countedTotal] = await Promise.all([
    RequestForm.find(query).select("-history").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    includeTotal ? RequestForm.countDocuments(query) : Promise.resolve(null),
  ])
  const total = countedTotal ?? forms.length
  res.json({ forms, total, page, pages: includeTotal ? Math.ceil(total / limit) : (forms.length === limit ? page + 1 : page) })
})

exports.get = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail(400, "Invalid form identifier")
  const form = await RequestForm.findOne({ _id: req.params.id, ...scopeFor(req.user) }).populate("history.actorId", "name employeeCode").lean()
  if (!form) fail(404, "Request form not found")
  res.json(form)
})

exports.create = asyncHandler(async (req, res) => {
  const payload = await buildPayload(req.body, req.user)
  const formNumber = await nextFormNumber(payload.type)
  const initialStatus = ["UCL", "FT", "MACHINE"].includes(payload.type) ? "INPUT_PENDING" : "SUBMITTED"
  const form = await RequestForm.create({ ...payload, formNumber, status: initialStatus, createdBy: req.user.id, createdByName: req.user.name, history: [{ action: initialStatus, toStatus: initialStatus, actorId: req.user.id, actorName: req.user.name }] })
  await recordActivity({ type: "governance", category: "Requester Forms", action: "Form Submitted", actorId: req.user.id, actorName: req.user.name, employeeCode: req.user.employeeCode, actorRole: req.user.role, target: formNumber, details: `${payload.type} request submitted`, status: "Success", plantId: payload.plantId })
  res.status(201).json(form)
})

exports.updateRequester = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail(400, "Invalid form identifier")
  const form = await RequestForm.findOne({ _id: req.params.id, ...scopeFor(req.user) })
  if (!form) fail(404, "Request form not found")
  const isCreator = String(form.createdBy) === String(req.user.id)
  if (!isCreator && !canManage(req.user)) fail(403, "Only the requester or a manager can edit this form")
  if (form.status === "VOID") fail(409, "A voided form cannot be edited")

  const body = req.body || {}
  const stringFields = form.type === "UCL"
    ? ["dtplPartNumber", "description", "supplier", "supplierPartNumber", "rfqNumber", "prNumber", "m1Month", "remarks"]
    : ["functionName", "materials", "specification", "range", "make", "supplier", "rfqNumber", "remarks"]
  for (const field of stringFields) {
    if (field in body) form[field] = String(body[field] || "").trim()
  }

  if ("quantity" in body) {
    const quantity = Number(body.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) fail(400, "Quantity must be greater than zero")
    form.quantity = quantity
  }

  for (const [field, label] of [["sopVolume", "SOP volume"], ["m1Quantity", "M1 quantity"], ["m3Quantity", "M+3 quantity"]]) {
    if (!(field in body)) continue
    if (body[field] === "" || body[field] === null || body[field] === undefined) {
      form[field] = null
      continue
    }
    const value = Number(body[field])
    if (!Number.isFinite(value) || value < 0) fail(400, `${label} must be zero or greater`)
    form[field] = value
  }

  for (const field of ["sopDate", "targetDate", "eta"]) {
    if (field in body) form[field] = body[field] || null
  }

  form.history.push({ action: "FORM_EDITED", comment: "Requester fields updated", actorId: req.user.id, actorName: req.user.name })
  await form.save()
  await recordActivity({ type: "governance", category: "Requester Forms", action: "Form Edited", actorId: req.user.id, actorName: req.user.name, employeeCode: req.user.employeeCode, actorRole: req.user.role, target: form.formNumber, details: "Requester-owned fields updated", status: "Success", plantId: form.plantId })
  res.json(form)
})

exports.voidForm = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail(400, "Invalid form identifier")
  const form = await RequestForm.findOne({ _id: req.params.id, ...scopeFor(req.user) })
  if (!form) fail(404, "Request form not found")
  const isCreator = String(form.createdBy) === String(req.user.id)
  if (!isCreator && !canManage(req.user)) fail(403, "Only the requester or a manager can void this form")
  if (form.status === "VOID") fail(409, "This form is already void")
  const reason = String(req.body.reason || "").trim()
  if (!reason) fail(400, "A reason is required to void a form")

  const previous = form.status
  form.status = "VOID"
  form.reviewedBy = req.user.id
  form.reviewedAt = new Date()
  form.history.push({ action: "STATUS_VOID", fromStatus: previous, toStatus: "VOID", comment: reason, actorId: req.user.id, actorName: req.user.name })
  await form.save()
  await recordActivity({ type: "governance", category: "Requester Forms", action: "Form Voided", actorId: req.user.id, actorName: req.user.name, employeeCode: req.user.employeeCode, actorRole: req.user.role, target: form.formNumber, details: reason, status: "Success", plantId: form.plantId })
  res.json(form)
})

exports.deleteForm = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail(400, "Invalid form identifier")
  const form = await RequestForm.findOne({ _id: req.params.id, ...scopeFor(req.user) })
  if (!form) fail(404, "Request form not found")
  const isCreator = String(form.createdBy) === String(req.user.id)
  if (!isCreator && !isAdmin(req.user)) fail(403, "Only the requester or an administrator can delete this form")
  const reason = String(req.body.reason || "").trim()
  if (!reason) fail(400, "A reason is required to delete a form")

  const formNumber = form.formNumber
  const plantId = form.plantId
  await form.deleteOne()
  await recordActivity({ type: "governance", category: "Requester Forms", action: "Form Deleted", actorId: req.user.id, actorName: req.user.name, employeeCode: req.user.employeeCode, actorRole: req.user.role, target: formNumber, details: reason, status: "Success", plantId })
  res.json({ id: req.params.id, formNumber })
})

exports.updatePurchase = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail(400, "Invalid form identifier")
  const form = await RequestForm.findOne({ _id: req.params.id, ...scopeFor(req.user) })
  if (!form) fail(404, "Request form not found")
  if (form.type !== "UCL") fail(400, "Purchase updates apply only to UCL forms")
  const ownsPurchaseDepartment = array(req.user.departmentIds).includes(form.receiverDepartmentId)
  if (!ownsPurchaseDepartment) fail(403, "Only Purchase can update these fields")
  const optionalNumber = (value, label, minimum = 0) => {
    if (value === "" || value === null || value === undefined) return null
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < minimum) fail(400, `${label} must be ${minimum > 0 ? "greater than zero" : "zero or greater"}`)
    return parsed
  }
  const status = String(req.body.status || form.status).toUpperCase()
  if (!UCL_STATUSES.has(status)) fail(400, "Select a valid UCL status")
  const previous = form.status
  const previousOpeningStock = Number(form.openingStockQty || 0)
  form.leadTime = String(req.body.leadTime || "").trim()
  form.moq = optionalNumber(req.body.moq, "MOQ")
  form.spq = optionalNumber(req.body.spq, "SPQ")
  form.price = optionalNumber(req.body.price, "Price")
  form.currency = String(req.body.currency || "").trim().toUpperCase()
  form.perQuantity = optionalNumber(req.body.perQuantity, "Per quantity", Number.MIN_VALUE)
  const nextPrQuantity = optionalNumber(req.body.prQuantity, "PR quantity")
  const nextOpeningStock = optionalNumber(req.body.openingStockQty, "Opening stock") || 0
  if (form.prQuantity !== null && Number(form.prQuantity) !== Number(nextPrQuantity) && !canCorrectPurchase(req.user, form)) fail(403, "Only the Purchase department manager can correct the PR quantity")
  if (previousOpeningStock !== nextOpeningStock && previousOpeningStock !== 0 && !canCorrectPurchase(req.user, form)) fail(403, "Only the Purchase department manager can correct opening stock")
  form.prQuantity = nextPrQuantity
  form.openingStockQty = nextOpeningStock
  const inventoryMovement = form.inventoryTransactions.reduce((total, entry) => total + signedInventoryQuantity(entry), 0)
  if (form.openingStockQty + inventoryMovement < 0) fail(409, "Opening stock cannot be lower than recorded net consumption")
  recalculateStock(form)
  form.status = status
  form.eta = form.etaCommitments.length ? [...form.etaCommitments].sort((a, b) => a.etaDate - b.etaDate)[0].etaDate : req.body.eta || null
  form.departmentRemarks = String(req.body.departmentRemarks || "").trim()
  form.reviewedBy = req.user.id
  form.reviewedAt = new Date()
  form.history.push({ action: "PURCHASE_UPDATED", fromStatus: previous, toStatus: status, comment: form.departmentRemarks, actorId: req.user.id, actorName: req.user.name })
  await form.save()
  await adjustPlanningStock(form, Number(form.openingStockQty || 0) - previousOpeningStock, req.user)
  await recordActivity({ type: "governance", category: "Requester Forms", action: "UCL Purchase Updated", actorId: req.user.id, actorName: req.user.name, employeeCode: req.user.employeeCode, actorRole: req.user.role, target: form.formNumber, details: form.departmentRemarks, status: "Success", plantId: form.plantId })
  res.json(form)
})

exports.addPurchaseOrder = asyncHandler(async (req, res) => {
  const form = await purchaseForm(req)
  if (!ownsDepartment(req.user, form.receiverDepartmentId)) fail(403, "Only Purchase can add PO releases")
  const poNumber = String(req.body.poNumber || "").trim()
  if (!poNumber) fail(400, "PO number is required")
  const releaseDate = purchaseDate(req.body.releaseDate, "PO release date")
  const quantity = purchaseEntryNumber(req.body.quantity, "PO quantity")
  if (form.purchaseOrders.some(entry => entry.poNumber.toLowerCase() === poNumber.toLowerCase() && entry.releaseDate.toISOString().slice(0, 10) === releaseDate.toISOString().slice(0, 10) && Number(entry.quantity) === quantity)) fail(409, "This PO release has already been recorded")
  form.purchaseOrders.push({ poNumber, releaseDate, quantity, notes: String(req.body.notes || "").trim(), createdBy: req.user.id, createdByName: req.user.name })
  const previous = form.status
  form.status = "PO_ISSUED"
  form.history.push({ action: "PO_RELEASE_ADDED", fromStatus: previous, toStatus: form.status, comment: `${poNumber}: ${quantity}`, actorId: req.user.id, actorName: req.user.name })
  await form.save()
  await recordActivity({ type: "governance", category: "Requester Forms", action: "PO Release Added", actorId: req.user.id, actorName: req.user.name, employeeCode: req.user.employeeCode, actorRole: req.user.role, target: form.formNumber, details: `${poNumber}: ${quantity}`, status: "Success", plantId: form.plantId })
  res.status(201).json(form)
})

exports.updatePurchaseOrder = asyncHandler(async (req, res) => {
  const form = await purchaseForm(req)
  if (!canCorrectPurchase(req.user, form)) fail(403, "Only the Purchase department manager can correct PO releases")
  const entry = form.purchaseOrders.id(req.params.entryId)
  if (!entry) fail(404, "PO release not found")
  entry.poNumber = String(req.body.poNumber || "").trim()
  if (!entry.poNumber) fail(400, "PO number is required")
  entry.releaseDate = purchaseDate(req.body.releaseDate, "PO release date")
  entry.quantity = purchaseEntryNumber(req.body.quantity, "PO quantity")
  entry.notes = String(req.body.notes || "").trim()
  entry.correctedBy = req.user.id; entry.correctedByName = req.user.name; entry.correctedAt = new Date()
  form.history.push({ action: "PO_RELEASE_CORRECTED", comment: `${entry.poNumber}: ${entry.quantity}`, actorId: req.user.id, actorName: req.user.name })
  await form.save()
  res.json(form)
})

exports.addEtaCommitment = asyncHandler(async (req, res) => {
  const form = await purchaseForm(req)
  if (!ownsDepartment(req.user, form.receiverDepartmentId)) fail(403, "Only Purchase can add ETA commitments")
  const poNumber = String(req.body.poNumber || "").trim()
  if (poNumber && !form.purchaseOrders.some(entry => entry.poNumber.toLowerCase() === poNumber.toLowerCase())) fail(400, "Select a PO number recorded on this UCL")
  const etaDate = purchaseDate(req.body.etaDate, "ETA date")
  const quantity = purchaseEntryNumber(req.body.quantity, "ETA quantity")
  if (form.etaCommitments.some(entry => String(entry.poNumber || "").toLowerCase() === poNumber.toLowerCase() && entry.etaDate.toISOString().slice(0, 10) === etaDate.toISOString().slice(0, 10) && Number(entry.quantity) === quantity)) fail(409, "This ETA commitment has already been recorded")
  form.etaCommitments.push({ poNumber, etaDate, quantity, notes: String(req.body.notes || "").trim(), createdBy: req.user.id, createdByName: req.user.name })
  const previous = form.status
  form.status = "IN_TRANSIT"
  const earliestEta = [...form.etaCommitments].sort((a, b) => a.etaDate - b.etaDate)[0]
  form.eta = earliestEta?.etaDate || form.eta
  form.history.push({ action: "ETA_COMMITMENT_ADDED", fromStatus: previous, toStatus: form.status, comment: `${etaDate.toISOString().slice(0, 10)}: ${quantity}`, actorId: req.user.id, actorName: req.user.name })
  await form.save()
  res.status(201).json(form)
})

exports.updateEtaCommitment = asyncHandler(async (req, res) => {
  const form = await purchaseForm(req)
  if (!canCorrectPurchase(req.user, form)) fail(403, "Only the Purchase department manager can correct ETA commitments")
  const entry = form.etaCommitments.id(req.params.entryId)
  if (!entry) fail(404, "ETA commitment not found")
  const poNumber = String(req.body.poNumber || "").trim()
  if (poNumber && !form.purchaseOrders.some(po => po.poNumber.toLowerCase() === poNumber.toLowerCase())) fail(400, "Select a PO number recorded on this UCL")
  entry.poNumber = poNumber
  entry.etaDate = purchaseDate(req.body.etaDate, "ETA date")
  entry.quantity = purchaseEntryNumber(req.body.quantity, "ETA quantity")
  entry.notes = String(req.body.notes || "").trim()
  entry.correctedBy = req.user.id; entry.correctedByName = req.user.name; entry.correctedAt = new Date()
  form.eta = [...form.etaCommitments].sort((a, b) => a.etaDate - b.etaDate)[0]?.etaDate || null
  form.history.push({ action: "ETA_COMMITMENT_CORRECTED", comment: `${entry.etaDate.toISOString().slice(0, 10)}: ${entry.quantity}`, actorId: req.user.id, actorName: req.user.name })
  await form.save()
  res.json(form)
})

exports.addInventoryTransaction = asyncHandler(async (req, res) => {
  const form = await purchaseForm(req)
  if (!ownsDepartment(req.user, form.receiverDepartmentId)) fail(403, "Only Purchase can record receipts or consumption")
  const kind = String(req.body.kind || "").toUpperCase()
  if (!["RECEIPT", "CONSUMPTION"].includes(kind)) fail(400, "Transaction must be a receipt or consumption")
  const transactionDate = purchaseDate(req.body.transactionDate, "Transaction date")
  const quantity = purchaseEntryNumber(req.body.quantity, "Transaction quantity")
  const poNumber = String(req.body.poNumber || "").trim()
  if (kind === "RECEIPT" && poNumber && !form.purchaseOrders.some(entry => entry.poNumber.toLowerCase() === poNumber.toLowerCase())) fail(400, "Select a PO number recorded on this UCL")
  if (form.inventoryTransactions.some(entry => entry.kind === kind && String(entry.poNumber || "").toLowerCase() === poNumber.toLowerCase() && entry.transactionDate.toISOString().slice(0, 10) === transactionDate.toISOString().slice(0, 10) && Number(entry.quantity) === quantity)) fail(409, "This inventory transaction has already been recorded")
  const delta = kind === "RECEIPT" ? quantity : -quantity
  if (Number(form.stockBalance || 0) + delta < 0) fail(409, "Consumption cannot exceed the current stock balance")
  form.inventoryTransactions.push({ kind, transactionDate, quantity, poNumber, notes: String(req.body.notes || "").trim(), createdBy: req.user.id, createdByName: req.user.name })
  recalculateStock(form)
  const totalReceived = form.inventoryTransactions.filter(entry => entry.kind === "RECEIPT").reduce((sum, entry) => sum + Number(entry.quantity), 0)
  const totalOrdered = form.purchaseOrders.reduce((sum, entry) => sum + Number(entry.quantity), 0)
  const previous = form.status
  if (kind === "RECEIPT") form.status = totalOrdered > 0 && totalReceived >= totalOrdered ? "COMPLETED" : "IN_TRANSIT"
  form.history.push({ action: kind === "RECEIPT" ? "RECEIPT_RECORDED" : "CONSUMPTION_RECORDED", fromStatus: previous, toStatus: form.status, comment: `${transactionDate.toISOString().slice(0, 10)}: ${quantity}`, actorId: req.user.id, actorName: req.user.name })
  await form.save()
  await adjustPlanningStock(form, delta, req.user)
  res.status(201).json(form)
})

exports.updateInventoryTransaction = asyncHandler(async (req, res) => {
  const form = await purchaseForm(req)
  if (!canCorrectPurchase(req.user, form)) fail(403, "Only the Purchase department manager can correct inventory transactions")
  const entry = form.inventoryTransactions.id(req.params.entryId)
  if (!entry) fail(404, "Inventory transaction not found")
  const previousSignedQuantity = signedInventoryQuantity(entry)
  const kind = String(req.body.kind || "").toUpperCase()
  if (!["RECEIPT", "CONSUMPTION"].includes(kind)) fail(400, "Transaction must be a receipt or consumption")
  entry.kind = kind
  entry.transactionDate = purchaseDate(req.body.transactionDate, "Transaction date")
  entry.quantity = purchaseEntryNumber(req.body.quantity, "Transaction quantity")
  entry.poNumber = String(req.body.poNumber || "").trim()
  entry.notes = String(req.body.notes || "").trim()
  entry.correctedBy = req.user.id; entry.correctedByName = req.user.name; entry.correctedAt = new Date()
  const rawBalance = Number(form.openingStockQty || 0) + form.inventoryTransactions.reduce((total, item) => total + signedInventoryQuantity(item), 0)
  if (rawBalance < 0) fail(409, "This correction would make the stock balance negative")
  recalculateStock(form)
  form.history.push({ action: "INVENTORY_TRANSACTION_CORRECTED", comment: `${entry.kind} ${entry.transactionDate.toISOString().slice(0, 10)}: ${entry.quantity}`, actorId: req.user.id, actorName: req.user.name })
  await form.save()
  await adjustPlanningStock(form, signedInventoryQuantity(entry) - previousSignedQuantity, req.user)
  res.json(form)
})

exports.updatePed = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail(400, "Invalid form identifier")
  const form = await RequestForm.findOne({ _id: req.params.id, ...scopeFor(req.user) })
  if (!form) fail(404, "Request form not found")
  if (form.type !== "FT") fail(400, "PED updates apply only to Fixture forms")
  if (!array(req.user.departmentIds).includes(form.receiverDepartmentId)) fail(403, "Only PED can update these fields")
  const price = req.body.price === "" || req.body.price === null || req.body.price === undefined ? null : Number(req.body.price)
  if (price !== null && (!Number.isFinite(price) || price < 0)) fail(400, "Price must be zero or greater")
  const status = String(req.body.status || form.status).toUpperCase()
  if (!UCL_STATUSES.has(status)) fail(400, "Select a valid Fixture status")
  const previous = form.status
  form.leadTime = String(req.body.leadTime || "").trim()
  form.price = price
  form.status = status
  form.eta = req.body.eta || null
  form.departmentRemarks = String(req.body.departmentRemarks || "").trim()
  form.reviewedBy = req.user.id
  form.reviewedAt = new Date()
  form.history.push({ action: "PED_UPDATED", fromStatus: previous, toStatus: status, comment: form.departmentRemarks, actorId: req.user.id, actorName: req.user.name })
  await form.save()
  await recordActivity({ type: "governance", category: "Requester Forms", action: "Fixture PED Updated", actorId: req.user.id, actorName: req.user.name, employeeCode: req.user.employeeCode, actorRole: req.user.role, target: form.formNumber, details: form.departmentRemarks, status: "Success", plantId: form.plantId })
  res.json(form)
})

exports.updateMaintenance = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail(400, "Invalid form identifier")
  const form = await RequestForm.findOne({ _id: req.params.id, ...scopeFor(req.user) })
  if (!form) fail(404, "Request form not found")
  if (form.type !== "MACHINE") fail(400, "Maintenance updates apply only to Machine forms")
  if (!array(req.user.departmentIds).includes(form.receiverDepartmentId)) fail(403, "Only Maintenance can update these fields")
  const price = req.body.price === "" || req.body.price === null || req.body.price === undefined ? null : Number(req.body.price)
  if (price !== null && (!Number.isFinite(price) || price < 0)) fail(400, "Price must be zero or greater")
  const status = String(req.body.status || form.status).toUpperCase()
  if (!UCL_STATUSES.has(status)) fail(400, "Select a valid Machine status")
  const previous = form.status
  form.leadTime = String(req.body.leadTime || "").trim()
  form.price = price
  form.status = status
  form.eta = req.body.eta || null
  form.departmentRemarks = String(req.body.departmentRemarks || "").trim()
  form.reviewedBy = req.user.id
  form.reviewedAt = new Date()
  form.history.push({ action: "MAINTENANCE_UPDATED", fromStatus: previous, toStatus: status, comment: form.departmentRemarks, actorId: req.user.id, actorName: req.user.name })
  await form.save()
  await recordActivity({ type: "governance", category: "Requester Forms", action: "Machine Maintenance Updated", actorId: req.user.id, actorName: req.user.name, employeeCode: req.user.employeeCode, actorRole: req.user.role, target: form.formNumber, details: form.departmentRemarks, status: "Success", plantId: form.plantId })
  res.json(form)
})

exports.bulkCreate = asyncHandler(async (req, res) => {
  if (!Array.isArray(req.body.forms) || req.body.forms.length === 0 || req.body.forms.length > 100) fail(400, "Provide between 1 and 100 forms")
  const created = []
  for (const input of req.body.forms) {
    const payload = await buildPayload(input, req.user)
    const formNumber = await nextFormNumber(payload.type)
    const initialStatus = ["UCL", "FT", "MACHINE"].includes(payload.type) ? "INPUT_PENDING" : "SUBMITTED"
    created.push(await RequestForm.create({ ...payload, formNumber, status: initialStatus, createdBy: req.user.id, createdByName: req.user.name, history: [{ action: "BULK_SUBMITTED", toStatus: initialStatus, actorId: req.user.id, actorName: req.user.name }] }))
  }
  await recordActivity({ type: "governance", category: "Requester Forms", action: "Bulk Forms Submitted", actorId: req.user.id, actorName: req.user.name, employeeCode: req.user.employeeCode, actorRole: req.user.role, target: `${created.length} forms`, details: "Bulk requester form submission", status: "Success", plantId: created[0]?.plantId || "" })
  res.status(201).json(created)
})

exports.changeStatus = asyncHandler(async (req, res) => {
  const form = await RequestForm.findOne({ _id: req.params.id, ...scopeFor(req.user) })
  if (!form) fail(404, "Request form not found")
  const nextStatus = String(req.body.status || "").toUpperCase()
  if (!TRANSITIONS[form.status]?.has(nextStatus)) fail(409, `Invalid status transition: ${form.status} -> ${nextStatus}`)
  const ownDepartments = array(req.user.departmentIds)
  const receiver = ownDepartments.includes(form.receiverDepartmentId)
  if (nextStatus === "CANCELLED") {
    if (String(form.createdBy) !== String(req.user.id) && !isAdmin(req.user)) fail(403, "Only the requester or an administrator can cancel this form")
  } else if (!receiver && !canManage(req.user)) fail(403, "Only the receiving department can review this form")
  if (["APPROVED", "REJECTED"].includes(nextStatus) && !canApprove(req.user)) fail(403, "Your role cannot make the final approval decision")
  const comment = String(req.body.comment || "").trim()
  if (nextStatus === "REJECTED" && !comment) fail(400, "A rejection reason is required")
  const previous = form.status
  form.status = nextStatus
  form.departmentRemarks = comment
  form.reviewedBy = req.user.id
  form.reviewedAt = new Date()
  form.history.push({ action: `STATUS_${nextStatus}`, fromStatus: previous, toStatus: nextStatus, comment, actorId: req.user.id, actorName: req.user.name })
  await form.save()
  await recordActivity({ type: "governance", category: "Requester Forms", action: `Form ${nextStatus}`, actorId: req.user.id, actorName: req.user.name, employeeCode: req.user.employeeCode, actorRole: req.user.role, target: form.formNumber, details: comment, status: "Success", plantId: form.plantId })
  res.json(form)
})

exports.errorHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error)
  const status = error.statusCode || (error.code === 11000 ? 409 : 500)
  if (status >= 500) console.error("Requester form error:", error)
  res.status(status).json({ message: status >= 500 ? "Requester form operation failed" : error.message })
}
