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
  username,
  password,
  loginUrl,
  logoUrl,
}) => {
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
    <title>Your Account is Ready</title>
  </head>
  <body style="margin:0;padding:0;background-color:#faf9f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;background-color:#faf9f8;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px;border-collapse:separate;border-spacing:0;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 32px rgba(15,23,42,0.12);">
            <tr>
              <td align="center" style="padding:32px 24px;background:linear-gradient(135deg,${BRAND_PRIMARY} 0%,#d41019 55%,#f54c54 100%);">
                <img src="${escapeHtml(safeLogoUrl)}" alt="DT-Fusion360 Logo" width="96" style="display:block;max-width:96px;width:96px;height:auto;margin:0 auto 16px auto;border:0;outline:none;text-decoration:none;" />
                <div style="font-size:28px;line-height:36px;font-weight:700;color:#ffffff;">Your Account is Ready</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 24px 16px 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;border:1px solid #fce7e8;border-radius:14px;overflow:hidden;background-color:#fffbfa;">
                  <tr>
                    <td colspan="2" style="padding:14px 16px;background-color:${BRAND_LIGHTER};font-size:14px;line-height:20px;font-weight:700;color:${BRAND_PRIMARY};">
                      Login Credentials
                    </td>
                  </tr>
                  <tr>
                    <td style="width:40%;padding:14px 16px;border-top:1px solid #fce7e8;font-size:14px;line-height:20px;font-weight:600;color:#334155;">
                      Username
                    </td>
                    <td style="padding:14px 16px;border-top:1px solid #fce7e8;font-size:14px;line-height:20px;color:#0f172a;">
                      ${safeUsername}
                    </td>
                  </tr>
                  <tr>
                    <td style="width:40%;padding:14px 16px;border-top:1px solid #fce7e8;font-size:14px;line-height:20px;font-weight:600;color:#334155;">
                      Temporary Password
                    </td>
                    <td style="padding:14px 16px;border-top:1px solid #fce7e8;font-size:14px;line-height:20px;color:#0f172a;">
                      ${safePassword}
                    </td>
                  </tr>
                  <tr>
                    <td style="width:40%;padding:14px 16px;border-top:1px solid #fce7e8;font-size:14px;line-height:20px;font-weight:600;color:#334155;">
                      Login URL
                    </td>
                    <td style="padding:14px 16px;border-top:1px solid #fce7e8;font-size:14px;line-height:20px;color:${BRAND_PRIMARY};word-break:break-word;">
                      <a href="${escapeHtml(safeLoginUrl)}" style="color:${BRAND_PRIMARY};text-decoration:none;">${escapeHtml(safeLoginUrl)}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 24px 8px 24px;">
                <a href="${escapeHtml(safeLoginUrl)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background-color:${BRAND_PRIMARY};color:#ffffff;font-size:15px;line-height:20px;font-weight:700;text-decoration:none;">
                  Access Your Account
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 8px 24px;">
                <div style="padding:14px 16px;border-radius:14px;background-color:${BRAND_LIGHTER};border:1px solid ${BRAND_LIGHT};font-size:14px;line-height:21px;color:${BRAND_PRIMARY};font-weight:600;">
                  Please change your password after login.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 28px 24px;font-size:13px;line-height:20px;color:#64748b;">
                This is a system-generated email from DT-Fusion360.
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;background-color:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:18px;color:#64748b;text-align:center;">
                &copy; ${currentYear} DT-Fusion360. For support, please contact your system administrator.
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
  generateAccountCreationEmail,
}
