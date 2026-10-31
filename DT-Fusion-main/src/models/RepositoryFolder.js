const mongoose = require("mongoose")

const PermissionSchema = new mongoose.Schema({
  principalType: { type: String, enum: ["user", "role", "department"], required: true },
  principalId: { type: String, required: true },
  actions: [{ type: String }],
}, { _id: false })

const RepositoryFolderSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "RepositoryFolder", default: null, index: true },
  departmentId: { type: String, default: "", index: true },
  description: { type: String, default: "", maxlength: 1000 },
  inheritPermissions: { type: Boolean, default: true },
  permissions: { type: [PermissionSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  archived: { type: Boolean, default: false, index: true },
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  archivedAt: { type: Date, default: null },
}, { timestamps: true })

RepositoryFolderSchema.index({ parentId: 1, name: 1, archived: 1 })
RepositoryFolderSchema.index({ departmentId: 1, archived: 1 })

module.exports = mongoose.model("RepositoryFolder", RepositoryFolderSchema)
