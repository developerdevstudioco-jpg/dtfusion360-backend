const { rateLimit } = require("express-rate-limit")

const positiveInteger = (value, fallback) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const retryAfterSeconds = (request) => {
  const resetTime = request.rateLimit?.resetTime
  if (!(resetTime instanceof Date)) return undefined
  return Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
}

const jsonLimitHandler = (message) => (request, response) => {
  response.status(429).json({
    message,
    retryAfterSeconds: retryAfterSeconds(request),
  })
}

const apiRateLimiter = rateLimit({
  windowMs: positiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  limit: positiveInteger(process.env.RATE_LIMIT_MAX, 300),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: request => request.method === "OPTIONS",
  handler: jsonLimitHandler("Too many API requests. Please try again later."),
})

const authRateLimiter = rateLimit({
  windowMs: positiveInteger(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  limit: positiveInteger(process.env.AUTH_RATE_LIMIT_MAX, 10),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: request => request.method === "OPTIONS",
  skipSuccessfulRequests: true,
  handler: jsonLimitHandler("Too many failed authentication attempts. Please try again later."),
})

module.exports = { apiRateLimiter, authRateLimiter }
