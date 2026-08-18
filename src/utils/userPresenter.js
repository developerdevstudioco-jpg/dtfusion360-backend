const Department = require("../models/Department")
const Plant = require("../models/Plant")

const normalizeStringArray = (value) => {
  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return [value]
  }

  return []
}

const presentUser = async (userDoc) => {
  if (!userDoc) {
    return null
  }

  const user = typeof userDoc.toJSON === "function" ? userDoc.toJSON() : { ...userDoc }
  const departmentIds = normalizeStringArray(user.departmentIds)
  const plantIds = normalizeStringArray(user.plantIds)

  const [departments, plants] = await Promise.all([
    departmentIds.length > 0
      ? Department.find({ id: { $in: departmentIds } }).select("name id")
      : Promise.resolve([]),
    plantIds.length > 0
      ? Plant.find({ id: { $in: plantIds } }).select("name id")
      : Promise.resolve([]),
  ])

  return {
    ...user,
    department: departments.length > 0 ? departments.map((department) => department.name) : normalizeStringArray(user.department),
    plant: plants.length > 0 ? plants.map((plant) => plant.name) : normalizeStringArray(user.plant),
    status: user.isActive === false ? "Inactive" : "Active",
    mustChangePassword: Boolean(user.mustChangePassword),
  }
}

module.exports = {
  presentUser,
}
