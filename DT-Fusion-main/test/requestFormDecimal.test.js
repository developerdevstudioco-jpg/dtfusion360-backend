const test = require("node:test")
const assert = require("node:assert/strict")
const mongoose = require("mongoose")
const RequestForm = require("../src/models/RequestForm")

const validForm = (overrides = {}) => new RequestForm({
  formNumber: `UCL-DECIMAL-${Date.now()}`,
  type: "UCL",
  projectId: "PROJECT-1",
  projectName: "Decimal project",
  customer: "Test customer",
  partNumber: "PART-1",
  quantity: 0.1,
  perQuantity: 0.2,
  senderDepartmentId: "RND",
  senderDepartmentName: "R&D",
  receiverDepartmentId: "PURCHASE",
  receiverDepartmentName: "Purchase",
  plantId: "PLANT-1",
  createdBy: new mongoose.Types.ObjectId(),
  createdByName: "Test user",
  ...overrides,
})

test("request forms accept positive decimal quantities below one", () => {
  const error = validForm({
    quantity: 0.1,
    sopVolume: 0.2,
    m1Quantity: 0.3,
    m3Quantity: 0.4,
    moq: 0.5,
    spq: 0.6,
    price: 0.7,
    perQuantity: 0.8,
  }).validateSync()

  assert.equal(error, undefined)
})

test("request forms still reject zero for required positive quantities", () => {
  const quantityError = validForm({ quantity: 0 }).validateSync()
  const perQuantityError = validForm({ perQuantity: 0 }).validateSync()

  assert.ok(quantityError?.errors.quantity)
  assert.ok(perQuantityError?.errors.perQuantity)
})
