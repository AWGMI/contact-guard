const RESEND_API_URL = 'https://api.resend.com/emails'
const DEFAULT_TIMEOUT_MS = 10000

export function createMailer(options) {
  const { apiKey, timeoutMs = DEFAULT_TIMEOUT_MS } = options

  return async function sendEmail({ from, to, replyTo, subject, text, html }) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          from,
          to,
          reply_to: replyTo,
          subject,
          text,
          html,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(
          `Resend error: ${response.status} - ${JSON.stringify(error)}`
        )
      }

      return response.json()
    } finally {
      clearTimeout(timeout)
    }
  }
}
