const crypto = require("crypto")
const fs = require("fs")
const path = require("path")

const storageRoot = path.resolve(process.env.REPOSITORY_STORAGE_PATH || path.join(__dirname, "..", "..", "storage", "repository"))

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
  return { storageKey, checksum: hash.digest("hex"), absolutePath: destination }
}

async function remove(storageKey) {
  await fs.promises.unlink(safeResolve(storageKey)).catch((error) => {
    if (error.code !== "ENOENT") throw error
  })
}

module.exports = { storageRoot, safeResolve, persistUpload, remove }
