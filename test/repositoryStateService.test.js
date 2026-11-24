const test = require("node:test")
const assert = require("node:assert/strict")
const { assertTransition, nextRevisionNumber } = require("../src/services/repositoryStateService")
const { can } = require("../src/services/repositoryPermissionService")

test("revision sequence starts at R00 and increments without overwriting", () => {
  assert.equal(nextRevisionNumber(), "R00")
  assert.equal(nextRevisionNumber("R00"), "R01")
  assert.equal(nextRevisionNumber("R99"), "R100")
})

test("only valid workflow transitions are accepted", () => {
  assert.doesNotThrow(() => assertTransition("DRAFT", "PENDING_APPROVAL"))
  assert.doesNotThrow(() => assertTransition("PENDING_APPROVAL", "APPROVED"))
  assert.throws(() => assertTransition("DRAFT", "APPROVED"), /Invalid revision transition/)
  assert.throws(() => assertTransition("APPROVED", "PENDING_APPROVAL"), /Invalid revision transition/)
})

test("approval is role-controlled while administration remains admin-only", () => {
  const engineer = { id: "1", role: "Senior Engineer", departmentIds: ["eng"] }
  const manager = { id: "2", role: "Manager", departmentIds: ["eng"] }
  const admin = { id: "3", role: "SuperAdmin", departmentIds: [] }
  assert.equal(can(engineer, "document.approve", { departmentId: "eng" }), false)
  assert.equal(can(manager, "document.approve", { departmentId: "eng" }), true)
  assert.equal(can(manager, "repository.admin"), false)
  assert.equal(can(admin, "repository.admin"), true)
})
