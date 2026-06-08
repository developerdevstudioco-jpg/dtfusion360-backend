const mongoose = require("mongoose")

const MessageSchema = new mongoose.Schema({
  conversationId: String,
  senderId: String,
  body: String,
  createdAt: { type: Date, default: Date.now },
  status: { type: String, default: "SENT" }
})

module.exports = mongoose.model("Message", MessageSchema)