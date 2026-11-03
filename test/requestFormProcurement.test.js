const test = require("node:test")
const assert = require("node:assert/strict")
const mongoose = require("mongoose")
const RequestForm = require("../src/models/RequestForm")

const base = () => ({
  formNumber: `UCL-TEST-${Date.now()}`,
  type: "UCL",
  projectId: "PROJECT-1",
  projectName: "Test project",
  customer: "Test customer",
  partNumber: "PART-1",
  quantity: 550,
  senderDepartmentId: "RND-1",
  senderDepartmentName: "R&D",
  receiverDepartmentId: "PURCHASE-1",
  receiverDepartmentName: "Purchase",
  plantId: "PLANT-1",
  createdBy: new mongoose.Types.ObjectId(),
  createdByName: "Tester",
})

test("UCL form keeps multiple PO, ETA, receipt, and consumption transactions", () => {
  const actor = new mongoose.Types.ObjectId()
  const form = new RequestForm({
    ...base(),
    prQuantity: 550,
    openingStockQty: 25,
    stockBalance: 95,
    purchaseOrders: [
      { poNumber: "PO-1", releaseDate: "2026-11-01", quantity: 300, createdBy: actor, createdByName: "Buyer" },
      { poNumber: "PO-2", releaseDate: "2026-12-01", quantity: 150, createdBy: actor, createdByName: "Buyer" },
    ],
    etaCommitments: [
      { poNumber: "PO-1", etaDate: "2026-11-15", quantity: 200, createdBy: actor, createdByName: "Buyer" },
      { poNumber: "PO-1", etaDate: "2026-11-30", quantity: 100, createdBy: actor, createdByName: "Buyer" },
    ],
    inventoryTransactions: [
      { kind: "RECEIPT", transactionDate: "2026-11-15", quantity: 80, poNumber: "PO-1", createdBy: actor, createdByName: "Buyer" },
      { kind: "CONSUMPTION", transactionDate: "2026-11-20", quantity: 10, createdBy: actor, createdByName: "Buyer" },
    ],
  })
  assert.equal(form.validateSync(), undefined)
  assert.equal(form.purchaseOrders.length, 2)
  assert.equal(form.etaCommitments.length, 2)
  assert.equal(form.inventoryTransactions.length, 2)
})

test("procurement transaction quantities must be greater than zero", () => {
  const actor = new mongoose.Types.ObjectId()
  const form = new RequestForm({
    ...base(),
    purchaseOrders: [{ poNumber: "PO-INVALID", releaseDate: "2026-11-01", quantity: 0, createdBy: actor, createdByName: "Buyer" }],
  })
  assert.ok(form.validateSync()?.errors["purchaseOrders.0.quantity"])
})
