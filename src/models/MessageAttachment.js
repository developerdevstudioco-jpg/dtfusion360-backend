const mongoose = require("mongoose")

const MessageAttachmentSchema = new mongoose.Schema({
  attachmentId: { type: String, required: true, unique: true, index: true },
  messageId: { type: String, default: null, index: true },
  conversationId: { type: String, default: null, index: true },
  fileName: { type: String, required: true },
  fileExtension: { type: String, required: true },
  mimeType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  storagePath: { type: String, required: true, select: false },
  uploadedBy: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  securityScanStatus: { type: String, enum: ["PENDING", "CLEAN", "BLOCKED", "FAILED"], default: "CLEAN" },
})

module.exports = mongoose.model("MessageAttachment", MessageAttachmentSchema)
