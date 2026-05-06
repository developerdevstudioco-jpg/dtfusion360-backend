const { generateProjectCreationEmail } = require("../utils/projectCreationTemplate")
const {
  closeTransporter,
  getTransporter,
  getDefaultBaseUrl,
  getDefaultLoginUrl,
  getEmailFailureReason,
  sendMailWithTimeout,
} = require("./accountEmailService")

const sendProjectCreationEmail = async ({
  to,
  recipientName,
  project,
  drNumbers = [],
  cftMembers = [],
}) => {
  const { transporter, reason } = await getTransporter()

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
    const info = await sendMailWithTimeout(
      transporter,
      {
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
      },
      "Project creation email timed out before the SMTP server responded.",
    )

    return {
      sent: true,
      skipped: false,
      messageId: info.messageId,
      accepted: info.accepted,
    }
  } catch (error) {
    console.error("Project creation email failed:", error)

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
  sendProjectCreationEmail,
}
