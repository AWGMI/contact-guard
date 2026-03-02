# @awgmi/contact-guard

A lightweight, zero-dependency spam classification library for contact forms. Uses OpenRouter's Gemini Flash Lite for LLM-based classification, with built-in honeypot middleware and prompt injection protection. Designed for fail-open reliability — if the classifier fails, legitimate messages get through. Includes Hono middleware for rate limiting and request validation, JSONL logging for submissions, and Resend integration for email delivery.

## Usage

```js
import { Hono } from 'hono'
import {
  buildSystemPrompt,
  createModelResolver,
  createClassifier,
  createSubmissionLogger,
  createMailer,
  createRateLimiter,
  honeypotMiddleware,
  HONEYPOT_HTML,
  escapeHtml,
  sanitizeForEmail,
} from '@awgmi/contact-guard'

const app = new Hono()

const systemPrompt = buildSystemPrompt({
  projectName: 'Acme',
  projectDescription: 'a project management tool',
  spamCategories: ['SEO services', 'Web design agencies', 'Link building'],
  genuineCategories: ['Feature questions', 'Pricing inquiries', 'Bug reports'],
  thanksGenuineExample: "Thanks for reaching out about Acme!",
  thanksSpamExample: "Thanks for your interest in helping businesses grow!",
})

const resolveModel = createModelResolver()
const classify = createClassifier({
  apiKey: process.env.OPENROUTER_API_KEY,
  systemPrompt,
  resolveModel,
})
const logSubmission = createSubmissionLogger({ baseDir: import.meta.dirname })
const sendEmail = createMailer({ apiKey: process.env.RESEND_API_KEY })
const rateLimit = createRateLimiter()

app.post('/contact',
  rateLimit,
  honeypotMiddleware(),
  async (c) => {
    const body = c.get('parsedBody')
    const name = body.name?.trim() || ''
    const email = body.email?.trim() || ''
    const message = body.message?.trim() || ''

    const classification = await classify({ name, email, message })
    logSubmission({ name, email, message, classification })

    if (classification.classification === 'spam') return c.json({ success: true })

    await sendEmail({
      from: process.env.MAIL_FROM,
      to: process.env.MAIL_TO,
      replyTo: sanitizeForEmail(email),
      subject: `Contact: ${sanitizeForEmail(name)}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      html: `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)})</p><p>${escapeHtml(message)}</p>`,
    })

    return c.json({ success: true })
  }
)
```

Add the honeypot field to your HTML form:

```js
import { HONEYPOT_HTML } from '@awgmi/contact-guard'
// Insert HONEYPOT_HTML inside your <form> element
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | For classification | OpenRouter API key |
| `RESEND_API_KEY` | For email | Resend API key |
| `MAIL_FROM` | For email | Sender address |
| `MAIL_TO` | For email | Recipient address |

## License

MIT
