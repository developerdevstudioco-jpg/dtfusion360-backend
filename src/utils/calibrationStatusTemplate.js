const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;")

const getValue = (value, placeholder = "-") => {
  if (typeof value !== "string") {
    return placeholder
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : placeholder
}

const BRAND_PRIMARY = "#ed1c24"
const BRAND_PRIMARY_DARK = "#b5161d"
const BRAND_ACCENT = "#fff3e8"
const BRAND_SURFACE = "#fff8f6"

const getStatusStyle = (status) => {
  const normalized = getValue(status, "").toLowerCase()

  if (normalized === "over due") {
    return { bg: "#fee2e2", text: "#b91c1c", border: "#fecaca" }
  }

  if (normalized === "due near") {
    return { bg: "#ffedd5", text: "#c2410c", border: "#fdba74" }
  }

  if (normalized === "due soon") {
    return { bg: "#fef3c7", text: "#b45309", border: "#fcd34d" }
  }

  if (normalized === "good") {
    return { bg: "#dcfce7", text: "#15803d", border: "#86efac" }
  }

  return { bg: "#e2e8f0", text: "#475569", border: "#cbd5e1" }
}

const buildDetailRow = (label, value) => `
  <tr>
    <td style="padding:12px 14px;border-top:1px solid #e2e8f0;font-size:13px;line-height:18px;font-weight:600;color:#475569;background-color:#f8fafc;width:38%;">
      ${escapeHtml(label)}
    </td>
    <td style="padding:12px 14px;border-top:1px solid #e2e8f0;font-size:13px;line-height:18px;color:#0f172a;">
      ${escapeHtml(getValue(value))}
    </td>
  </tr>`

const generateCalibrationStatusEmail = ({
  calibration,
  previousStatus,
  currentStatus,
  logoUrl,
}) => {
  const statusStyle = getStatusStyle(currentStatus)
  const currentYear = new Date().getFullYear()

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Calibration Status Update</title>
  </head>
  <body style="margin:0;padding:0;background-color:#faf9f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;background-color:#faf9f8;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:640px;border-collapse:separate;border-spacing:0;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 32px rgba(15,23,42,0.12);">
            <tr>
              <td align="center" style="padding:30px 24px;background:linear-gradient(180deg,#fffdfa 0%,${BRAND_SURFACE} 100%);border-bottom:1px solid #f3dfd7;">
                <img src="${escapeHtml(getValue(logoUrl, "{{logo_url}}"))}" alt="DT-Fusion360 Logo" width="104" style="display:block;max-width:104px;width:104px;height:auto;margin:0 auto 18px auto;border:0;outline:none;text-decoration:none;" />
                <div style="display:inline-block;padding:7px 14px;border-radius:999px;background-color:${BRAND_ACCENT};border:1px solid #f7d5be;font-size:12px;line-height:18px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND_PRIMARY_DARK};">
                  Calibration Status Update
                </div>
                <div style="margin-top:16px;font-size:28px;line-height:36px;font-weight:700;color:#0f172a;">
                  Calibration status changed
                </div>
                <div style="margin-top:10px;font-size:15px;line-height:24px;color:#475569;max-width:500px;">
                  One instrument has moved to a new calibration status in DT-Fusion360.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 24px 16px 24px;">
                <div style="padding:16px 18px;border-radius:16px;background-color:#fffaf8;border:1px solid #f2dfd5;font-size:14px;line-height:22px;color:#334155;">
                  Previous Status:
                  <strong style="color:#0f172a;"> ${escapeHtml(getValue(previousStatus))}</strong>
                  <br />
                  Current Status:
                  <span style="display:inline-block;margin-top:8px;padding:6px 12px;border-radius:999px;background-color:${statusStyle.bg};border:1px solid ${statusStyle.border};font-weight:700;color:${statusStyle.text};">
                    ${escapeHtml(getValue(currentStatus))}
                  </span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 20px 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;background-color:#ffffff;">
                  <tr>
                    <td colspan="2" style="padding:14px 16px;background-color:#f8fafc;font-size:14px;line-height:20px;font-weight:700;color:${BRAND_PRIMARY_DARK};">
                      Instrument Primary Details
                    </td>
                  </tr>
                  ${buildDetailRow("Instrument / Equipment Name", calibration.instrument)}
                  ${buildDetailRow("Make", calibration.make)}
                  ${buildDetailRow("Instruments ID No.", calibration.instrumentId)}
                  ${buildDetailRow("Serial No.", calibration.serialNo)}
                  ${buildDetailRow("Least Count", calibration.leastCount)}
                  ${buildDetailRow("Range", calibration.range)}
                  ${buildDetailRow("Location", calibration.location)}
                  ${buildDetailRow("Calibration Due", calibration.dueDate)}
                  ${buildDetailRow("Remaining Days", calibration.remainingDays)}
                  ${buildDetailRow("Calibration Status", calibration.status)}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 24px 24px;font-size:13px;line-height:20px;color:#64748b;">
                This is an automated calibration status notification from DT-Fusion360.
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;background-color:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:18px;color:#64748b;text-align:center;">
                &copy; ${currentYear} DT-Fusion360. Please review the calibration record in the application.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

module.exports = {
  generateCalibrationStatusEmail,
}
