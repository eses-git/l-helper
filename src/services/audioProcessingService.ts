import type { VoiceProfile } from '../types'

const VOICE_PROFILE_STORAGE_KEY = 'userVoiceProfile'

/** Frequency range used by the autocorrelation pitch estimator (Hz). */
const MIN_PITCH_HZ = 85
const MAX_PITCH_HZ = 300

/** Normalization ranges used to map raw distances onto a 0..1 similarity scale. */
const PITCH_NORMALIZER_HZ = 400
const CENTROID_NORMALIZER_HZ = 4000

interface AudioFeatures {
  pitch: number
  spectralCentroid: number
}

function createAudioContext(): AudioContext {
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) throw new Error('Web Audio API is not supported in this browser.')
  return new Ctor()
}

/** Rough fundamental-frequency estimate via normalized autocorrelation. */
function estimatePitch(analyser: AnalyserNode, sampleRate: number, timeData: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(timeData)
  const n = timeData.length
  const samples = new Float32Array(n)
  let sumSquares = 0

  for (let i = 0; i < n; i++) {
    const value = (timeData[i] - 128) / 128
    samples[i] = value
    sumSquares += value * value
  }

  const rms = Math.sqrt(sumSquares / n)
  if (rms < 0.01) return 0

  const minLag = Math.max(2, Math.floor(sampleRate / MAX_PITCH_HZ))
  const maxLag = Math.min(n - 2, Math.floor(sampleRate / MIN_PITCH_HZ))

  let bestLag = -1
  let bestCorrelation = 0

  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0
    for (let i = 0; i < n - lag; i++) {
      correlation += samples[i] * samples[i + lag]
    }
    correlation /= n - lag
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation
      bestLag = lag
    }
  }

  return bestLag > 0 ? sampleRate / bestLag : 0
}

/** Weighted mean of the frequency spectrum — a stable timbre fingerprint. */
function computeSpectralCentroid(
  analyser: AnalyserNode,
  sampleRate: number,
  freqData: Uint8Array<ArrayBuffer>,
): number {
  analyser.getByteFrequencyData(freqData)
  const binCount = analyser.frequencyBinCount
  const nyquist = sampleRate / 2

  let weightedSum = 0
  let magnitudeSum = 0

  for (let i = 0; i < binCount; i++) {
    const magnitude = freqData[i]
    const frequency = (i * nyquist) / binCount
    weightedSum += frequency * magnitude
    magnitudeSum += magnitude
  }

  return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0
}

function computeFeatures(
  analyser: AnalyserNode,
  sampleRate: number,
  freqData: Uint8Array<ArrayBuffer>,
  timeData: Uint8Array<ArrayBuffer>,
): AudioFeatures {
  return {
    pitch: estimatePitch(analyser, sampleRate, timeData),
    spectralCentroid: computeSpectralCentroid(analyser, sampleRate, freqData),
  }
}

/** Normalized 0..1 distance between a stored profile and a live frame. */
function similarityScore(profile: VoiceProfile, features: AudioFeatures): number {
  const pitchDistance = Math.abs(profile.pitch - features.pitch) / PITCH_NORMALIZER_HZ
  const centroidDistance =
    Math.abs(profile.spectralCentroid - features.spectralCentroid) / CENTROID_NORMALIZER_HZ
  return Math.hypot(pitchDistance, centroidDistance) / Math.SQRT2
}

export function getVoiceProfile(): VoiceProfile | null {
  try {
    const raw = window.localStorage.getItem(VOICE_PROFILE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<VoiceProfile>
    if (typeof parsed.pitch !== 'number' || typeof parsed.spectralCentroid !== 'number') return null
    return {
      pitch: parsed.pitch,
      spectralCentroid: parsed.spectralCentroid,
      createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
    }
  } catch (error) {
    console.error('[audioProcessingService] Failed to read voice profile', error)
    return null
  }
}

export function saveVoiceProfile(profile: VoiceProfile): void {
  try {
    window.localStorage.setItem(VOICE_PROFILE_STORAGE_KEY, JSON.stringify(profile))
  } catch (error) {
    console.error('[audioProcessingService] Failed to save voice profile', error)
  }
}

export function clearVoiceProfile(): void {
  try {
    window.localStorage.removeItem(VOICE_PROFILE_STORAGE_KEY)
  } catch (error) {
    console.error('[audioProcessingService] Failed to clear voice profile', error)
  }
}

/** Captures a 5s mic sample, averages pitch + spectral centroid, and persists it. */
export async function recordVoiceSample(durationMs = 5000): Promise<VoiceProfile> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const audioContext = createAudioContext()
  const source = audioContext.createMediaStreamSource(stream)
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 2048
  source.connect(analyser)

  const freqData = new Uint8Array(analyser.frequencyBinCount)
  const timeData = new Uint8Array(analyser.fftSize)
  const startedAt = performance.now()

  let pitchTotal = 0
  let centroidTotal = 0
  let frameCount = 0

  await new Promise<void>((resolve) => {
    const tick = () => {
      if (performance.now() - startedAt >= durationMs) {
        resolve()
        return
      }
      const features = computeFeatures(analyser, audioContext.sampleRate, freqData, timeData)
      if (features.pitch > 0 && features.spectralCentroid > 0) {
        pitchTotal += features.pitch
        centroidTotal += features.spectralCentroid
        frameCount += 1
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

  source.disconnect()
  stream.getTracks().forEach((track) => track.stop())
  await audioContext.close()

  if (frameCount === 0) {
    throw new Error('No speech detected during the sample. Speak continuously for the full 5 seconds and try again.')
  }

  const profile: VoiceProfile = {
    pitch: pitchTotal / frameCount,
    spectralCentroid: centroidTotal / frameCount,
    createdAt: Date.now(),
  }

  saveVoiceProfile(profile)
  return profile
}

/**
 * Starts a live microphone analysis loop. For each energy-bearing frame it
 * compares the incoming audio against the stored profile and reports whether
 * the speaker is likely the user (isSelf) given the configured threshold.
 *
 * Returns a cleanup function that stops the stream and closes the audio graph.
 */
export async function startVoiceFilterMonitoring(
  profile: VoiceProfile,
  threshold: number,
  onClassification: (isSelf: boolean) => void,
): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const audioContext = createAudioContext()
  const source = audioContext.createMediaStreamSource(stream)
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 2048
  source.connect(analyser)

  const freqData = new Uint8Array(analyser.frequencyBinCount)
  const timeData = new Uint8Array(analyser.fftSize)

  let rafId = 0
  let stopped = false

  const tick = () => {
    if (stopped) return
    const features = computeFeatures(analyser, audioContext.sampleRate, freqData, timeData)
    if (features.pitch > 0 && features.spectralCentroid > 0) {
      onClassification(similarityScore(profile, features) <= threshold)
    }
    rafId = requestAnimationFrame(tick)
  }

  rafId = requestAnimationFrame(tick)

  return () => {
    stopped = true
    cancelAnimationFrame(rafId)
    source.disconnect()
    stream.getTracks().forEach((track) => track.stop())
    void audioContext.close()
  }
}
