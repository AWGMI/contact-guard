export const HONEYPOT_FIELD_NAME = 'website_url'

export const HONEYPOT_HTML = `<div style="position:absolute;left:-9999px;opacity:0" aria-hidden="true">
  <label for="website_url">Website</label>
  <input type="text" id="website_url" name="website_url" tabindex="-1" autocomplete="off">
</div>`

export function honeypotMiddleware(options = {}) {
  const {
    fieldName = HONEYPOT_FIELD_NAME,
    onTriggered,
    response,
  } = options

  return async function honeypot(c, next) {
    const body = await c.req.parseBody()
    c.set('parsedBody', body)

    const honeypotValue =
      typeof body[fieldName] === 'string' ? body[fieldName].trim() : ''

    if (honeypotValue) {
      if (onTriggered) {
        onTriggered({ body, ip: c.req.header('x-forwarded-for')?.split(',')[0]?.trim() })
      }

      if (response) return response(c)
      return c.json({ success: true })
    }

    await next()
  }
}
