const DEFAULT_LOCAL_APP_BASE_URL = "http://localhost:8080"
const DEFAULT_PRODUCTION_APP_BASE_URL = "https://dtfusion360-backend.onrender.com"

const DEFAULT_LOCAL_LOGIN_URL = "http://localhost:3000/#/login"
const DEFAULT_PRODUCTION_LOGIN_URL = "https://dtfusion360.vercel.app/#/login"
const DEFAULT_SMTP_TIMEOUT_MS = 15000
const RENDER_BLOCKED_SMTP_PORTS = new Set([25, 465, 587])

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

const parsePositiveInteger = (value, fallback) => {
  const parsedValue = Number(value)

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback
  }

  return Math.floor(parsedValue)
}

const isProductionEnvironment = () =>
  process.env.NODE_ENV === "production"

const isRenderEnvironment = () =>
  parseBoolean(process.env.RENDER) ||
  typeof process.env.RENDER_EXTERNAL_URL === "string"

const shouldBlockDirectSmtpOnRender = (port) =>
  isRenderEnvironment() && RENDER_BLOCKED_SMTP_PORTS.has(Number(port))

const shouldVerifyTransporter = () =>
  parseBoolean(process.env.SMTP_VERIFY)

const getSmtpTimeoutMs = () =>
  parsePositiveInteger(process.env.SMTP_TIMEOUT_MS, DEFAULT_SMTP_TIMEOUT_MS)

const getDefaultBaseUrl = () =>
  isProductionEnvironment()
    ? process.env.RENDER_EXTERNAL_URL || DEFAULT_PRODUCTION_APP_BASE_URL
    : DEFAULT_LOCAL_APP_BASE_URL

const getDefaultLoginUrl = () =>
  isProductionEnvironment()
    ? DEFAULT_PRODUCTION_LOGIN_URL
    : DEFAULT_LOCAL_LOGIN_URL

const escapeHtml = (value) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;")

const getValue = (value, placeholder) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return placeholder
  }

  return value.trim()
}

// Brand color red
const BRAND_PRIMARY = "#ed1c24"
const BRAND_LIGHT = "#f4a4aa"
const BRAND_LIGHTER = "#fae9eb"

const generateAccountCreationEmail = ({
  name,
  username,
  password,
  loginUrl,
  logoUrl,
}) => {
  const safeName = escapeHtml(getValue(name, "User"))
  const safeUsername = escapeHtml(getValue(username, "{{username}}"))
  const safePassword = escapeHtml(getValue(password, "{{password}}"))
  const safeLoginUrl = getValue(loginUrl, "{{login_url}}")
  const safeLogoUrl = getValue(logoUrl, "{{logo_url}}")
  const currentYear = new Date().getFullYear()

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to DT-Fusion360</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f6fa;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;background-color:#f4f6fa;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:640px;border-collapse:collapse;">
            <tr>
              <td style="padding:24px 0; text-align:center;">
                <img src="${escapeHtml(safeLogoUrl)}" alt="DT-Fusion360" width="120" style="display:inline-block;max-width:120px;width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,0.12);">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td style="background:linear-gradient(135deg,${BRAND_PRIMARY} 0%,#d41019 50%,#f54c54 100%);padding:36px 32px;text-align:center;color:#ffffff;">
                      <h1 style="margin:0;font-size:32px;line-height:40px;font-weight:800;">Welcome aboard, ${safeName}!</h1>
                      <p style="margin:16px 0 0;font-size:16px;line-height:24px;max-width:520px;margin-left:auto;margin-right:auto;">Your DT-Fusion360 workspace has been created. Use the details below to access your account.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:32px 32px 24px 32px;">
                      <p style="margin:0 0 20px;font-size:16px;line-height:26px;color:#344054;">Here are your initial login details. For security, change your password after your first login.</p>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;background:#f8fafc;">
                        <tr>
                          <td style="padding:20px 24px;font-size:14px;line-height:22px;color:#667085;font-weight:700;border-bottom:1px solid #e5e7eb;">Username</td>
                          <td style="padding:20px 24px;font-size:14px;line-height:22px;color:#0f172a;">${safeUsername}</td>
                        </tr>
                        <tr>
                          <td style="padding:20px 24px;font-size:14px;line-height:22px;color:#667085;font-weight:700;border-bottom:1px solid #e5e7eb;">Temporary Password</td>
                          <td style="padding:20px 24px;font-size:14px;line-height:22px;color:#0f172a;">${safePassword}</td>
                        </tr>
                        <tr>
                          <td style="padding:20px 24px;font-size:14px;line-height:22px;color:#667085;font-weight:700;">Login URL</td>
                          <td style="padding:20px 24px;font-size:14px;line-height:22px;color:#0f172a;"><a href="${escapeHtml(safeLoginUrl)}" style="color:${BRAND_PRIMARY};text-decoration:none;word-break:break-all;">${escapeHtml(safeLoginUrl)}</a></td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 32px 32px 32px;">
                      <a href="${escapeHtml(safeLoginUrl)}" style="display:inline-flex;align-items:center;justify-content:center;width:100%;max-width:260px;padding:14px 24px;border-radius:999px;background-color:${BRAND_PRIMARY};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">Go to Login</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 32px 32px 32px;">
                      <p style="margin:0;font-size:14px;line-height:22px;color:#475569;">If you need help, reply to this email or contact your DT-Fusion360 administrator.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 32px 32px 32px;border-top:1px solid #e5e7eb;">
                      <p style="margin:0;font-size:12px;line-height:20px;color:#98a2b3;">If you did not request this account, please ignore this message or contact support.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:24px 32px 32px 32px;background:#f8fafc;font-size:12px;line-height:18px;color:#94a3b8;text-align:center;">
                      &copy; ${currentYear} DT-Fusion360. All rights reserved.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

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

const withTimeout = (promise, timeoutMs, timeoutMessage) =>
  new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const timeoutError = new Error(timeoutMessage)
      timeoutError.code = "ETIMEDOUT"
      reject(timeoutError)
    }, timeoutMs)

    promise
      .then((value) => {
        clearTimeout(timeoutId)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timeoutId)
        reject(error)
      })
  })

