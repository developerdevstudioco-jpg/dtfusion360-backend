const jwt = require("jsonwebtoken")
const User = require("../models/Users")

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || ""
    if (!authHeader.startsWith("Bearer ")) return res.status(401).json({ message: "Authentication required" })

    const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET || "secretkey")
    const user = await User.findById(decoded.id).lean()
    if (!user || user.isActive === false) return res.status(401).json({ message: "User not found or inactive" })

    const role = String(user.role || "").replace(/[\s._-]/g, "").toLowerCase()
    if (!['superadmin', 'plantadmin'].includes(role)) return res.status(403).json({ message: "Administrator access required" })

    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired session" })
  }
}
