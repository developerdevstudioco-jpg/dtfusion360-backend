const REVISION_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  UNDER_REVIEW: "UNDER_REVIEW",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
  REJECTED: "REJECTED",
  APPROVED: "APPROVED",
  SUPERSEDED: "SUPERSEDED",
  ARCHIVED: "ARCHIVED",
})

const TRANSITIONS = Object.freeze({
  DRAFT: new Set(["PENDING_APPROVAL"]),
  CHANGES_REQUESTED: new Set(["PENDING_APPROVAL"]),
  REJECTED: new Set(["PENDING_APPROVAL"]),
  PENDING_APPROVAL: new Set(["UNDER_REVIEW", "APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
  UNDER_REVIEW: new Set(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
  APPROVED: new Set(["SUPERSEDED", "ARCHIVED"]),
  SUPERSEDED: new Set(["ARCHIVED"]),
  ARCHIVED: new Set(),
})

function assertTransition(from, to) {
  if (!TRANSITIONS[from]?.has(to)) {
    const error = new Error(`Invalid revision transition: ${from} -> ${to}`)
    error.statusCode = 409
    throw error
  }
}

function nextRevisionNumber(current) {
  if (!current) return "R00"
  const match = /^R(\d+)$/.exec(String(current).toUpperCase())
  if (!match) {
    const error = new Error("The configured revision pattern is not supported")
    error.statusCode = 409
    throw error
  }
  return `R${String(Number(match[1]) + 1).padStart(Math.max(2, match[1].length), "0")}`
}

module.exports = { REVISION_STATUS, assertTransition, nextRevisionNumber }
