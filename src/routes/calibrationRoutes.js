const express = require("express")
const router = express.Router()

const calibrationController = require("../controllers/calibrationController")

router.get("/", calibrationController.getCalibrations)
router.post("/", calibrationController.upsertCalibrations)
router.delete("/:id", calibrationController.deleteCalibration)

module.exports = router
