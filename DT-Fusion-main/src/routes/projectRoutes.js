const express = require("express")
const {
  listProjects,
  getDashboardSummary,
  getProject,
  addProject,
  updateProject,
  updateProjectForecast,
  requestProjectUpdate,
  requestProjectDelete,
  approveProjectRequest,
  rejectProjectRequest,
} = require("../controllers/projectController")

const router = express.Router()

router.post("/list", listProjects)
router.post("/dashboard-summary", getDashboardSummary)
router.get("/:id", getProject)
router.post("/add", addProject)
router.post("/forecast", updateProjectForecast)
router.post("/update", updateProject)
router.post("/request-update", requestProjectUpdate)
router.post("/request-delete", requestProjectDelete)
router.post("/approve-request", approveProjectRequest)
router.post("/reject-request", rejectProjectRequest)

module.exports = router
