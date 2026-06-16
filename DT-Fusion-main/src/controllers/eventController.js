const Event = require("../models/Events")

// GET /events
exports.getEvents = async (req, res) => {
  try {
    const { employeeCode, employeeName } = req.body || {};

    let query = {};

    if (employeeCode || employeeName) {
      query = {
        $or: [
          ...(employeeCode ? [{ employeeCode }] : []),
          ...(employeeName ? [{ attendees: employeeName }] : []),
        ],
      };
    }

    const events = await Event.find(query);

    const cleanedEvents = events
      .filter(e => e && e.title && e.type && e.date)
      .map(e => ({
        id: e._id.toString(),
        title: e.title,
        type: e.type,
        date: e.date,
        startTime: e.startTime || "",
        endTime: e.endTime || "",
        location: e.location || "",
        attendees: Array.isArray(e.attendees) ? e.attendees : [],
        description: e.description || "",
        project: e.project || "",
        priority: e.priority || "medium",
        status: e.status || "active"
      }));

    return res.status(200).json(cleanedEvents);

  } catch (err) {
    console.error(err);
    return res.status(200).json([]); // never break FE
  }
};
// POST /events
exports.createEvent = async (req, res) => {
  try {
    const {
      title,
      type,
      date,
      employeeCode, // ✅ VERY IMPORTANT
      startTime,
      endTime,
      location,
      attendees,
      description,
      project,
      priority,
      status
    } = req.body;

    // basic validation
    if (!title || !type || !date) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newEvent = new Event({
      title,
      type,
      date,
      employeeCode, // ✅ SAVE THIS
      startTime: startTime || "",
      endTime: endTime || "",
      location: location || "",
      attendees: Array.isArray(attendees) ? attendees : [],
      description: description || "",
      project: project || "",
      priority: priority || "medium",
      status: status || "active"
    });

    await newEvent.save();

    return res.status(201).json({
      id: newEvent._id.toString(),
      title: newEvent.title,
      type: newEvent.type,
      date: newEvent.date,
      startTime: newEvent.startTime || "",
      endTime: newEvent.endTime || "",
      location: newEvent.location || "",
      attendees: Array.isArray(newEvent.attendees) ? newEvent.attendees : [],
      description: newEvent.description || "",
      project: newEvent.project || "",
      priority: newEvent.priority || "medium",
      status: newEvent.status || "active"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Create failed" });
  }
};
