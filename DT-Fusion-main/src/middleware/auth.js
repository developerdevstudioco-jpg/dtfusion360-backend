const User = require("../models/Users")

module.exports = async (req, res, next) => {
  try {
    console.log("\n====== AUTH START ======")

    // 🔍 LOG HEADERS
    console.log("Headers:", req.headers)

    // 🔥 READ USER FROM HEADER
    let employeeCode = req.headers["x-user"]

    // 🔍 DEBUG
    console.log("Received x-user:", employeeCode)

    // 🔥 OPTIONAL FALLBACK (ONLY FOR DEV)
    if (!employeeCode) {
      console.warn("⚠️ No x-user header provided")

      // 👉 TEMP ONLY (remove in production)
      employeeCode = "dmtu1"
      console.warn("⚠️ Falling back to:", employeeCode)
    }

    // 🔍 FIND USER
    const user = await User.findOne({ employeeCode }).lean()

    console.log("User lookup result:", user)

    if (!user) {
      console.error("❌ User not found for:", employeeCode)
      return res.status(401).json({ message: "User not found" })
    }

    // 🔥 ATTACH USER
    req.user = {
      employeeCode: user.employeeCode,
      name: user.name
    }

    console.log("✅ AUTH SUCCESS:", req.user)
    console.log("====== AUTH END ======\n")

    next()

  } catch (err) {
    console.error("❌ AUTH ERROR:", err)
    return res.status(500).json({ message: "Auth failed" })
  }
}