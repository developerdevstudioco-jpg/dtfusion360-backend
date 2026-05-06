const Event = require("../models/Events")

// GET /events
exports.getEvents = async (req, res) => {
  try {
    const events = await Event.find()
    res.json(events)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /events
exports.createEvent = async (req, res) => {
  try {

    const event = await Event.create(req.body)

    res.json(event)

  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}