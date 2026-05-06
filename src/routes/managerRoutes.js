const express = require("express")
const router = express.Router()

const { listManagers } = require("../controllers/organizationController")

//router.post("/list", listManagers)
router.get("/list",listManagers)

module.exports = router