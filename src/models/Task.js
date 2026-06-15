const mongoose = require("mongoose")

const TaskSchema = new mongoose.Schema({
  id: String,
  name: String,
  departmentId: String,
  departmentIds: { type: [String], default: [] },
  phase: String,
  description: String,
  supportingDoc: String,
  isCftTask: { type: Boolean, default: false },
  cftTeam: { type: String, default: "" },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model("Task", TaskSchema)
