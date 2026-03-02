const DEFAULT_MODELS_URL = 'https://openrouter.ai/api/v1/models'
const DEFAULT_FALLBACK_MODEL = 'google/gemini-2.5-flash-lite'
const DEFAULT_TIMEOUT_MS = 5000
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export function createModelResolver(options = {}) {
  const {
    modelsUrl = DEFAULT_MODELS_URL,
    fallbackModel = DEFAULT_FALLBACK_MODEL,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  } = options

  let cachedModelId = null
  let cachedModelExpiry = 0

  return async function resolve() {
    if (cachedModelId && Date.now() < cachedModelExpiry) return cachedModelId

    try {
      const response = await fetch(modelsUrl, {
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) throw new Error(`Models API: ${response.status}`)

      const { data } = await response.json()
      const now = new Date().toISOString().split('T')[0]

      const candidates = data.filter((m) => {
        if (!/gemini.*flash.*lite/i.test(m.id)) return false
        if (/preview/i.test(m.id)) return false
        if (m.expiration_date && m.expiration_date <= now) return false
        return true
      })

      if (!candidates.length) throw new Error('No matching models found')

      candidates.sort((a, b) => {
        const costA = parseFloat(a.pricing?.prompt || '999')
        const costB = parseFloat(b.pricing?.prompt || '999')
        if (costA !== costB) return costA - costB
        return (a.created || 0) - (b.created || 0)
      })

      cachedModelId = candidates[0].id
      cachedModelExpiry = Date.now() + cacheTtlMs
      console.log(`Classifier model resolved: ${cachedModelId}`)
      return cachedModelId
    } catch (err) {
      console.error('Model resolution failed, using fallback:', err.message)
      return fallbackModel
    }
  }
}
