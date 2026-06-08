const mongoose = require("mongoose")

const ConversationSchema = new mongoose.Schema({
  name: String,
  isGroup: { type: Boolean, default: false },

  // ✅ IMPORTANT: use employeeCode (NOT _id)
  participants: [String],

  lastMessage: Object,

  updatedAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model("Conversation", ConversationSchema)