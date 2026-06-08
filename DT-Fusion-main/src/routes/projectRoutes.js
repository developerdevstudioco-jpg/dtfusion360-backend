const express = require("express")
const {
  listProjects,
  addProject,
  updateProject,
  requestProjectUpdate,
  requestProjectDelete,
  approveProjectRequest,
  rejectProjectRequest,
} = require("../controllers/projectController")

const router = express.Router()

router.post("/list", listProjects)
router.post("/add", addProject)
router.post("/update", updateProject)
router.post("/request-update", requestProjectUpdate)
router.post("/request-delete", requestProjectDelete)
router.post("/approve-request", approveProjectRequest)
router.post("/reject-request", rejectProjectRequest)

module.exports = router
