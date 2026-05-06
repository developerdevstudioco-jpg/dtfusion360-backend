const { generateCalibrationStatusEmail } = require("../utils/calibrationStatusTemplate")
const {
  closeTransporter,
  getTransporter,
  getDefaultBaseUrl,
  getEmailFailureReason,
  sendMailWithTimeout,
} = require("./accountEmailService")

const CALIBRATION_STATUS_RECIPIENT = "sureshkumar.s@dhoottransmission.com"

const sendCalibrationStatusEmail = async ({
  to = CALIBRATION_STATUS_RECIPIENT,
  calibration,
  previousStatus,
  currentStatus,
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
  const baseUrl = process.env.APP_BASE_URL || getDefaultBaseUrl()
  const logoUrl = process.env.ACCOUNT_EMAIL_LOGO_URL || `${baseUrl}/logo.png`

  try {
    const info = await sendMailWithTimeout(
      transporter,
      {
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject: `Calibration Status Update: ${calibration.instrument || "Instrument"} - ${currentStatus}`,
        html: generateCalibrationStatusEmail({
          calibration,
          previousStatus,
          currentStatus,
          logoUrl,
        }),
      },
      "Calibration status email timed out before the SMTP server responded.",
    )

    return {
      sent: true,
      skipped: false,
      messageId: info.messageId,
      accepted: info.accepted,
    }
  } catch (error) {
    console.error("Calibration status email failed:", error)

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
  CALIBRATION_STATUS_RECIPIENT,
  sendCalibrationStatusEmail,
}
