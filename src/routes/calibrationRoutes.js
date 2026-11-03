const express = require("express")
const router = express.Router()

const calibrationController = require("../controllers/calibrationController")

// GET → Fetch all calibrations
router.get("/", calibrationController.getCalibrations)

// POST → Add / Update (UPSERT)
router.post("/", calibrationController.upsertCalibrations)

// DELETE -> Remove one calibration record
router.delete("/:id", calibrationController.deleteCalibration)

module.exports = router
