const express = require("express")
const multer = require("multer")
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const auth = require("../middleware/auth")
const controller = require("../controllers/repositoryController")
const { storageRoot } = require("../services/repositoryStorageService")

const router = express.Router()
const tempRoot = path.join(storageRoot, ".tmp")
fs.mkdirSync(tempRoot, { recursive: true })

const allowedExtensions = new Set([".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".txt", ".csv", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".dwg", ".dxf"])
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tempRoot),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: Number(process.env.REPOSITORY_MAX_FILE_SIZE || 50 * 1024 * 1024), files: 1 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase()
    if (!allowedExtensions.has(extension)) return cb(new Error("This file type is not allowed"))
    cb(null, true)
  },
})

router.use(auth)
router.get("/config", controller.config)
router.get("/folders", controller.listFolders)
router.post("/folders", controller.createFolder)
router.patch("/folders/:id", controller.updateFolder)
router.put("/folders/:id/permissions", controller.updateFolderPermissions)
router.post("/folders/:id/move", controller.moveFolder)
router.post("/folders/:id/archive", controller.archiveFolder)
router.get("/browse", controller.browse)
router.post("/documents", upload.single("file"), controller.createDocument)
router.get("/documents/:id", controller.getDocument)
router.patch("/documents/:id", controller.updateDocument)
router.post("/documents/:id/revisions", upload.single("file"), controller.addRevision)
router.post("/documents/:id/archive", controller.archiveDocument)
router.get("/documents/:id/audit", controller.auditHistory)
router.post("/revisions/:id/submit", controller.submitRevision)
router.post("/revisions/:id/file", upload.single("file"), controller.replaceDraftRevision)
router.post("/revisions/:id/decision", controller.decideRevision)
router.get("/revisions/:id/content", controller.content)
router.get("/approval-queue", controller.approvalQueue)
router.post("/favorites", controller.toggleFavorite)
router.get("/approval-rules", controller.listApprovalRules)
router.post("/approval-rules", controller.createApprovalRule)
router.delete("/approval-rules/:id", controller.archiveApprovalRule)

router.use(controller.errorHandler)
module.exports = router
