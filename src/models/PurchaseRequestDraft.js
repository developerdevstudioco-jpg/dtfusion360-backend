const mongoose = require("mongoose")

const PurchaseRequestLineSchema = new mongoose.Schema({
  mpn: { type: String, required: true, trim: true, uppercase: true },
  materialCode: { type: String, default: "", trim: true },
  description: { type: String, default: "", trim: true },
  projectCodes: { type: [String], default: [] },
  requiredQty: { type: Number, required: true, min: 0 },
  availableQty: { type: Number, required: true, min: 0 },
  confirmedIncomingQty: { type: Number, required: true, min: 0 },
  netRequiredQty: { type: Number, required: true, min: 0 },
  suggestedPrQty: { type: Number, required: true, min: Number.MIN_VALUE },
  requiredDate: { type: Date, default: null },
  plannedPrRaiseDate: { type: Date, default: null },
}, { _id: false })

const PurchaseRequestDraftSchema = new mongoose.Schema({
  draftNumber: { type: String, required: true, unique: true, index: true },
  plantId: { type: String, required: true, index: true },
  status: { type: String, enum: ["DRAFT", "SUBMITTED", "CANCELLED"], default: "DRAFT", index: true },
  lines: { type: [PurchaseRequestLineSchema], required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdByName: { type: String, required: true },
}, { timestamps: true })

PurchaseRequestDraftSchema.index({ plantId: 1, "lines.mpn": 1, status: 1 })

module.exports = mongoose.model("PurchaseRequestDraft", PurchaseRequestDraftSchema)
