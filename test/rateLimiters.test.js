const assert = require("node:assert/strict")
const test = require("node:test")
const express = require("express")

test("authentication limiter blocks repeated failed attempts with retry details", async () => {
  process.env.AUTH_RATE_LIMIT_MAX = "2"
  process.env.AUTH_RATE_LIMIT_WINDOW_MS = "60000"

  const { authRateLimiter } = require("../src/middleware/rateLimiters")
  const app = express()
  app.post("/login", authRateLimiter, (_request, response) => response.status(401).json({ message: "Invalid credentials" }))

  const server = await new Promise(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance))
  })

  try {
    const address = server.address()
    const url = `http://127.0.0.1:${address.port}/login`
    const first = await fetch(url, { method: "POST" })
    const second = await fetch(url, { method: "POST" })
    const blocked = await fetch(url, { method: "POST" })
    const body = await blocked.json()

    assert.equal(first.status, 401)
    assert.equal(second.status, 401)
    assert.equal(blocked.status, 429)
    assert.match(blocked.headers.get("ratelimit") || "", /limit=2/)
    assert.equal(body.message, "Too many failed authentication attempts. Please try again later.")
    assert.ok(body.retryAfterSeconds > 0)
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    delete process.env.AUTH_RATE_LIMIT_MAX
    delete process.env.AUTH_RATE_LIMIT_WINDOW_MS
  }
})
