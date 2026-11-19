const express = require("express")
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const { randomUUID } = require("crypto")
const auth = require("../middleware/auth")
const controller = require("../controllers/chatController")

const router = express.Router()
const uploadRoot = path.resolve(__dirname, "../../storage/chat")
fs.mkdirSync(uploadRoot, { recursive: true })

const allowedExtensions = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv", ".png", ".jpg", ".jpeg", ".webp", ".zip", ".dxf", ".step", ".stp", ".iges", ".igs"])
const blockedExtensions = new Set([".exe", ".bat", ".cmd", ".ps1", ".scr", ".msi", ".com", ".js", ".vbs", ".jar"])

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadRoot),
    filename: (_req, file, callback) => callback(null, `${Date.now()}-${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase()
    if (blockedExtensions.has(extension) || !allowedExtensions.has(extension)) return callback(new Error("This file type is not allowed"))
    callback(null, true)
  },
})

router.use(auth)
router.get("/contacts", controller.getContacts)
router.get("/users", controller.getUsers)
router.post("/conversations", controller.createConversation)
router.patch("/conversations/:conversationId", controller.updateConversation)
router.post("/conversations/:conversationId/members", controller.addMember)
router.delete("/conversations/:conversationId/members/:userId", controller.removeMember)
router.patch("/conversations/:conversationId/members/:userId/role", controller.changeMemberRole)
router.get("/messages/:conversationId", controller.getMessages)
router.post("/messages/:conversationId", controller.createMessage)
router.patch("/messages/:messageId", controller.editMessage)
router.delete("/messages/:messageId", controller.deleteMessage)
router.post("/messages/:messageId/reactions", controller.toggleReaction)
router.post("/messages/:messageId/pin", controller.togglePin)
router.post("/messages/:messageId/star", controller.toggleStar)
router.post("/conversations/:conversationId/read", controller.markRead)
router.patch("/conversations/:conversationId/preferences", controller.updatePreferences)
router.get("/conversations/:conversationId/audit", controller.getAuditLog)
router.get("/search", controller.searchMessages)
router.get("/notifications", controller.getNotifications)
router.post("/media", upload.array("files", 10), controller.uploadMedia)
router.get("/attachments/:attachmentId/download", controller.downloadAttachment)

router.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "Attachments must be 100 MB or smaller" })
  if (error) return res.status(400).json({ message: error.message || "Attachment upload failed" })
  res.status(500).json({ message: "Unexpected messaging error" })
})

module.exports = router
