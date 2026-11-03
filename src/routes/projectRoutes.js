const express = require("express")
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
} = require("../controllers/projectController")

const router = express.Router()

router.post("/list", listProjects)
router.post("/dashboard-summary", getDashboardSummary)
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

module.exports = router
