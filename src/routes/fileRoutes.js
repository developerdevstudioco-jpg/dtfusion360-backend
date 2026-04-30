const express = require("express")
const router = express.Router()
const multer = require("multer")
const path = require("path")
const fs = require("fs")

const {
  listFiles,
  createFolder,
  createSubdomain,
  uploadFile,
  addRevision,
  downloadFile
} = require("../controllers/fileController")

// ---------------- MULTER CONFIG ----------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const { folderId, subdomainId } = req.body

      const uploadPath = path.join(
        __dirname,
        "..",
        "uploads",
        subdomainId || "general",
        folderId || "general"
      )

      fs.mkdirSync(uploadPath, { recursive: true })

      cb(null, uploadPath)
    } catch (err) {
      cb(err, null)
    }
  },

  filename: (req, file, cb) => {
    try {
      const uniqueName = Date.now() + "-" + file.originalname
      cb(null, uniqueName)
    } catch (err) {
      cb(err, null)
    }
  }
})

const upload = multer({ storage })

// ---------------- ROUTES ----------------

// POST /api/files/list
router.post("/list", listFiles)

// POST /api/files/folders
router.post("/folders", createFolder)


// POST /api/files/subdomains
router.post("/subdomains", createSubdomain)


// POST /api/files/upload
router.post("/upload", upload.single("file"), uploadFile)


// POST /api/files/revision
router.post("/revision", upload.single("file"), addRevision)

// GET /api/files/download?filePath=...
router.get("/download", downloadFile)

module.exports = router