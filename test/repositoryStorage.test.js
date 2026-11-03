const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("path")
const { safeResolve, storageRoot } = require("../src/services/repositoryStorageService")

test("resolves stored file keys written with either path separator", () => {
  const expected = path.join(storageRoot, "document-id", "R00-file.pdf")

  assert.equal(safeResolve("document-id/R00-file.pdf"), expected)
  assert.equal(safeResolve("document-id\\R00-file.pdf"), expected)
})

test("rejects storage keys that escape the repository root", () => {
  for (const storageKey of ["../outside.pdf", "..\\outside.pdf", "document-id/../../outside.pdf"]) {
    assert.throws(() => safeResolve(storageKey), { statusCode: 400 })
  }
})
