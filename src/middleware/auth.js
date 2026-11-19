const User = require("../models/Users")
const jwt = require("jsonwebtoken")

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" })
    }

    let decoded
    try {
      decoded = jwt.verify(authHeader.substring(7), process.env.JWT_SECRET || "secretkey")
    } catch {
      return res.status(401).json({ message: "Invalid token" })
    }

    const user = await User.findById(decoded.id).lean()

    if (!user) {
      return res.status(401).json({ message: "User not found" })
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: "User is inactive" })
    }

    req.user = {
      id: user._id.toString(),
      employeeCode: user.employeeCode,
      name: user.name,
      role: user.role,
      department: user.department || user.departments || [],
      departmentIds: Array.isArray(user.departmentIds) ? user.departmentIds : [],
      plantIds: Array.isArray(user.plantIds) ? user.plantIds : []
    }

    next()
  } catch (err) {
    console.error("Auth error:", err.message)
    return res.status(500).json({ message: "Auth failed" })
  }
}