const sendMailWithTimeout = (transporter, message, timeoutMessage) =>
  withTimeout(
    transporter.sendMail(message),
    getSmtpTimeoutMs(),
    timeoutMessage || "Email sending timed out before the SMTP server responded.",
  )

const closeTransporter = (transporter) => {
  if (typeof transporter?.close === "function") {
    transporter.close()
  }
}

const getResendApiKey = () => {
  const explicitKey = typeof process.env.RESEND_API_KEY === 'string' ? process.env.RESEND_API_KEY.trim() : ''
  const smtpKey = typeof process.env.SMTP_PASS === 'string' && process.env.SMTP_PASS.startsWith('re_')
    ? process.env.SMTP_PASS.trim()
    : ''

  return explicitKey || smtpKey
}

const getEmailAddress = (address) => {
  if (typeof address !== 'string' || !address.trim()) {
    return ''
  }

  const match = address.match(/<([^>]+)>/) || address.match(/([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)/)
  return match ? match[1] || match[0] : ''
}

const isEmail = (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

// --- Resend send implementation + global queue and retry logic ---

// Perform the actual HTTP call to Resend
const sendResendEmailImmediate = async (message) => {
  const apiKey = getResendApiKey()
  if (!apiKey) {
    const err = new Error('Resend API key is not configured')
    err.code = 'NO_API_KEY'
    throw err
  }

  const from = getResendFromEmail()
  if (!from) {
    const err = new Error('Resend sender address is not configured. Set RESEND_FROM_EMAIL or SMTP_FROM_EMAIL to a verified email address.')
    err.code = 'NO_FROM'
    throw err
  }

  const payload = {
    from,
    reply_to: getEmailAddress(message.from) || from,
    to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
    subject: message.subject,
    html: message.html,
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text()
    let errorMsg = `Resend API error: ${response.status} ${response.statusText}`
    try {
      const errorJson = JSON.parse(body)
      if (errorJson.message) {
        errorMsg = `${errorMsg} - ${errorJson.message}`
      }
    } catch (parseErr) {
      errorMsg = `${errorMsg} - ${body}`
    }

    const error = new Error(errorMsg)
    // attach status so callers can detect 429
    error.code = response.status
    // try include Retry-After header for 429 handling
    try {
      const ra = response.headers.get('Retry-After')
      if (ra) {
        error.retryAfter = ra
      }
    } catch (e) {
      // ignore
    }
    throw error
  }

  return response.json()
}

// Queue implementation: global FIFO queue processed at 1 email/sec
const emailQueue = []
let emailQueueProcessing = false

const DEFAULT_RETRY_ATTEMPTS = 5
const DEFAULT_RETRY_BASE_MS = 1000 // base backoff

const isRetryableError = (err) => {
  if (!err) return false
  const code = err.code
  if (code === 429 || code === '429') return true
  if (code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ECONNREFUSED' || code === 'ESOCKET') return true
  return false
}

const waitMs = (ms) => new Promise((res) => setTimeout(res, ms))

const sendWithRetries = async (message, attempts = DEFAULT_RETRY_ATTEMPTS) => {
  let attempt = 0
  while (attempt < attempts) {
    try {
      return await sendResendEmailImmediate(message)
    } catch (err) {
      attempt += 1
      if (!isRetryableError(err) || attempt >= attempts) {
        throw err
      }

      // If 429 and Retry-After provided, honor it
      if ((err.code === 429 || err.code === '429') && err.retryAfter) {
        const ra = String(err.retryAfter).trim()
        let wait = parseInt(ra, 10)
        if (Number.isNaN(wait)) {
          // could be HTTP-date; fallback to base
          wait = Math.ceil(DEFAULT_RETRY_BASE_MS / 1000)
        }
        // Retry-After is in seconds
        await waitMs((wait + 0.5) * 1000)
      } else {
        // exponential backoff with jitter
        const backoff = DEFAULT_RETRY_BASE_MS * Math.pow(2, attempt - 1)
        const jitter = Math.floor(Math.random() * 300)
        await waitMs(backoff + jitter)
      }
    }
  }
}

const processEmailQueue = async () => {
  if (emailQueueProcessing) return
  if (emailQueue.length === 0) return
  emailQueueProcessing = true

  const item = emailQueue.shift()
  try {
    const result = await sendWithRetries(item.message)
    item.resolve(result)
  } catch (err) {
    item.reject(err)
  }

  // Wait 1 second before processing next to respect 1 email/sec
  setTimeout(() => {
    emailQueueProcessing = false
    // process next if exists
    if (emailQueue.length > 0) processEmailQueue()
  }, 1000)
}

// Public queued sendResendEmail matches original signature but enqueues
const sendResendEmail = (message) => {
  return new Promise((resolve, reject) => {
    emailQueue.push({ message, resolve, reject })
    // if not processing, start immediately (first item should be sent right away)
    if (!emailQueueProcessing) processEmailQueue()
  })
}

const getResendFromEmail = () => {
  const explicit = typeof process.env.RESEND_FROM_EMAIL === 'string' ? process.env.RESEND_FROM_EMAIL.trim() : ''
  if (explicit) {
    return explicit
  }

  const fromEmail = typeof process.env.SMTP_FROM_EMAIL === 'string' ? process.env.SMTP_FROM_EMAIL.trim() : ''
  const fromName = process.env.SMTP_FROM_NAME || 'DT-Fusion360'

  if (isEmail(fromEmail)) {
    return `"${fromName}" <${fromEmail}>`
  }

  const smtpUser = typeof process.env.SMTP_USER === 'string' ? process.env.SMTP_USER.trim() : ''
  if (isEmail(smtpUser) && smtpUser.toLowerCase() !== 'apikey') {
    return `"${fromName}" <${smtpUser}>`
  }

  // Fallback to Resend test domain only when no verified sender is configured.
  return 'onboarding@resend.dev'
}

const createResendTransporter = async () => {
  const apiKey = getResendApiKey()
  if (!apiKey) {
    return {
      transporter: null,
      reason: null,
    }
  }

  const transporter = {
    sendMail: async (message) => {
      return sendResendEmail(message)
    },
    close: () => {},
  }

  return {
    transporter,
    reason: null,
  }
}

const getTransporter = async () => {
  const resendApiKey = getResendApiKey()
  if (resendApiKey) {
    return createResendTransporter()
  }

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

  const resolvedPort = isGmail ? 465 : port

  if (shouldBlockDirectSmtpOnRender(resolvedPort)) {
    return {
      transporter: null,
      reason:
        "SMTP connection is blocked on Render for ports 25, 465, and 587. Use an email API provider or a mail relay supported by Render for production delivery.",
    }
  }

  const smtpTimeoutMs = getSmtpTimeoutMs()

  const transportOptions = {
    auth: {
      user,
      pass,
    },

    connectionTimeout: smtpTimeoutMs,
    greetingTimeout: smtpTimeoutMs,
    socketTimeout: smtpTimeoutMs,
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

    if (shouldVerifyTransporter() && typeof transporter.verify === 'function') {
      await transporter.verify()
      console.log("SMTP server is ready to send emails")
    }

    return {
      transporter,
      reason: null,
    }
  } catch (error) {
    console.error("SMTP transporter verification failed:", error)

    return {
      transporter: null,
      reason: getEmailFailureReason(error),
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
    const info = await sendMailWithTimeout(
      transporter,
      {
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
      },
      "Email sending timed out before the SMTP server responded.",
    )

    console.log("Account creation email sent:", info.messageId)

    return {
      sent: true,
      skipped: false,
      messageId: info.messageId,
      accepted: info.accepted,
    }
  } catch (error) {
    console.error("Account creation email failed:", error)

    return {
      sent: false,
      skipped: false,
      reason: getEmailFailureReason(error),
    }
  } finally {
    closeTransporter(transporter)
  }
}

module.exports = {
  closeTransporter,
  getEmailFailureReason,
  getDefaultBaseUrl,
  getDefaultLoginUrl,
  getTransporter,
  sendMailWithTimeout,
  sendAccountCreationEmail,
  // expose queued send for direct use if needed
  sendResendEmail,
}
