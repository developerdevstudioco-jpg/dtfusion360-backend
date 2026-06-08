const express = require("express")
const router = express.Router()

const calibrationController = require("../controllers/calibrationController")

// GET → Fetch all calibrations
router.get("/", calibrationController.getCalibrations)

// POST → Add / Update (UPSERT)
router.post("/", calibrationController.upsertCalibrations)

module.exports = router