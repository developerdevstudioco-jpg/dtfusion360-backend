const fs = require("fs")
const path = require("path")
const mongoose = require("mongoose")
require("dotenv").config({ path: path.join(__dirname, "..", ".env") })
const storage = require("../src/services/repositoryStorageService")

async function filesUnder(root) {
  const entries = await fs.promises.readdir(root, { withFileTypes: true }).catch(() => [])
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(root, entry.name)
    return entry.isDirectory() ? filesUnder(target) : [target]
  }))
  return nested.flat()
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI)
  const files = await filesUnder(storage.storageRoot)
  let migrated = 0
  for (const filePath of files) {
    const storageKey = path.relative(storage.storageRoot, filePath).split(path.sep).join("/")
    await storage.uploadDurableCopy(storageKey, filePath, { migratedFromDisk: true })
    migrated += 1
  }
  console.log(`Repository durable-storage migration complete: ${migrated} file(s).`)
  await mongoose.disconnect()
}

main().catch(async (error) => {
  console.error(error.message)
  await mongoose.disconnect().catch(() => null)
  process.exitCode = 1
})
