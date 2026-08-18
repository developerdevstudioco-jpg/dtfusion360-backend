const express = require("express")
const { listTasks, addTask, updateTask, deleteTask } = require("../controllers/taskController")
const auth = require("../middleware/auth")
const { PROJECT_PERMISSIONS, requireTaskPermission } = require("../utils/rbac")

const router = express.Router()

router.post("/list", listTasks)
router.post(
  "/add",
  auth,
  requireTaskPermission(PROJECT_PERMISSIONS.CREATE_TASKS, (req) => req.body?.departmentIds || req.body?.departmentId),
  addTask
)
router.post(
  "/update",
  auth,
  updateTask
)
router.post(
  "/delete",
  auth,
  deleteTask
)

module.exports = router
