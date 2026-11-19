const mongoose = require("mongoose")

const DocumentSchema = new mongoose.Schema({
  documentNumber: { type: String, required: true, trim: true, uppercase: true, unique: true },
  title: { type: String, required: true, trim: true, maxlength: 240 },
  description: { type: String, default: "", maxlength: 4000 },
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: "RepositoryFolder", required: true, index: true },
  departmentId: { type: String, default: "", index: true },
  projectId: { type: String, default: "", index: true },
  customerId: { type: String, default: "", index: true },
  documentType: { type: String, required: true, index: true },
  classification: { type: String, enum: ["INTERNAL", "CONFIDENTIAL", "RESTRICTED"], default: "INTERNAL", index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  controlledDocument: { type: Boolean, default: false, index: true },
  currentRevisionId: { type: mongoose.Schema.Types.ObjectId, ref: "DocumentRevision", default: null },
  currentRevisionNumber: { type: String, default: "" },
  status: { type: String, enum: ["DRAFT", "PENDING_APPROVAL", "CHANGES_REQUESTED", "REJECTED", "APPROVED", "ARCHIVED"], default: "DRAFT", index: true },
  tags: [{ type: String, trim: true, lowercase: true }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  archived: { type: Boolean, default: false, index: true },
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  archivedAt: { type: Date, default: null },
}, { timestamps: true, optimisticConcurrency: true })

DocumentSchema.index({ folderId: 1, archived: 1, title: 1 })
DocumentSchema.index({ ownerId: 1, updatedAt: -1 })
DocumentSchema.index({ title: "text", documentNumber: "text", description: "text", tags: "text" })

module.exports = mongoose.model("Document", DocumentSchema)
