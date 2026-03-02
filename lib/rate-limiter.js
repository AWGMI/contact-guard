const DEFAULT_WINDOW_MS = 15 * 60 * 1000
const DEFAULT_MAX = 10

export function createRateLimiter(options = {}) {
  const {
    windowMs = DEFAULT_WINDOW_MS,
    max = DEFAULT_MAX,
    ipHeader = 'x-forwarded-for',
  } = options

  const map = new Map()

  const cleanup = setInterval(() => {
    const cutoff = Date.now() - windowMs
    for (const [ip, entries] of map) {
      while (entries.length && entries[0] < cutoff) entries.shift()
      if (!entries.length) map.delete(ip)
    }
  }, windowMs)

  if (cleanup.unref) cleanup.unref()

  return async function rateLimitMiddleware(c, next) {
    const ip =
      c.req.header(ipHeader)?.split(',')[0]?.trim() || 'unknown'
    const now = Date.now()
    const windowStart = now - windowMs

    let entries = map.get(ip)
    if (!entries) {
      entries = []
      map.set(ip, entries)
    }

    while (entries.length && entries[0] < windowStart) entries.shift()

    if (entries.length >= max) {
      return c.json({ error: 'Too many requests. Please try again later.' }, 429)
    }

    entries.push(now)
    await next()
  }
}
