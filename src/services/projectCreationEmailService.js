const { generateProjectCreationEmail } = require("../utils/projectCreationTemplate")
<<<<<<< HEAD
const {
  getTransporter,
  getDefaultBaseUrl,
  getDefaultLoginUrl,
  getEmailFailureReason,
} = require("./accountEmailService")
=======
const { getTransporter, getDefaultBaseUrl, getDefaultLoginUrl } = require("./accountEmailService")
>>>>>>> 548bdac4f7ac69ca3ad1087ab8c4916ad24c8066

const sendProjectCreationEmail = async ({
  to,
  recipientName,
  project,
  drNumbers = [],
  cftMembers = [],
}) => {
<<<<<<< HEAD
  const { transporter, reason } = await getTransporter()
=======
  const { transporter, reason } = getTransporter()
>>>>>>> 548bdac4f7ac69ca3ad1087ab8c4916ad24c8066

  if (!transporter) {
    return {
      sent: false,
      skipped: true,
      reason,
    }
  }

  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER
  const fromName = process.env.SMTP_FROM_NAME || "DT-Fusion360"
  const loginUrl = process.env.APP_LOGIN_URL || getDefaultLoginUrl()
  const baseUrl = process.env.APP_BASE_URL || getDefaultBaseUrl()
  const logoUrl = process.env.ACCOUNT_EMAIL_LOGO_URL || `${baseUrl}/logo.png`

  try {
    const emailPromise = transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: `New Project Created: ${project?.name || "DT-Fusion360 Project"}`,
      html: generateProjectCreationEmail({
        recipientName,
        project,
        drNumbers,
        cftMembers,
        loginUrl,
        logoUrl,
      }),
    })

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Email sending timeout after 30 seconds")), 30000)
    )

    const info = await Promise.race([emailPromise, timeoutPromise])

    return {
      sent: true,
      skipped: false,
      messageId: info.messageId,
      accepted: info.accepted,
    }
  } catch (error) {
    console.error("Project creation email failed:", error)
<<<<<<< HEAD
=======
    const failureReason =
      error?.code === "EAUTH"
        ? "SMTP authentication failed. With Gmail, use a valid app password and ensure SMTP access is enabled."
        : error?.message || "Unknown email delivery error"
>>>>>>> 548bdac4f7ac69ca3ad1087ab8c4916ad24c8066

    return {
      sent: false,
      skipped: false,
<<<<<<< HEAD
      reason: getEmailFailureReason(error),
=======
      reason: failureReason,
>>>>>>> 548bdac4f7ac69ca3ad1087ab8c4916ad24c8066
    }
  }
}

module.exports = {
  sendProjectCreationEmail,
}
