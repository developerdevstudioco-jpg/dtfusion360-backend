const express = require("express")
const router = express.Router()

const { listManagers } = require("../controllers/organizationController")

router.get("/list", listManagers) // ✅ only GET

module.exports = router