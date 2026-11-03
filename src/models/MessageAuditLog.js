const mongoose = require("mongoose")

const MessageAuditLogSchema = new mongoose.Schema({
  messageId: { type: String, default: null, index: true },
  conversationId: { type: String, required: true, index: true },
  action: { type: String, enum: ["MESSAGE_CREATED", "MESSAGE_EDITED", "MESSAGE_DELETED", "ATTACHMENT_UPLOADED", "ATTACHMENT_DOWNLOADED", "CHANNEL_CREATED", "CHANNEL_UPDATED", "CHANNEL_ARCHIVED", "MEMBER_ADDED", "MEMBER_REMOVED", "MEMBER_REPLACED", "ROLE_CHANGED"], required: true },
  performedBy: { type: String, required: true },
  previousValue: { type: mongoose.Schema.Types.Mixed, default: null },
  newValue: { type: mongoose.Schema.Types.Mixed, default: null },
  timestamp: { type: Date, default: Date.now, index: true },
})

MessageAuditLogSchema.index({ conversationId: 1, timestamp: -1 })
module.exports = mongoose.model("MessageAuditLog", MessageAuditLogSchema)
