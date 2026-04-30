const mongoose = require("mongoose")

const RevisionSchema = new mongoose.Schema({
  fileName: String,
  revision: String,
  uploadedBy: String,
  uploadedDate: String,
  approvalStatus: { type: String, default: "pending" },
  approver: String,
  notes: String,
  isLatest: Boolean,
  fileType: String
})

const FileSchema = new mongoose.Schema({
  name: String,
  category: String,
  department: String,
  revisions: [RevisionSchema]
})

const SubdomainSchema = new mongoose.Schema({
  name: String,
  files: [FileSchema]
})

const FolderSchema = new mongoose.Schema({
  name: String,
  department: String,
  subdomains: [SubdomainSchema]
})

// map _id → id
FolderSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v

    ret.subdomains?.forEach(sd => {
      sd.id = sd._id.toString()
      delete sd._id

      sd.files?.forEach(f => {
        f.id = f._id.toString()
        delete f._id

        f.revisions?.forEach(r => {
          r.id = r._id.toString()
          delete r._id
        })
      })
    })
  }
})

module.exports = mongoose.model("Folder", FolderSchema)