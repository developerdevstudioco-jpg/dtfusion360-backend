const bcrypt = require("bcryptjs")
const User = require("../models/Users")

const SYSTEM_SUPERADMIN_EMAIL = "dtfusion360@dhoottransmission.com"
const SYSTEM_SUPERADMIN_PASSWORD = "Purushoth25@@"
const SYSTEM_SUPERADMIN_NAME = "DT-Fusion360 SuperAdmin"
const SYSTEM_SUPERADMIN_EMPLOYEE_CODE = "SUPERADMIN"
const SYSTEM_SUPERADMIN_EMAIL_STATUS_MESSAGE = "System SuperAdmin uses fixed bootstrap credentials."

const normalizeEmail = (value) => (
  typeof value === "string" ? value.trim().toLowerCase() : ""
)

const isSystemSuperAdminEmail = (value) => normalizeEmail(value) === SYSTEM_SUPERADMIN_EMAIL

const ensureSystemSuperAdmin = async () => {
  let user = await User.findOne({ email: SYSTEM_SUPERADMIN_EMAIL })

  if (!user) {
    const passwordHash = await bcrypt.hash(SYSTEM_SUPERADMIN_PASSWORD, 10)

    user = await User.create({
      name: SYSTEM_SUPERADMIN_NAME,
      email: SYSTEM_SUPERADMIN_EMAIL,
      employeeCode: SYSTEM_SUPERADMIN_EMPLOYEE_CODE,
      mobile: "",
      role: "SuperAdmin",
      plantIds: [],
      password: passwordHash,
      departmentIds: [],
      teams: [],
      isActive: true,
      mustChangePassword: false,
      accountEmailStatus: "skipped",
      accountEmailStatusMessage: SYSTEM_SUPERADMIN_EMAIL_STATUS_MESSAGE,
      accountEmailLastAttemptAt: null,
      accountEmailSentAt: null,
    })

    return user
  }

  let isDirty = false

  if (user.name !== SYSTEM_SUPERADMIN_NAME) {
    user.name = SYSTEM_SUPERADMIN_NAME
    isDirty = true
  }

  if (normalizeEmail(user.email) !== SYSTEM_SUPERADMIN_EMAIL) {
    user.email = SYSTEM_SUPERADMIN_EMAIL
    isDirty = true
  }

  if (user.employeeCode !== SYSTEM_SUPERADMIN_EMPLOYEE_CODE) {
    user.employeeCode = SYSTEM_SUPERADMIN_EMPLOYEE_CODE
    isDirty = true
  }

  if (user.role !== "SuperAdmin") {
    user.role = "SuperAdmin"
    isDirty = true
  }

  if (user.isActive === false) {
    user.isActive = true
    isDirty = true
  }

  if (!Array.isArray(user.plantIds)) {
    user.plantIds = []
    isDirty = true
  }

  if (!Array.isArray(user.departmentIds)) {
    user.departmentIds = []
    isDirty = true
  }

  if (!Array.isArray(user.teams)) {
    user.teams = []
    isDirty = true
  }

  if (typeof user.password !== "string" || user.password.length === 0) {
    user.password = await bcrypt.hash(SYSTEM_SUPERADMIN_PASSWORD, 10)
    isDirty = true
  }

  if (user.mustChangePassword) {
    user.mustChangePassword = false
    isDirty = true
  }

  if (user.accountEmailStatus !== "skipped") {
    user.accountEmailStatus = "skipped"
    isDirty = true
  }

  if (user.accountEmailStatusMessage !== SYSTEM_SUPERADMIN_EMAIL_STATUS_MESSAGE) {
    user.accountEmailStatusMessage = SYSTEM_SUPERADMIN_EMAIL_STATUS_MESSAGE
    isDirty = true
  }

  if (user.accountEmailLastAttemptAt !== null) {
    user.accountEmailLastAttemptAt = null
    isDirty = true
  }

  if (user.accountEmailSentAt !== null) {
    user.accountEmailSentAt = null
    isDirty = true
  }

  if (isDirty) {
    await user.save()
  }

  return user
}

module.exports = {
  SYSTEM_SUPERADMIN_EMAIL,
  SYSTEM_SUPERADMIN_PASSWORD,
  isSystemSuperAdminEmail,
  normalizeEmail,
  ensureSystemSuperAdmin,
}
