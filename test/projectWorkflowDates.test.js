const test = require("node:test")
const assert = require("node:assert/strict")
const { _test } = require("../src/controllers/projectController")

test("planned and actual schedules remain independent and actual overrun is accepted", () => {
  const [task] = _test.normalizeWorkflowTasks([{
    id: "task-1",
    name: "Validation",
    plannedStartDate: "2026-01-05",
    plannedEndDate: "2026-01-10",
    actualStartDate: "2026-01-07",
    actualCompletionDate: "2026-01-14",
  }])

  assert.equal(task.plannedStartDate, "2026-01-05")
  assert.equal(task.plannedEndDate, "2026-01-10")
  assert.equal(task.actualStartDate, "2026-01-07")
  assert.equal(task.actualCompletionDate, "2026-01-14")
  assert.equal(task.executionStatus, "Completed")
  assert.equal(task.status, "Completed")
})

test("actual start automatically produces In Progress without changing planned dates", () => {
  const [task] = _test.normalizeWorkflowTasks([{
    name: "Tooling",
    planDate: "2026-02-01",
    dueDate: "2026-02-20",
    actualStartDate: "2026-02-10T12:30:00.000Z",
  }])

  assert.equal(task.plannedStartDate, "2026-02-01")
  assert.equal(task.plannedEndDate, "2026-02-20")
  assert.equal(task.actualStartDate, "2026-02-10")
  assert.equal(task.executionStatus, "In Progress")
})

test("invalid date order and completion without a start are rejected", () => {
  assert.throws(
    () => _test.normalizeWorkflowTasks([{ name: "Bad plan", plannedStartDate: "2026-03-10", plannedEndDate: "2026-03-01" }]),
    /Planned start date cannot be later/,
  )
  assert.throws(
    () => _test.normalizeWorkflowTasks([{ name: "Bad actual", actualCompletionDate: "2026-03-10" }]),
    /Actual start date is required/,
  )
})

test("approval status stays independent from execution status", () => {
  const [task] = _test.normalizeWorkflowTasks([{
    name: "Approved evidence",
    status: "Approved",
    actualStartDate: "2026-04-01",
    actualCompletionDate: "2026-04-02",
  }])

  assert.equal(task.approvalStatus, "Approved")
  assert.equal(task.executionStatus, "Completed")
  assert.equal(task.status, "Approved")
  assert.equal(_test.isCompletedTask(task), true)
})
