const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("path")
const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")
require("dotenv").config({ path: path.join(__dirname, "..", ".env") })

const enabled = process.env.REQUEST_FORMS_INTEGRATION === "1"

test("request forms UCL Purchase, Fixture PED, and Machine Maintenance workflows", { skip: !enabled }, async () => {
  const User = require("../src/models/Users")
  const Project = require("../src/models/Project")
  const Department = require("../src/models/Department")
  const RequestForm = require("../src/models/RequestForm")
  const ActivityLog = require("../src/models/ActivityLog")
  await mongoose.connect(process.env.MONGO_URI)
  const project = await Project.findOne({ plantId: { $ne: "" } }).lean()
  assert.ok(project, "integration database needs at least one project")
  const departments = await Department.find({ plantId: project.plantId, isActive: true }).lean()
  assert.ok(departments.length >= 2, "project plant needs two active departments")
  const rndDepartment = departments.find(item => /r\s*&\s*d|research\s*(and|&)\s*development/i.test(item.name))
  const purchaseDepartment = departments.find(item => /purchase/i.test(item.name))
  const pedDepartment = departments.find(item => /\bped\b|process\s*engineering/i.test(item.name))
  const maintenanceDepartment = departments.find(item => /maintenance/i.test(item.name))
  assert.ok(rndDepartment && purchaseDepartment && pedDepartment && maintenanceDepartment, "project plant needs active R&D, Purchase, PED, and Maintenance departments")
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const user = await User.create({ name: "Forms Integration", email: `forms-${suffix}@invalid.local`, employeeCode: `FORM-${suffix}`, role: "SuperAdmin", isActive: true, plantIds: [project.plantId], departmentIds: departments.map(item => item.id) })
  const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET || "secretkey")
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
  const createdIds = []
  const targets = []
  const api = async (url, options = {}) => {
    const response = await fetch(`http://127.0.0.1:8080/api/request-forms${url}`, { ...options, headers: { ...headers, ...(options.headers || {}) } })
    const body = await response.json()
    if (!response.ok) throw new Error(`${response.status}: ${body.message}`)
    return body
  }
  const payload = (type) => ({ type, projectId: project.id, supplier: "Integration Supplier", quantity: 12, senderDepartmentId: type === "UCL" ? rndDepartment.id : departments.find(item => ![pedDepartment.id, maintenanceDepartment.id].includes(item.id)).id, receiverDepartmentId: type === "UCL" ? purchaseDepartment.id : type === "FT" ? pedDepartment.id : maintenanceDepartment.id, targetDate: "2027-01-31", remarks: "Integration workflow" })
  try {
    const first = await api("/", { method: "POST", body: JSON.stringify(payload("UCL")) })
    createdIds.push(first._id); targets.push(first.formNumber)
    assert.match(first.formNumber, /^UCL-\d{4}-\d{5}$/)
    assert.equal(first.status, "INPUT_PENDING")
    const approved = await api(`/${first._id}/purchase`, { method: "PATCH", body: JSON.stringify({ status: "PO_ISSUED", leadTime: "4 weeks", moq: 10, spq: 5, price: 125, currency: "INR", perQuantity: 1, eta: "2027-01-15", departmentRemarks: "PO released" }) })
    assert.equal(approved.status, "PO_ISSUED")
    assert.equal(approved.leadTime, "4 weeks")
    const details = await api(`/${first._id}`)
    assert.equal(details.history.length, 2)

    const second = await api("/", { method: "POST", body: JSON.stringify(payload("FT")) })
    createdIds.push(second._id); targets.push(second.formNumber)
    assert.equal(second.status, "INPUT_PENDING")
    const completed = await api(`/${second._id}/ped`, { method: "PATCH", body: JSON.stringify({ status: "COMPLETED", leadTime: "3 weeks", price: 900, eta: "2027-01-20", departmentRemarks: "Fixture delivered" }) })
    assert.equal(completed.status, "COMPLETED")
    assert.equal(completed.departmentRemarks, "Fixture delivered")
    const list = await api("/?type=FT")
    assert.ok(list.forms.some(item => item._id === second._id))
    const projectList = await api(`/?type=FT&projectId=${encodeURIComponent(project.id)}`)
    assert.ok(projectList.forms.some(item => item._id === second._id))
    assert.ok(projectList.forms.every(item => item.projectId === project.id))

    const third = await api("/", { method: "POST", body: JSON.stringify(payload("MACHINE")) })
    createdIds.push(third._id); targets.push(third.formNumber)
    assert.equal(third.status, "INPUT_PENDING")
    const inTransit = await api(`/${third._id}/maintenance`, { method: "PATCH", body: JSON.stringify({ status: "IN_TRANSIT", leadTime: "8 weeks", price: 250000, eta: "2027-02-05", departmentRemarks: "Machine dispatched" }) })
    assert.equal(inTransit.status, "IN_TRANSIT")
    assert.equal(inTransit.price, 250000)
  } finally {
    await RequestForm.deleteMany({ _id: { $in: createdIds } })
    await ActivityLog.deleteMany({ category: "Requester Forms", target: { $in: targets } })
    await User.deleteOne({ _id: user._id })
    await mongoose.disconnect()
  }
})
