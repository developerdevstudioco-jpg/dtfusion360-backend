const crypto = require("crypto")
const fs = require("fs")
const path = require("path")
const mongoose = require("mongoose")

const storageRoot = path.resolve(process.env.REPOSITORY_STORAGE_PATH || path.join(__dirname, "..", "..", "storage", "repository"))
const bucketName = "repositoryFiles"

function safeResolve(storageKey) {
  if (typeof storageKey !== "string" || !storageKey.trim() || /^[a-z]:/i.test(storageKey)) {
    const error = new Error("Invalid storage key")
    error.statusCode = 400
    throw error
  }
  const segments = storageKey.split(/[\\/]+/)
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    const error = new Error("Invalid storage key")
    error.statusCode = 400
    throw error
  }
  const target = path.resolve(storageRoot, ...segments)
  if (target !== storageRoot && !target.startsWith(`${storageRoot}${path.sep}`)) {
    const error = new Error("Invalid storage key")
    error.statusCode = 400
    throw error
  }
  return target
}

function bucket() {
  if (!mongoose.connection.db) {
    const error = new Error("Repository database storage is not ready")
    error.statusCode = 503
    throw error
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName })
}

async function gridFile(storageKey) {
  const files = await bucket().find({ filename: storageKey }).limit(1).toArray()
  return files[0] || null
}

async function uploadDurableCopy(storageKey, filePath, metadata = {}) {
  const existing = await gridFile(storageKey)
  if (existing) return existing
  return new Promise((resolve, reject) => {
    const upload = bucket().openUploadStream(storageKey, { metadata: { storageKey, ...metadata } })
    fs.createReadStream(filePath)
      .on("error", reject)
      .pipe(upload)
      .on("error", reject)
      .on("finish", () => resolve({ _id: upload.id, length: upload.length, filename: storageKey }))
  })
}

async function persistUpload(tempPath, documentId, revisionNumber, originalName) {
  const extension = path.extname(originalName).toLowerCase()
  const storageKey = path.posix.join(String(documentId), `${revisionNumber}-${crypto.randomUUID()}${extension}`)
  const destination = safeResolve(storageKey)
  await fs.promises.mkdir(path.dirname(destination), { recursive: true })
  await fs.promises.rename(tempPath, destination)
  const hash = crypto.createHash("sha256")
  await new Promise((resolve, reject) => {
    fs.createReadStream(destination).on("data", (chunk) => hash.update(chunk)).on("end", resolve).on("error", reject)
  })
  const checksum = hash.digest("hex")
  try {
    await uploadDurableCopy(storageKey, destination, { documentId: String(documentId), revisionNumber, originalName, checksum })
  } catch (error) {
    await fs.promises.unlink(destination).catch(() => null)
    throw error
  }
  return { storageKey, checksum, absolutePath: destination }
}

async function locate(storageKey) {
  const filePath = safeResolve(storageKey)
  if (fs.existsSync(filePath)) {
    void uploadDurableCopy(storageKey, filePath, { migratedFromDisk: true }).catch((error) => {
      console.error("Repository file backup failed:", error.message)
    })
    const stats = await fs.promises.stat(filePath)
    return { source: "disk", filePath, length: stats.size }
  }
  const stored = await gridFile(storageKey)
  if (stored) return { source: "gridfs", file: stored, length: stored.length }
  return null
}

function openDownloadStream(storageKey, location) {
  if (location?.source === "disk") return fs.createReadStream(location.filePath)
  return bucket().openDownloadStreamByName(storageKey)
}

async function read(storageKey, location) {
  if (location?.source === "disk") return fs.promises.readFile(location.filePath)
  const chunks = []
  await new Promise((resolve, reject) => {
    openDownloadStream(storageKey, location)
      .on("data", (chunk) => chunks.push(chunk))
      .on("end", resolve)
      .on("error", reject)
  })
  return Buffer.concat(chunks)
}

async function remove(storageKey) {
  await fs.promises.unlink(safeResolve(storageKey)).catch((error) => {
    if (error.code !== "ENOENT") throw error
  })
  const stored = await gridFile(storageKey).catch(() => null)
  if (stored) await bucket().delete(stored._id)
}

module.exports = { storageRoot, safeResolve, persistUpload, locate, openDownloadStream, read, remove, uploadDurableCopy }
