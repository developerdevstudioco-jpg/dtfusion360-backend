const ActivityLog = require("../models/ActivityLog")
const User = require("../models/Users")
const Department = require("../models/Department")

const recordActivity = async (entry) => {
  try {
    let actor = null
    if (entry.employeeCode) {
      actor = await User.findOne({ employeeCode: entry.employeeCode }).select("_id name email employeeCode role plantIds departmentIds").lean()
    }

    const departmentIds = Array.isArray(actor?.departmentIds) ? actor.departmentIds.filter(Boolean) : []
    const departments = departmentIds.length > 0
      ? await Department.find({ id: { $in: departmentIds } }).select("name").lean()
      : []

    return await ActivityLog.create({
      ...entry,
      actorId: entry.actorId || actor?._id?.toString() || "",
      actorName: entry.actorName || actor?.name || "Unknown",
      actorEmail: entry.actorEmail || actor?.email || "",
      employeeCode: entry.employeeCode || actor?.employeeCode || "",
      actorRole: entry.actorRole || actor?.role || "",
      actorDepartment: entry.actorDepartment || departments.map(department => department.name).filter(Boolean).join(", "),
      plantId: entry.plantId || actor?.plantIds?.[0] || "",
    })
  } catch (error) {
    console.error("Activity log write failed:", error.message)
    return null
  }
}

module.exports = { recordActivity }
