const mongoose = require("mongoose")

const PurchasePlanningSchema = new mongoose.Schema({
  plantId: { type: String, required: true, index: true },
  mpn: { type: String, required: true, trim: true, uppercase: true },
  materialCode: { type: String, default: "", trim: true },
  availableQty: { type: Number, default: 0, min: 0 },
  safetyBufferDays: { type: Number, default: 7, min: 0 },
  draftNumber: { type: String, default: "", trim: true },
  draftStatus: { type: String, enum: ["", "DRAFT", "CANCELLED", "SUBMITTED"], default: "" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  updatedByName: { type: String, required: true },
}, { timestamps: true })

PurchasePlanningSchema.index({ plantId: 1, mpn: 1 }, { unique: true })

module.exports = mongoose.model("PurchasePlanning", PurchasePlanningSchema)
