# DT-Fusion
Backend Repository

## API rate limits

The server limits each client to 300 API requests per 15-minute window. Authentication endpoints also allow no more than 10 failed attempts per 15-minute window. Successful authentication requests do not consume the stricter authentication quota.

Override the defaults with environment variables:

```env
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=10
```

Rejected requests return HTTP `429` with a JSON message, `retryAfterSeconds`, and standard rate-limit response headers.
