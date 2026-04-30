const mongoose = require("mongoose");

const RBACSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["role", "department"],
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    page: {
      type: String,
      required: true,
    },
    access: {
      type: String,
      enum: ["allowed", "blocked"],
      default: "blocked",
    },
    reason: {
      type: String,
      default: "Custom rule",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    updatedBy: {
      type: String,
      default: "system",
    },
  },
  { timestamps: true }
);

RBACSchema.index({ type: 1, name: 1, page: 1 }, { unique: true });

RBACSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("RBAC", RBACSchema);
