const ActivityLog = require("../models/ActivityLog")

exports.listActivityLogs = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.body?.page) || 1)
    const pageSize = Math.min(100, Math.max(10, Number(req.body?.pageSize) || 50))
    const { type, status, search, dateFrom, dateTo } = req.body || {}
    const query = {}

    if (type && type !== "all") query.type = type
    if (status && status !== "all") query.status = status
    if (dateFrom || dateTo) {
      query.createdAt = {}
      if (dateFrom) query.createdAt.$gte = new Date(`${dateFrom}T00:00:00.000Z`)
      if (dateTo) query.createdAt.$lte = new Date(`${dateTo}T23:59:59.999Z`)
    }
    if (search) {
      const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const expression = new RegExp(escaped, "i")
      query.$or = ["actorName", "actorEmail", "employeeCode", "category", "action", "target", "details"].map(field => ({ [field]: expression }))
    }

    const normalizedRole = String(req.user.role || "").replace(/[\s._-]/g, "").toLowerCase()
    if (normalizedRole === "plantadmin") {
      const plantIds = Array.isArray(req.user.plantIds) ? req.user.plantIds.filter(Boolean) : []
      query.plantId = { $in: plantIds }
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(query).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      ActivityLog.countDocuments(query),
    ])

    res.json({
      logs: logs.map(log => ({ ...log, id: log._id.toString(), _id: undefined })),
      total,
      page,
      pageSize,
    })
  } catch (error) {
    res.status(500).json({ message: "Failed to load activity logs" })
  }
}
