const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("path")
const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")
const { PDFDocument } = require("pdf-lib")
require("dotenv").config({ path: path.join(__dirname, "..", ".env") })

const enabled = process.env.REPOSITORY_INTEGRATION === "1"

test("repository HTTP revision and approval workflow", { skip: !enabled }, async () => {
  const User = require("../src/models/Users")
  const Document = require("../src/models/Document")
  const Revision = require("../src/models/DocumentRevision")
  const Folder = require("../src/models/RepositoryFolder")
  const Audit = require("../src/models/RepositoryAudit")
  const Recent = require("../src/models/RepositoryRecent")
  const Favorite = require("../src/models/RepositoryFavorite")
  const storage = require("../src/services/repositoryStorageService")
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/dt-fusion360")
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const user = await User.create({ name: "Repository Integration", email: `repository-${suffix}@invalid.local`, employeeCode: `REPO-${suffix}`, role: "SuperAdmin", isActive: true })
  const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET || "secretkey")
  const headers = { Authorization: `Bearer ${token}` }
  let folderId
  let documentId
  const api = async (url, options = {}) => {
    const response = await fetch(`http://127.0.0.1:8080/api/repository${url}`, { ...options, headers: { ...headers, ...(options.headers || {}) } })
    const body = response.headers.get("content-type")?.includes("json") ? await response.json() : await response.text()
    if (!response.ok) throw new Error(`${response.status}: ${body.message || body}`)
    return body
  }
  const uploadForm = (contents, fields, fileName = "controlled-test.txt", mimeType = "text/plain") => {
    const form = new FormData()
    form.append("file", new Blob([contents], { type: mimeType }), fileName)
    Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)))
    return form
  }
  try {
    const sourcePdf = await PDFDocument.create()
    sourcePdf.addPage([300, 400])
    const sourcePdfBytes = await sourcePdf.save()
    const folder = await api("/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: `Repository test ${suffix}` }) })
    folderId = folder._id
    const created = await api("/documents", { method: "POST", body: uploadForm(sourcePdfBytes, { title: "Integration controlled document", documentNumber: `IT-${suffix}`, folderId, documentType: "Procedure", controlledDocument: true, revisionNotes: "Initial issue", submit: true }, "controlled-test.pdf", "application/pdf") })
    documentId = created.document._id
    assert.equal(created.revision.status, "PENDING_APPROVAL")
    await api(`/revisions/${created.revision._id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "APPROVE", comment: "Initial approval" }) })
    let details = await api(`/documents/${documentId}`)
    assert.equal(details.document.currentRevisionNumber, "R00")

    const previewResponse = await fetch(`http://127.0.0.1:8080/api/repository/revisions/${created.revision._id}/content`, { headers })
    assert.equal(previewResponse.status, 200)
    assert.equal(previewResponse.headers.get("content-type"), "application/pdf")
    assert.match(previewResponse.headers.get("content-disposition"), /^inline;/)
    assert.ok((await previewResponse.arrayBuffer()).byteLength > 0)

    const downloadResponse = await fetch(`http://127.0.0.1:8080/api/repository/revisions/${created.revision._id}/content?disposition=attachment`, { headers })
    assert.equal(downloadResponse.status, 200)
    assert.equal(downloadResponse.headers.get("content-type"), "application/pdf")
    assert.match(downloadResponse.headers.get("content-disposition"), /^attachment;/)
    assert.equal(downloadResponse.headers.get("x-document-watermark"), "CONTROLLED COPY")
    assert.ok((await downloadResponse.arrayBuffer()).byteLength > 0)

    const next = await api(`/documents/${documentId}/revisions`, { method: "POST", body: uploadForm("R01 file", { revisionNotes: "Second issue", submit: true }) })
    details = await api(`/documents/${documentId}`)
    assert.equal(details.document.currentRevisionNumber, "R00", "pending upload must not become current")
    await api(`/revisions/${next._id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "APPROVE", comment: "Second approval" }) })
    details = await api(`/documents/${documentId}`)
    assert.equal(details.document.currentRevisionNumber, "R01")
    assert.equal(details.revisions.find((item) => item.revisionNumber === "R00").status, "SUPERSEDED")
    assert.equal(details.revisions.find((item) => item.revisionNumber === "R01").status, "APPROVED")
    const rejected = await api(`/documents/${documentId}/revisions`, { method: "POST", body: uploadForm("R02 rejected", { revisionNotes: "Third issue", submit: true }) })
    await api(`/revisions/${rejected._id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "REJECT", comment: "Correct the document" }) })
    details = await api(`/documents/${documentId}`)
    assert.equal(details.document.currentRevisionNumber, "R01", "rejection must not change the current revision")
    assert.equal(details.revisions.find((item) => item.revisionNumber === "R02").rejectionReason, "Correct the document")
    let corrected = await api(`/revisions/${rejected._id}/file`, { method: "POST", body: uploadForm("R02 corrected once", { revisionNotes: "Corrected third issue", submit: true }) })
    await api(`/revisions/${corrected._id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "REQUEST_CHANGES", comment: "One more correction" }) })
    corrected = await api(`/revisions/${rejected._id}/file`, { method: "POST", body: uploadForm("R02 corrected twice", { revisionNotes: "Final third issue", submit: true }) })
    await api(`/revisions/${corrected._id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "APPROVE", comment: "Approved after changes" }) })
    details = await api(`/documents/${documentId}`)
    assert.equal(details.document.currentRevisionNumber, "R02")
    assert.equal(details.revisions.find((item) => item.revisionNumber === "R01").status, "SUPERSEDED")
    const actions = await api(`/documents/${documentId}/audit`)
    assert.ok(actions.some((entry) => entry.action === "REVISION_SUPERSEDED"))
    assert.ok(actions.some((entry) => entry.action === "REVISION_APPROVED"))
    assert.ok(actions.some((entry) => entry.action === "REVISION_REJECTED"))
    assert.ok(actions.some((entry) => entry.action === "REVISION_CHANGES_REQUESTED"))
  } finally {
    const revisions = documentId ? await Revision.find({ documentId }).select("+storageKey").lean() : []
    for (const revision of revisions) await storage.remove(revision.storageKey).catch(() => null)
    if (documentId) {
      await Promise.all([Revision.deleteMany({ documentId }), Document.deleteOne({ _id: documentId }), Audit.deleteMany({ documentId }), Recent.deleteMany({ documentId }), Favorite.deleteMany({ targetId: documentId })])
    }
    if (folderId) await Promise.all([Folder.deleteOne({ _id: folderId }), Audit.deleteMany({ folderId }), Favorite.deleteMany({ targetId: folderId })])
    await User.deleteOne({ _id: user._id })
    await mongoose.disconnect()
  }
})
