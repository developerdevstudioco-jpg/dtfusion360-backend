const express = require("express")
const router = express.Router()

const { getEvents, createEvent } = require("../controllers/eventController")

router.post('/list', getEvents);
router.post("/", createEvent)

module.exports = router