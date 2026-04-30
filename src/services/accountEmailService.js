const { generateAccountCreationEmail } = require("../utils/accountCreationTemplate")

const parseBoolean = (value) => {
  if (typeof value !== "string") {
    return false
  }

  return ["true", "1", "yes"].includes(value.trim().toLowerCase())
}

const normalizeSecret = (value) => {
  if (typeof value !== "string") {
    return ""
  }

  return value.replace(/\s+/g, "").trim()
}

const getTransporter = () => {
  let nodemailer

  try {
    nodemailer = require("nodemailer")
  } catch (error) {
    return {
      transporter: null,
      reason: "nodemailer is not installed",
    }
  }

  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = typeof process.env.SMTP_USER === "string" ? process.env.SMTP_USER.trim() : ""
  const pass = normalizeSecret(process.env.SMTP_PASS)

  if (!host || !user || !pass) {
    return {
      transporter: null,
      reason: "SMTP environment variables are not configured",
    }
  }

  const secure = process.env.SMTP_SECURE
    ? parseBoolean(process.env.SMTP_SECURE)
    : port === 465

  const isGmail = host?.includes("gmail.com") || user?.endsWith("@gmail.com")
  const transportOptions = {
    auth: {
      user,
      pass,
    },
  }

  if (isGmail) {
    if (pass.length !== 16) {
      return {
        transporter: null,
        reason: "Gmail app password must be 16 characters long. Verify SMTP_PASS is a correct app password.",
      }
    }

    transportOptions.service = "gmail"
    transportOptions.secure = true
  } else {
    transportOptions.host = host
    transportOptions.port = port
    transportOptions.secure = secure
  }

  return {
    transporter: nodemailer.createTransport(transportOptions),
    reason: null,
  }
}

const sendAccountCreationEmail = async ({ to, username, password }) => {
  const { transporter, reason } = getTransporter()

  if (!transporter) {
    return {
      sent: false,
      skipped: true,
      reason,
    }
  }

  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER
  const fromName = process.env.SMTP_FROM_NAME || "DT-Fusion360"
  const loginUrl = process.env.APP_LOGIN_URL || "https://dtfusion360.vercel.app/#/login"
  const baseUrl = process.env.APP_BASE_URL || "http://dtfusion360.vercel.app"
  const logoUrl = process.env.ACCOUNT_EMAIL_LOGO_URL || `${baseUrl}/logo.png`

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: "Your DT-Fusion360 account is ready",
      html: generateAccountCreationEmail({
        username,
        password,
        loginUrl,
        logoUrl,
      }),
    })

    return {
      sent: true,
      skipped: false,
      messageId: info.messageId,
      accepted: info.accepted,
    }
  } catch (error) {
    console.error("Account creation email failed:", error)
    const reason =
      error?.code === "EAUTH"
        ? "SMTP authentication failed. With Gmail, use a valid app password and ensure SMTP access is enabled."
        : error?.message || "Unknown email delivery error"

    return {
      sent: false,
      skipped: false,
      reason,
    }
  }
}

module.exports = {
  sendAccountCreationEmail,
}
