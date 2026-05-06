const { generateAccountCreationEmail } = require("../utils/accountCreationTemplate")

const DEFAULT_LOCAL_APP_BASE_URL = "http://localhost:8080"
const DEFAULT_PRODUCTION_APP_BASE_URL = "https://dtfusion360-backend.onrender.com"

const DEFAULT_LOCAL_LOGIN_URL = "http://localhost:3000/#/login"
const DEFAULT_PRODUCTION_LOGIN_URL = "https://dtfusion360.vercel.app"

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

const isProductionEnvironment = () =>
  process.env.NODE_ENV === "production"

<<<<<<< HEAD
const isRenderEnvironment = () =>
  parseBoolean(process.env.RENDER) ||
  typeof process.env.RENDER_EXTERNAL_URL === "string"

const getDefaultBaseUrl = () =>
  isProductionEnvironment()
    ? process.env.RENDER_EXTERNAL_URL || DEFAULT_PRODUCTION_APP_BASE_URL
=======
const getDefaultBaseUrl = () =>
  isProductionEnvironment()
    ? DEFAULT_PRODUCTION_APP_BASE_URL
>>>>>>> 548bdac4f7ac69ca3ad1087ab8c4916ad24c8066
    : DEFAULT_LOCAL_APP_BASE_URL

const getDefaultLoginUrl = () =>
  isProductionEnvironment()
    ? DEFAULT_PRODUCTION_LOGIN_URL
    : DEFAULT_LOCAL_LOGIN_URL

<<<<<<< HEAD
const getEmailFailureReason = (error) => {
  if (error?.code === "EAUTH") {
    return "SMTP authentication failed. With Gmail, use a valid app password and ensure SMTP access is enabled."
  }

  if (error?.code === "ETIMEDOUT") {
    if (isRenderEnvironment()) {
      return "SMTP connection timed out on Render. Free Render web services block outbound SMTP traffic on ports 25, 465, and 587. Use an email API provider or move to a supported non-SMTP setup."
    }

    return "SMTP connection timed out. Check hosting/network restrictions or email provider latency."
  }

  if (["ECONNREFUSED", "ESOCKET", "ECONNRESET"].includes(error?.code)) {
    if (isRenderEnvironment()) {
      return "SMTP connection was rejected on Render. Render commonly blocks direct SMTP on ports 25, 465, and 587, so use an email API provider for production delivery."
    }
  }

  return error?.message || "Unknown email delivery error"
}

=======
>>>>>>> 548bdac4f7ac69ca3ad1087ab8c4916ad24c8066
const getTransporter = async () => {
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

  const user =
    typeof process.env.SMTP_USER === "string"
      ? process.env.SMTP_USER.trim()
      : ""

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

  const isGmail =
    host?.includes("gmail.com") ||
    user?.endsWith("@gmail.com")

  const transportOptions = {
    auth: {
      user,
      pass,
    },

    // Increased timeout settings
    connectionTimeout: 60000,
    greetingTimeout: 60000,
    socketTimeout: 60000,
  }

  if (isGmail) {
    if (pass.length !== 16) {
      return {
        transporter: null,
        reason:
          "Gmail app password must be 16 characters long. Verify SMTP_PASS is a correct app password.",
      }
    }

    // Explicit Gmail SMTP configuration
    transportOptions.host = "smtp.gmail.com"
    transportOptions.port = 465
    transportOptions.secure = true
  } else {
    transportOptions.host = host
    transportOptions.port = port
    transportOptions.secure = secure
  }

  try {
    const transporter = nodemailer.createTransport(transportOptions)

    // Verify SMTP connection before sending emails
    await transporter.verify()

    console.log("SMTP server is ready to send emails")

    return {
      transporter,
      reason: null,
    }
  } catch (error) {
    console.error("SMTP transporter verification failed:", error)

    return {
      transporter: null,
<<<<<<< HEAD
      reason: getEmailFailureReason(error),
=======
      reason:
        error?.message || "Failed to verify SMTP transporter",
>>>>>>> 548bdac4f7ac69ca3ad1087ab8c4916ad24c8066
    }
  }
}

const sendAccountCreationEmail = async ({
  to,
  name,
  username,
  password,
}) => {
  const { transporter, reason } = await getTransporter()

  if (!transporter) {
    return {
      sent: false,
      skipped: true,
      reason,
    }
  }

  const fromEmail =
    process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER

  const fromName =
    process.env.SMTP_FROM_NAME || "DT-Fusion360"

  const loginUrl =
    process.env.APP_LOGIN_URL || getDefaultLoginUrl()

  const baseUrl =
    process.env.APP_BASE_URL || getDefaultBaseUrl()

  const logoUrl =
    process.env.ACCOUNT_EMAIL_LOGO_URL ||
    `${baseUrl}/logo.png`

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: "Your DT-Fusion360 account is ready",

      html: generateAccountCreationEmail({
        name,
        username,
        password,
        loginUrl,
        logoUrl,
      }),
    })

    console.log("Account creation email sent:", info.messageId)

    return {
      sent: true,
      skipped: false,
      messageId: info.messageId,
      accepted: info.accepted,
    }
  } catch (error) {
    console.error("Account creation email failed:", error)
<<<<<<< HEAD
=======

    let reason =
      error?.message || "Unknown email delivery error"

    if (error?.code === "EAUTH") {
      reason =
        "SMTP authentication failed. With Gmail, use a valid app password and ensure SMTP access is enabled."
    }

    if (error?.code === "ETIMEDOUT") {
      reason =
        "SMTP connection timed out. Check hosting/network restrictions or email provider latency."
    }
>>>>>>> 548bdac4f7ac69ca3ad1087ab8c4916ad24c8066

    return {
      sent: false,
      skipped: false,
      reason: getEmailFailureReason(error),
    }
  }
}

module.exports = {
<<<<<<< HEAD
  getEmailFailureReason,
=======
>>>>>>> 548bdac4f7ac69ca3ad1087ab8c4916ad24c8066
  getDefaultBaseUrl,
  getDefaultLoginUrl,
  getTransporter,
  sendAccountCreationEmail,
}
