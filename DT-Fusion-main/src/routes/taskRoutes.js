const express = require("express")
const { listTasks, addTask, updateTask, deleteTask } = require("../controllers/taskController")

const router = express.Router()

router.post("/list", listTasks)
router.post("/add", addTask)
router.post("/update", updateTask)
router.post("/delete", deleteTask)

module.exports = router
