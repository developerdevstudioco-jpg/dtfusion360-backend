const RepositoryAudit = require("../models/RepositoryAudit")

async function audit(req, action, refs = {}, details = {}, session = null) {
  const entry = {
    ...refs,
    action,
    actorId: req.user.id,
    actorName: req.user.name || req.user.employeeCode,
    employeeCode: req.user.employeeCode || "",
    details,
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  }
  const docs = await RepositoryAudit.create([entry], session ? { session } : undefined)
  return docs[0]
}

module.exports = { audit }
