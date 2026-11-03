const mongoose = require("mongoose")

const attachmentSchema = new mongoose.Schema({
  attachmentId: { type: String, required: true },
  fileName: { type: String, required: true },
  fileExtension: { type: String, required: true },
  mimeType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  storagePath: { type: String, required: true, select: false },
  uploadedBy: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  securityScanStatus: { type: String, enum: ["PENDING", "CLEAN", "BLOCKED", "FAILED"], default: "PENDING" },
}, { _id: false })

const reactionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  reaction: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false })

const MessageSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, index: true },
  senderId: { type: String, required: true, index: true },
  body: { type: String, trim: true, maxlength: 10000, default: "" },
  clientId: { type: String, default: null, index: true },
  parentMessageId: { type: String, default: null },
  messageType: { type: String, enum: ["TEXT", "FILE", "SYSTEM"], default: "TEXT" },
  structuredPayload: { type: mongoose.Schema.Types.Mixed, default: null },
  attachments: { type: [attachmentSchema], default: [] },
  reactions: { type: [reactionSchema], default: [] },
  mentions: { type: [String], default: [] },
  deliveredTo: { type: [String], default: [] },
  readBy: { type: [String], default: [] },
  pinnedBy: { type: [String], default: [] },
  starredBy: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  editedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, default: null },
  status: { type: String, enum: ["SENT", "DELIVERED", "READ"], default: "SENT" },
})

MessageSchema.index({ conversationId: 1, createdAt: -1 })
MessageSchema.index({ body: "text" })
MessageSchema.index({ clientId: 1, senderId: 1 }, { unique: true, sparse: true })

module.exports = mongoose.model("Message", MessageSchema)
