const express = require("express")
const multer = require("multer")
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const { storageRoot } = require("../services/repositoryStorageService")
const {
  listProjects,
  getDashboardSummary,
  getProject,
  addProject,
  updateProject,
  addCftMember,
  replaceCftMember,
  updateProjectForecast,
  requestProjectUpdate,
  requestProjectDelete,
  approveProjectRequest,
  restoreProject,
  rejectProjectRequest,
  uploadProjectFile,
  getProjectFileContent,
  deleteProjectFile,
} = require("../controllers/projectController")

const router = express.Router()
const projectTempRoot = path.join(storageRoot, ".project-tmp")
fs.mkdirSync(projectTempRoot, { recursive: true })
const allowedProjectExtensions = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".txt", ".csv", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".dwg", ".dxf", ".step", ".stp"])
const projectUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, projectTempRoot),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: Number(process.env.PROJECT_MAX_FILE_SIZE || 50 * 1024 * 1024), files: 1 },
  fileFilter: (_req, file, cb) => allowedProjectExtensions.has(path.extname(file.originalname).toLowerCase())
    ? cb(null, true)
    : cb(new Error("This project file type is not allowed")),
})

router.post("/list", listProjects)
router.post("/dashboard-summary", getDashboardSummary)
router.post("/:id/files", projectUpload.single("file"), uploadProjectFile)
router.get("/:id/files/:fileId/content", getProjectFileContent)
router.delete("/:id/files/:fileId", deleteProjectFile)
router.get("/:id", getProject)
router.post("/add", addProject)
router.post("/forecast", updateProjectForecast)
router.post("/update", updateProject)
router.post("/:id/cft/add", addCftMember)
router.post("/:id/cft/replace", replaceCftMember)
router.post("/request-update", requestProjectUpdate)
router.post("/request-delete", requestProjectDelete)
router.post("/approve-request", approveProjectRequest)
router.post("/reject-request", rejectProjectRequest)
router.post("/:id/restore", restoreProject)

router.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    const limitMb = Math.round(Number(process.env.PROJECT_MAX_FILE_SIZE || 50 * 1024 * 1024) / 1024 / 1024)
    return res.status(413).json({ message: `File exceeds the ${limitMb} MB project attachment limit` })
  }
  return res.status(400).json({ message: error?.message || "Project attachment upload failed" })
})

module.exports = router
