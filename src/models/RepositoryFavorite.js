const mongoose = require("mongoose")

const RepositoryFavoriteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  targetType: { type: String, enum: ["document", "folder"], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
}, { timestamps: true })

RepositoryFavoriteSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true })
module.exports = mongoose.model("RepositoryFavorite", RepositoryFavoriteSchema)
