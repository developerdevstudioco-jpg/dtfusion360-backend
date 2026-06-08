const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;")

const renderList = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return "<p style=\"margin:0;color:#64748b;\">None</p>"
  }

  return `
    <ul style="margin:0;padding-left:18px;color:#1e293b;">
      ${items.map((item) => `<li style="margin:0 0 6px;">${escapeHtml(item)}</li>`).join("")}
    </ul>
  `
}

const generateProjectCreationEmail = ({
  recipientName,
  project,
  drNumbers,
  cftMembers,
  loginUrl,
  logoUrl,
}) => `
  <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
    <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="padding:24px 28px;background:linear-gradient(135deg,#ffffff 0%,#fef2f2 100%);border-bottom:1px solid #e2e8f0;">
        <img src="${escapeHtml(logoUrl)}" alt="DT-Fusion360" style="height:40px;margin-bottom:16px;" />
        <p style="margin:0 0 8px;font-size:14px;color:#475569;">Hello ${escapeHtml(recipientName || "Team")},</p>
        <h1 style="margin:0;font-size:24px;line-height:1.2;color:#b91c1c;">New Project Created</h1>
        <p style="margin:12px 0 0;font-size:14px;color:#475569;">
          A new project has been initiated in your plant and is ready for review in DT-Fusion360.
        </p>
      </div>

      <div style="padding:28px;">
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-bottom:24px;">
          <div>
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;">Project</p>
            <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(project.name)}</p>
          </div>
          <div>
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;">Plant</p>
            <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(project.plant)}</p>
          </div>
          <div>
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;">Project Lead</p>
            <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(project.projectLead)}</p>
          </div>
          <div>
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;">SOP Date</p>
            <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(project.sopDate)}</p>
          </div>
        </div>

        <div style="margin-bottom:20px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;">Customer / Part</p>
          <p style="margin:0;color:#1e293b;">${escapeHtml(project.customer)} / ${escapeHtml(project.partCode)}</p>
        </div>

        <div style="margin-bottom:20px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;">CFT Members</p>
          ${renderList(cftMembers)}
        </div>

        <div style="margin-bottom:24px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;">Development Requests</p>
          ${renderList(drNumbers)}
        </div>

        <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;">
          Open DT-Fusion360
        </a>
      </div>
    </div>
  </div>
`

module.exports = {
  generateProjectCreationEmail,
}
