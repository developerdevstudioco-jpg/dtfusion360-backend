const mongoose = require("mongoose")

const RepositoryRecentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", required: true },
  lastAccessedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true })

RepositoryRecentSchema.index({ userId: 1, documentId: 1 }, { unique: true })
RepositoryRecentSchema.index({ userId: 1, lastAccessedAt: -1 })
module.exports = mongoose.model("RepositoryRecent", RepositoryRecentSchema)
