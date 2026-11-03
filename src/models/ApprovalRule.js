const mongoose = require("mongoose")

const ApprovalStageSchema = new mongoose.Schema({
  order: { type: Number, required: true },
  roleKeys: [{ type: String }],
  userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { _id: false })

const ApprovalRuleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  priority: { type: Number, default: 100, index: true },
  departmentId: { type: String, default: "" },
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: "RepositoryFolder", default: null },
  documentType: { type: String, default: "" },
  controlledDocument: { type: Boolean, default: null },
  stages: { type: [ApprovalStageSchema], default: [] },
  active: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true })

module.exports = mongoose.model("ApprovalRule", ApprovalRuleSchema)
