const mongoose = require("mongoose")

const HistorySchema = new mongoose.Schema({
  action: { type: String, required: true },
  fromStatus: { type: String, default: "" },
  toStatus: { type: String, default: "" },
  comment: { type: String, default: "" },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  actorName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: true })

const PurchaseOrderSchema = new mongoose.Schema({
  poNumber: { type: String, required: true, trim: true },
  releaseDate: { type: Date, required: true },
  quantity: { type: Number, required: true, min: Number.MIN_VALUE },
  notes: { type: String, default: "", trim: true, maxlength: 1000 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdByName: { type: String, required: true },
  correctedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  correctedByName: { type: String, default: "" },
  correctedAt: { type: Date, default: null },
}, { _id: true, timestamps: true })

const EtaCommitmentSchema = new mongoose.Schema({
  poNumber: { type: String, default: "", trim: true },
  etaDate: { type: Date, required: true },
  quantity: { type: Number, required: true, min: Number.MIN_VALUE },
  notes: { type: String, default: "", trim: true, maxlength: 1000 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdByName: { type: String, required: true },
  correctedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  correctedByName: { type: String, default: "" },
  correctedAt: { type: Date, default: null },
}, { _id: true, timestamps: true })

const InventoryTransactionSchema = new mongoose.Schema({
  kind: { type: String, enum: ["RECEIPT", "CONSUMPTION"], required: true },
  transactionDate: { type: Date, required: true },
  quantity: { type: Number, required: true, min: Number.MIN_VALUE },
  poNumber: { type: String, default: "", trim: true },
  notes: { type: String, default: "", trim: true, maxlength: 1000 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdByName: { type: String, required: true },
  correctedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  correctedByName: { type: String, default: "" },
  correctedAt: { type: Date, default: null },
}, { _id: true, timestamps: true })

const RequestFormSchema = new mongoose.Schema({
  formNumber: { type: String, required: true, unique: true, index: true },
  type: { type: String, enum: ["UCL", "FT", "MACHINE"], required: true, index: true },
  projectId: { type: String, required: true, index: true },
  projectName: { type: String, required: true, trim: true },
  customer: { type: String, required: true, trim: true },
  partNumber: { type: String, required: true, trim: true },
  dtplPartNumber: { type: String, default: "", trim: true },
  description: { type: String, default: "", trim: true, maxlength: 2000 },
  functionName: { type: String, default: "", trim: true },
  materials: { type: String, default: "", trim: true },
  specification: { type: String, default: "", trim: true, maxlength: 2000 },
  range: { type: String, default: "", trim: true },
  make: { type: String, default: "", trim: true },
  supplier: { type: String, default: "", trim: true },
  supplierPartNumber: { type: String, default: "", trim: true },
  quantity: { type: Number, required: true, min: Number.MIN_VALUE },
  sopDate: { type: Date, default: null },
  sopVolume: { type: Number, default: null, min: 0 },
  rfqNumber: { type: String, default: "", trim: true },
  prNumber: { type: String, default: "", trim: true },
  prQuantity: { type: Number, default: null, min: 0 },
  m1Month: { type: String, default: "", trim: true },
  m1Quantity: { type: Number, default: null, min: 0 },
  m3Quantity: { type: Number, default: null, min: 0 },
  targetDate: { type: Date, default: null },
  leadTime: { type: String, default: "", trim: true },
  moq: { type: Number, default: null, min: 0 },
  spq: { type: Number, default: null, min: 0 },
  price: { type: Number, default: null, min: 0 },
  currency: { type: String, default: "", trim: true, uppercase: true },
  perQuantity: { type: Number, default: null, min: Number.MIN_VALUE },
  eta: { type: Date, default: null },
  remarks: { type: String, default: "", maxlength: 4000 },
  departmentRemarks: { type: String, default: "", maxlength: 4000 },
  openingStockQty: { type: Number, default: 0, min: 0 },
  stockBalance: { type: Number, default: 0, min: 0 },
  purchaseOrders: { type: [PurchaseOrderSchema], default: [] },
  etaCommitments: { type: [EtaCommitmentSchema], default: [] },
  inventoryTransactions: { type: [InventoryTransactionSchema], default: [] },
  senderDepartmentId: { type: String, required: true, index: true },
  senderDepartmentName: { type: String, required: true },
  receiverDepartmentId: { type: String, required: true, index: true },
  receiverDepartmentName: { type: String, required: true },
  plantId: { type: String, required: true, index: true },
  status: { type: String, enum: ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED", "VOID", "INPUT_PENDING", "RFQ", "UNDER_PR_APPROVAL", "UNDER_PO_APPROVAL", "PO_ISSUED", "IN_TRANSIT", "COMPLETED"], default: "SUBMITTED", index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  createdByName: { type: String, required: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
  history: { type: [HistorySchema], default: [] },
}, { timestamps: true, optimisticConcurrency: true })

RequestFormSchema.index({ plantId: 1, type: 1, status: 1, createdAt: -1 })
RequestFormSchema.index({ senderDepartmentId: 1, receiverDepartmentId: 1, createdAt: -1 })
RequestFormSchema.index({ plantId: 1, type: 1, createdBy: 1, createdAt: -1 })
RequestFormSchema.index({ plantId: 1, type: 1, senderDepartmentId: 1, createdAt: -1 })
RequestFormSchema.index({ plantId: 1, type: 1, receiverDepartmentId: 1, createdAt: -1 })
RequestFormSchema.index({ formNumber: "text", projectName: "text", customer: "text", partNumber: "text", supplier: "text" })

module.exports = mongoose.model("RequestForm", RequestFormSchema)
