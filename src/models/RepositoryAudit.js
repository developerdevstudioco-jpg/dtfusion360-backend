const mongoose = require("mongoose")

const RepositoryAuditSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", default: null, index: true },
  revisionId: { type: mongoose.Schema.Types.ObjectId, ref: "DocumentRevision", default: null, index: true },
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: "RepositoryFolder", default: null, index: true },
  action: { type: String, required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  actorName: { type: String, required: true },
  employeeCode: { type: String, default: "" },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  ipAddress: { type: String, default: "" },
  userAgent: { type: String, default: "" },
}, { timestamps: { createdAt: true, updatedAt: false } })

RepositoryAuditSchema.index({ documentId: 1, createdAt: -1 })
RepositoryAuditSchema.index({ folderId: 1, createdAt: -1 })
module.exports = mongoose.model("RepositoryAudit", RepositoryAuditSchema)
