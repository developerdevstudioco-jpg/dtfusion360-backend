const mongoose = require("mongoose")

const memberSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  role: { type: String, enum: ["MESSAGING_ADMIN", "OWNER", "ADMIN", "MEMBER", "READ_ONLY"], default: "MEMBER" },
  joinedAt: { type: Date, default: Date.now },
  notificationSetting: { type: String, enum: ["ALL", "MENTIONS", "MUTED"], default: "ALL" },
  isFavorite: { type: Boolean, default: false },
  isMuted: { type: Boolean, default: false },
}, { _id: false })

const conversationSchema = new mongoose.Schema({
  name: { type: String, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1000, default: "" },
  channelType: { type: String, enum: ["DIRECT", "PRIVATE_GROUP", "PROJECT", "DEPARTMENT", "PLANT", "DTPL_GROUP"], default: "DIRECT", index: true },
  isGroup: { type: Boolean, default: false },
  isAnnouncement: { type: Boolean, default: false },
  participants: [{ type: String, index: true }],
  members: { type: [memberSchema], default: [] },
  projectId: { type: String, default: null, index: true },
  departmentId: { type: String, default: null, index: true },
  plantId: { type: String, default: null, index: true },
  createdBy: { type: String, required: true },
  avatarUrl: { type: String, default: null },
  status: { type: String, enum: ["ACTIVE", "ARCHIVED"], default: "ACTIVE", index: true },
  lastMessage: { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now, index: true },
})

conversationSchema.pre("save", function syncMembers(next) {
  if (!this.participants.length && this.members.length) this.participants = this.members.map((member) => member.userId)
  if (!this.members.length && this.participants.length) {
    this.members = this.participants.map((userId) => ({ userId, role: userId === this.createdBy ? "OWNER" : "MEMBER" }))
  }
  this.isGroup = this.channelType !== "DIRECT"
  this.updatedAt = new Date()
  next()
})

conversationSchema.index({ participants: 1, updatedAt: -1 })
conversationSchema.index({ name: "text", description: "text" })

module.exports = mongoose.model("Conversation", conversationSchema)
