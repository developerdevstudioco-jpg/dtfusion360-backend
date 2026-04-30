const Folder = require("../models/FileManager")
const path = require("path")
const fs = require("fs")

// ------------------ LIST ------------------
exports.listFiles = async (req, res) => {
  try {
    const folders = await Folder.find()
    res.json(folders)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ------------------ CREATE FOLDER ------------------
exports.createFolder = async (req, res) => {
  try {
    const folder = await Folder.create({
      name: req.body.name,
      department: req.body.department,
      subdomains: []
    })

    res.json(folder)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ------------------ CREATE SUBDOMAIN ------------------
exports.createSubdomain = async (req, res) => {
  try {

    const folder = await Folder.findById(req.body.folderId)
    if (!folder) return res.status(404).json({ message: "Folder not found" })

    const subdomain = {
      name: req.body.name,
      files: []
    }

    folder.subdomains.push(subdomain)
    await folder.save()

    res.json(folder.subdomains[folder.subdomains.length - 1])

  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ------------------ UPLOAD FILE ------------------
exports.uploadFile = async (req, res) => {
  try {

    console.log("BODY:", req.body)
    console.log("FILE:", req.file)

    if (!req.file) {
      return res.status(400).json({ message: "File not received" })
    }

    const { folderId, subdomainId } = req.body

    if (!folderId || !subdomainId) {
      return res.status(400).json({ message: "Missing folderId or subdomainId" })
    }

    const folder = await Folder.findById(folderId)
    if (!folder) return res.status(404).json({ message: "Folder not found" })

    const subdomain = folder.subdomains.find(
      sd => sd._id.toString() === subdomainId
    )
    if (!subdomain) return res.status(404).json({ message: "Subdomain not found" })

    const newFile = {
      name: req.file.originalname,
      category: "general",
      department: "",
      revisions: [
        {
          fileName: req.file.originalname,
          filePath: req.file.path,
          revision: "v1",
          uploadedBy: "system",
          uploadedDate: new Date().toISOString().split("T")[0],
          isLatest: true,
          fileType: req.file.mimetype
        }
      ]
    }

    subdomain.files.push(newFile)
    await folder.save()

    res.json({
      message: "File uploaded",
      file: newFile
    })

  } catch (err) {
    console.error("UPLOAD ERROR:", err)
    res.status(500).json({ message: err.message })
  }
}
// ------------------ ADD REVISION ------------------
exports.addRevision = async (req, res) => {
  try {

    const { folderId, subdomainId, fileId } = req.body

    const folder = await Folder.findById(folderId)
    if (!folder) return res.status(404).json({ message: "Folder not found" })

    const subdomain = folder.subdomains.find(
      sd => sd._id.toString() === subdomainId
    )

    const file = subdomain.files.find(
      f => f._id.toString() === fileId
    )

    const uploadedFile = req.file

    file.revisions.forEach(r => r.isLatest = false)

    const newRevision = {
      fileName: uploadedFile.originalname,
      filePath: uploadedFile.path,
      revision: "v" + (file.revisions.length + 1),
      uploadedBy: "system",
      uploadedDate: new Date().toISOString().split("T")[0],
      isLatest: true,
      fileType: path.extname(uploadedFile.originalname)
    }

    file.revisions.push(newRevision)

    await folder.save()

    res.json({
      message: "Revision saved",
      revision: newRevision
    })

  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ------------------ DOWNLOAD FILE ------------------
exports.downloadFile = async (req, res) => {
  try {

    const { folderId, subdomainId, fileId, revisionId } = req.query

    const folder = await Folder.findById(folderId)
    if (!folder) return res.status(404).json({ message: "Folder not found" })

    const subdomain = folder.subdomains.find(
      sd => sd._id.toString() === subdomainId
    )

    const file = subdomain.files.find(
      f => f._id.toString() === fileId
    )

    const revision = file.revisions.find(
  r =>
    r._id.toString() === revisionId ||   // Mongo _id
    r.revisionId?.toString() === revisionId || // custom field
    r.timestamp?.toString() === revisionId     // fallback if stored as timestamp
)
if (!revision) {
  return res.status(404).json({
    message: "Revision not found",
    availableRevisions: file.revisions.map(r => ({
      _id: r._id,
      revisionId: r.revisionId
    }))
  })
}

    const filePath = path.resolve(revision.filePath)

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server" })
    }

    res.download(filePath)

  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}