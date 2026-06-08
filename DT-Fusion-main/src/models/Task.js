const mongoose = require("mongoose")

const TaskSchema = new mongoose.Schema({
  id: String,
  name: String,
  departmentId: String,
  phase: String,
  description: String,
  supportingDoc: String,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model("Task", TaskSchema)
