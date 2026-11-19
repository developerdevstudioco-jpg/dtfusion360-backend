const express = require("express")
const adminAuth = require("../middleware/adminAuth")
const { listActivityLogs } = require("../controllers/activityLogController")

const router = express.Router()
router.post("/audit/list", adminAuth, listActivityLogs)

module.exports = router
