export type NetworkStreamStatus = 'connecting' | 'connected' | 'disconnected'

export interface NetworkStreamCallbacks {
  onTranscript: (text: string) => void
  onStatusChange?: (status: NetworkStreamStatus) => void
  onError?: (message: string) => void
}

export interface NetworkStreamConnection {
  close: () => void
  getStatus: () => NetworkStreamStatus
}

interface TranscriptPayload {
  transcript?: unknown
  text?: unknown
}

/**
 * Accepts either a plain-text transcript frame or a JSON frame shaped like
 * `{ "transcript": "…" }` (the `text` key is also accepted). Raw binary audio
 * cannot be transcribed client-side with the Web Speech API, so those frames
 * are intentionally ignored — a relay should send transcribed text frames.
 */
function extractTranscript(raw: string): string | null {
  let parsed: TranscriptPayload | null = null

  try {
    const value = JSON.parse(raw) as unknown
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      parsed = value as TranscriptPayload
    }
  } catch {
    // Not JSON — fall through and treat the raw string as plain text.
  }

  if (parsed) {
    if (typeof parsed.transcript === 'string' && parsed.transcript.trim()) {
      return parsed.transcript.trim()
    }
    if (typeof parsed.text === 'string' && parsed.text.trim()) {
      return parsed.text.trim()
    }
    return null
  }

  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function connectNetworkStream(
  url: string,
  callbacks: NetworkStreamCallbacks,
): NetworkStreamConnection {
  const socket = new WebSocket(url)
  socket.binaryType = 'arraybuffer'

  let status: NetworkStreamStatus = 'connecting'
  callbacks.onStatusChange?.(status)

  const setStatus = (next: NetworkStreamStatus) => {
    status = next
    callbacks.onStatusChange?.(next)
  }

  socket.onopen = () => setStatus('connected')
  socket.onclose = () => setStatus('disconnected')
  socket.onerror = () => callbacks.onError?.('Network stream connection error.')

  socket.onmessage = (event: MessageEvent) => {
    if (typeof event.data === 'string') {
      const transcript = extractTranscript(event.data)
      if (transcript) callbacks.onTranscript(transcript)
    }
  }

  return {
    close: () => {
      if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
        socket.close()
      }
    },
    getStatus: () => status,
  }
}
