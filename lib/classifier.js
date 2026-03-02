const DEFAULT_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_TIMEOUT_MS = 5000

export function createClassifier(options) {
  const {
    apiKey,
    systemPrompt,
    resolveModel,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    completionsUrl = DEFAULT_COMPLETIONS_URL,
  } = options

  return async function classify({ name, email, message }) {
    const fail = (reason) => ({
      classification: 'genuine',
      reason,
      failed: true,
      engine: { model: null, provider: 'openrouter', raw: null },
    })

    if (!apiKey) {
      console.warn('OpenRouter API key not configured — skipping spam classification')
      return fail('API key not configured')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    let model = null
    let rawContent = null
    try {
      model = resolveModel ? await resolveModel() : null
      if (!model) return fail('No model available')

      const response = await fetch(completionsUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
            },
          ],
          temperature: 0,
        }),
      })

      if (!response.ok) {
        console.error(`OpenRouter API error: ${response.status}`)
        return {
          ...fail('API request failed'),
          engine: { model, provider: 'openrouter', raw: null },
        }
      }

      const data = await response.json()
      rawContent = data.choices?.[0]?.message?.content?.trim() || null
      const engine = {
        model: data.model || model,
        provider: 'openrouter',
        usage: data.usage || null,
        raw: rawContent,
      }

      if (!rawContent) {
        console.error('OpenRouter returned empty response')
        return { ...fail('Empty API response'), engine }
      }

      const cleaned = rawContent
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
      const result = JSON.parse(cleaned)

      if (result.classification !== 'genuine' && result.classification !== 'spam') {
        console.error('Unexpected classification value:', result.classification)
        return { ...fail('Invalid classification value'), engine }
      }

      return { ...result, engine }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.error('OpenRouter API request timed out')
      } else if (err instanceof SyntaxError) {
        console.error('Failed to parse classifier response as JSON:', rawContent)
      } else {
        console.error('Classification error:', err.message)
      }
      return {
        ...fail('Classification failed'),
        engine: { model, provider: 'openrouter', raw: rawContent },
      }
    } finally {
      clearTimeout(timeout)
    }
  }
}
