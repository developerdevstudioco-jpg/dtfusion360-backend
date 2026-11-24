const { recordActivity } = require("../services/activityLogService")

const classifyPath = (path) => {
  if (path.includes("/projects") || path.includes("/tasks")) return { type: "project", category: "Project & Task" }
  if (path.includes("/users")) return { type: "governance", category: "User Management" }
  if (path.includes("/rbac")) return { type: "governance", category: "Access Control" }
  if (path.includes("/organization")) return { type: "governance", category: "Organization" }
  if (path.includes("/files")) return { type: "governance", category: "File Governance" }
  if (path.includes("/calibrations")) return { type: "governance", category: "Calibration" }
  if (path.includes("/moms") || path.includes("/events")) return { type: "project", category: "Calendar & MoM" }
  return { type: "system", category: "System" }
}

module.exports = (req, res, next) => {
  const method = req.method.toUpperCase()
  const path = req.originalUrl.split("?")[0]
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method) || path.startsWith("/api/logs") || path === "/api/auth/login") {
    return next()
  }

  res.on("finish", () => {
    const classification = classifyPath(path)
    const success = res.statusCode < 400
    void recordActivity({
      ...classification,
      action: `${method} ${path}`,
      employeeCode: req.user?.employeeCode || req.headers["x-user"] || "",
      actorName: req.user?.name || "",
      actorRole: req.user?.role || "",
      target: String(req.params?.id || req.body?.id || req.body?.name || req.body?.projectId || ""),
      details: success ? "Request completed" : `Request failed with HTTP ${res.statusCode}`,
      status: success ? "Success" : "Failed",
      severity: success ? "Success" : "Danger",
      ipAddress: req.ip || req.socket?.remoteAddress || "",
      userAgent: req.headers["user-agent"] || "",
      method,
      path,
      statusCode: res.statusCode,
      plantId: req.body?.plantId || req.user?.plantIds?.[0] || "",
      projectId: req.body?.projectId || req.params?.projectId || "",
    })
  })

  next()
}
