const mongoose = require("mongoose")

const ActivityLogSchema = new mongoose.Schema({
  type: { type: String, enum: ["login", "governance", "project", "system"], default: "system", index: true },
  category: { type: String, required: true, index: true },
  action: { type: String, required: true },
  actorId: { type: String, default: "" },
  actorName: { type: String, default: "Unknown" },
  actorEmail: { type: String, default: "" },
  employeeCode: { type: String, default: "", index: true },
  actorRole: { type: String, default: "" },
  target: { type: String, default: "" },
  details: { type: String, default: "" },
  status: { type: String, enum: ["Success", "Failed"], default: "Success", index: true },
  severity: { type: String, enum: ["Info", "Warning", "Success", "Danger"], default: "Info" },
  ipAddress: { type: String, default: "" },
  userAgent: { type: String, default: "" },
  method: { type: String, default: "" },
  path: { type: String, default: "" },
  statusCode: { type: Number },
  plantId: { type: String, default: "", index: true },
  projectId: { type: String, default: "", index: true },
}, { timestamps: true })

ActivityLogSchema.index({ createdAt: -1 })
ActivityLogSchema.index({ type: 1, createdAt: -1 })
ActivityLogSchema.index({ plantId: 1, createdAt: -1 })

module.exports = mongoose.model("ActivityLog", ActivityLogSchema)
