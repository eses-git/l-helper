import type { AppSettings, CandidateProfile } from '../types'

/**
 * Parameters for the streaming answer service.
 */
export interface StreamAnswerParams {
  question: string
  profile: CandidateProfile
  settings: AppSettings
  onChunk: (chunk: string) => void
  onError: (error: Error) => void
  onComplete: () => void
  /** Optional abort signal to cancel an in-flight request. */
  signal?: AbortSignal
}

type Provider = 'openai' | 'gemini'

type GeminiAction = 'generateContent' | 'streamGenerateContent'

/** Actively supported Gemini Flash model used as the default fall-back. */
const GEMINI_DEFAULT_MODEL = 'gemini-1.5-flash'

/** Rough shapes of the streaming payloads returned by each provider. */
interface OpenAIChunk {
  choices?: Array<{
    delta?: { content?: string }
    message?: { content?: string }
  }>
}

interface GeminiChunk {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
  }>
}

function detectProvider(settings: AppSettings): Provider {
  const endpoint = settings.apiEndpoint.toLowerCase()
  const model = settings.modelName.toLowerCase()
  if (
    endpoint.includes('generativelanguage.googleapis.com') ||
    endpoint.includes('googleapis.com') ||
    model.startsWith('gemini')
  ) {
    return 'gemini'
  }
  return 'openai'
}

function buildProfileSummary(profile: CandidateProfile): string {
  const identity = [profile.fullName.trim(), profile.roleTitle.trim()].filter(Boolean).join(' — ')
  const skills = profile.technicalSkills.map((s) => s.trim()).filter(Boolean).join(', ')
  const achievements = profile.keyAchievements
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => `- ${a}`)
    .join('\n')

  const lines: string[] = []
  if (identity) lines.push(`Name / Role: ${identity}`)
  if (profile.summary.trim()) lines.push(`Summary: ${profile.summary.trim()}`)
  if (skills) lines.push(`Technical skills: ${skills}`)
  if (achievements) lines.push(`Key achievements:\n${achievements}`)
  if (profile.customContext.trim()) lines.push(`Custom context: ${profile.customContext.trim()}`)

  return lines.length > 0 ? lines.join('\n') : 'No profile provided yet.'
}

function buildSystemPrompt(profile: CandidateProfile, template: string): string {
  const core = `Act as a concise, high-speed interview co-pilot. Use the following candidate profile:
${buildProfileSummary(profile)}
Rules:
1. Answer the question directly in 2 to 3 high-impact bullet points maximum.
2. Keep responses brief, confident, and easy to read at a quick glance.
3. If a coding solution is needed, provide only the core code snippet with a 1-sentence explanation.`

  const custom = template.trim()
  return custom ? `${custom}\n\n${core}` : core
}

function buildOpenAIRequest(settings: AppSettings, systemPrompt: string, question: string): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: settings.modelName,
      stream: true,
      temperature: settings.temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
    }),
  }
}

/**
 * Builds a Gemini v1beta REST endpoint URL.
 *
 * Base endpoint:  https://generativelanguage.googleapis.com/v1beta
 * Content path:   /models/${modelName}:generateContent
 * Streaming path: /models/${modelName}:streamGenerateContent
 *
 * Trailing slashes are stripped and the `/models/${modelName}:<action>` path is
 * appended automatically when only a root endpoint is provided.
 */
function buildGeminiUrl(
  endpoint: string,
  modelName: string,
  apiKey: string,
  action: GeminiAction,
): string {
  // Strip trailing slashes from the user-supplied base URL.
  let url = endpoint.trim().replace(/\/+$/, '')

  const hasAction = url.includes(':generateContent') || url.includes(':streamGenerateContent')

  if (!hasAction) {
    const encodedModel = encodeURIComponent(modelName)
    if (url.endsWith('/models')) {
      url = `${url}/${encodedModel}`
    } else if (!url.endsWith(`/models/${encodedModel}`)) {
      url = `${url}/models/${encodedModel}`
    }
    url = `${url}:${action}`
  }

  // Attach (or refresh) the API key query parameter without duplicating it.
  const queryIndex = url.indexOf('?')
  const path = queryIndex === -1 ? url : url.slice(0, queryIndex)
  const params = new URLSearchParams(queryIndex === -1 ? '' : url.slice(queryIndex + 1))
  params.set('key', apiKey)

  return `${path}?${params.toString()}`
}

function buildGeminiRequest(
  settings: AppSettings,
  systemPrompt: string,
  question: string,
): { url: string; init: RequestInit } {
  const modelName = settings.modelName.trim() || GEMINI_DEFAULT_MODEL

  return {
    url: buildGeminiUrl(settings.apiEndpoint, modelName, settings.apiKey.trim(), 'streamGenerateContent'),
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: question }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: settings.temperature },
      }),
    },
  }
}

function extractOpenAIChunk(json: unknown): string {
  const chunk = json as OpenAIChunk
  const delta = chunk.choices?.[0]?.delta?.content
  if (typeof delta === 'string') return delta
  const message = chunk.choices?.[0]?.message?.content
  if (typeof message === 'string') return message
  return ''
}

function extractGeminiChunk(json: unknown): string {
  const chunk = json as GeminiChunk
  const parts = chunk.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('')
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export async function streamAnswer(params: StreamAnswerParams): Promise<void> {
  const { question, profile, settings, onChunk, onError, onComplete, signal } = params

  const apiKey = settings.apiKey.trim()
  const endpoint = settings.apiEndpoint.trim()

  if (!apiKey) {
    onError(new Error('API key is missing. Add your API key in Settings to generate answers.'))
    return
  }
  if (!endpoint) {
    onError(new Error('API endpoint is missing. Add an endpoint URL in Settings.'))
    return
  }

  const provider = detectProvider(settings)
  const systemPrompt = buildSystemPrompt(profile, settings.systemPromptTemplate)

  const { url, init } =
    provider === 'gemini'
      ? buildGeminiRequest(settings, systemPrompt, question)
      : { url: endpoint, init: buildOpenAIRequest(settings, systemPrompt, question) }

  let response: Response
  try {
    response = await fetch(url, { ...init, signal })
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) return
    onError(error instanceof Error ? error : new Error('Network error — could not reach the API endpoint.'))
    return
  }

  if (!response.ok) {
    let detail = ''
    try {
      detail = await response.text()
    } catch {
      // Ignore body read failures.
    }
    onError(
      new Error(`API request failed (status ${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}.`),
    )
    return
  }

  if (!response.body) {
    onError(new Error('Streaming responses are not supported by this browser.'))
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const processLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return

    let payload = trimmed
    if (trimmed.startsWith('data:')) payload = trimmed.slice(5).trim()
    if (payload === '[DONE]') return

    let json: unknown
    try {
      json = JSON.parse(payload)
    } catch {
      return
    }

    const chunk = provider === 'gemini' ? extractGeminiChunk(json) : extractOpenAIChunk(json)
    if (chunk) onChunk(chunk)
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) processLine(line)
    }

    buffer += decoder.decode()
    if (buffer.trim()) processLine(buffer)

    onComplete()
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) return
    onError(error instanceof Error ? error : new Error('The stream was interrupted.'))
  } finally {
    reader.releaseLock()
  }
}
