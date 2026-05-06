const mongoose = require("mongoose")

const EventSchema = new mongoose.Schema({
  title: String,
  type: String,
  date: String,
  startTime: String,
  endTime: String,
  location: String,
  attendees: [String],
  description: String,
  project: String,
  priority: String,
  status: { type: String, default: "active" }
})

// map _id → id
EventSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
  }
})

module.exports = mongoose.model("Event", EventSchema)