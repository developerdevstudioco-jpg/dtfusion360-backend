const mongoose = require("mongoose")

const DocumentRevisionSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", required: true, index: true },
  revisionNumber: { type: String, required: true, uppercase: true },
  fileName: { type: String, required: true },
  originalFileName: { type: String, required: true },
  fileExtension: { type: String, required: true, lowercase: true },
  mimeType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  storageKey: { type: String, required: true, unique: true, select: false },
  checksum: { type: String, required: true, index: true },
  revisionNotes: { type: String, default: "", maxlength: 4000 },
  status: { type: String, enum: ["DRAFT", "PENDING_APPROVAL", "UNDER_REVIEW", "CHANGES_REQUESTED", "REJECTED", "APPROVED", "SUPERSEDED", "ARCHIVED"], default: "DRAFT", index: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  uploadedAt: { type: Date, default: Date.now },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  submittedAt: { type: Date, default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  approvedAt: { type: Date, default: null },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  rejectedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: "" },
  changeRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  changeRequestedAt: { type: Date, default: null },
  changeRequestComment: { type: String, default: "" },
  reviewComment: { type: String, default: "" },
  effectiveDate: { type: Date, default: null },
  supersededAt: { type: Date, default: null },
}, { timestamps: true, optimisticConcurrency: true })

DocumentRevisionSchema.index({ documentId: 1, revisionNumber: 1 }, { unique: true })
DocumentRevisionSchema.index({ status: 1, submittedAt: 1 })

module.exports = mongoose.model("DocumentRevision", DocumentRevisionSchema)
