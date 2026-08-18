const ActivityLog = require("../models/ActivityLog")
const User = require("../models/Users")

const recordActivity = async (entry) => {
  try {
    let actor = null
    if (entry.employeeCode) {
      actor = await User.findOne({ employeeCode: entry.employeeCode }).select("_id name email employeeCode role plantIds").lean()
    }

    return await ActivityLog.create({
      ...entry,
      actorId: entry.actorId || actor?._id?.toString() || "",
      actorName: entry.actorName || actor?.name || "Unknown",
      actorEmail: entry.actorEmail || actor?.email || "",
      employeeCode: entry.employeeCode || actor?.employeeCode || "",
      actorRole: entry.actorRole || actor?.role || "",
      plantId: entry.plantId || actor?.plantIds?.[0] || "",
    })
  } catch (error) {
    console.error("Activity log write failed:", error.message)
    return null
  }
}

module.exports = { recordActivity }
