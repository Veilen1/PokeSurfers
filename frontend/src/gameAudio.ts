export type GameSound =
  | 'coin'
  | 'jump'
  | 'land'
  | 'slide'
  | 'crash'
  | 'powerup'
  | 'city'
  | 'gameover'
  | 'click'
  | 'select'

const SOUND_FILES: Record<GameSound, string> = {
  coin: 'coin.wav',
  jump: 'jump.wav',
  land: 'land.wav',
  slide: 'slide.wav',
  crash: 'crash.wav',
  powerup: 'powerup.wav',
  city: 'city.wav',
  gameover: 'gameover.wav',
  click: 'click.wav',
  select: 'select.wav',
}

const BASE_VOLUMES: Record<GameSound, number> = {
  coin: 0.34,
  jump: 0.42,
  land: 0.38,
  slide: 0.4,
  crash: 0.62,
  powerup: 0.55,
  city: 0.45,
  gameover: 0.5,
  click: 0.24,
  select: 0.3,
}

const MUTE_STORAGE_KEY = 'pokesurfers.muted'
const VOLUME_STORAGE_KEY = 'pokesurfers.volume'
const DEFAULT_VOLUME = 0.6

class GameAudio {
  private context: AudioContext | null = null
  private buffers = new Map<GameSound, AudioBuffer>()
  private pending = new Map<GameSound, Promise<AudioBuffer>>()
  private unlockPromise: Promise<void> | null = null
  private muted = false
  private masterVolume = DEFAULT_VOLUME

  constructor() {
    try {
      this.muted = window.localStorage.getItem(MUTE_STORAGE_KEY) === '1'
      const storedVolume = window.localStorage.getItem(VOLUME_STORAGE_KEY)
      if (storedVolume !== null) {
        const parsedVolume = Number(storedVolume)
        if (Number.isFinite(parsedVolume)) {
          this.masterVolume = Math.min(1, Math.max(0, parsedVolume))
        }
      }
    } catch {
      this.muted = false
    }
  }

  get isMuted(): boolean {
    return this.muted
  }

  get volume(): number {
    return this.masterVolume
  }

  setVolume(volume: number): void {
    this.masterVolume = Math.min(1, Math.max(0, volume))
    try {
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(this.masterVolume))
    } catch {
      // Storage can be unavailable in private mode; the session value still works.
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    try {
      window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0')
    } catch {
      // Storage can be unavailable in private mode; muting still works for the session.
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted)
    return this.muted
  }

  /** Must be called from a user gesture before the first sound can play. */
  unlock(): Promise<void> {
    if (this.unlockPromise) return this.unlockPromise

    this.unlockPromise = (async () => {
      if (!this.context) {
        const AudioContextClass =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AudioContextClass) return
        this.context = new AudioContextClass()
      }
      if (this.context.state === 'suspended') {
        try {
          await this.context.resume()
        } catch {
          // The browser may still refuse until the next gesture; play() retries.
        }
      }
      await Promise.all(
        (Object.keys(SOUND_FILES) as GameSound[]).map((name) =>
          this.load(name).catch(() => undefined),
        ),
      )
    })()

    return this.unlockPromise
  }

  play(name: GameSound, volume = 1, rate = 1, delay = 0): void {
    if (this.muted) return
    const context = this.context
    if (!context) {
      void this.unlock().then(() => this.play(name, volume, rate, delay))
      return
    }
    void this.load(name)
      .then((buffer) => {
        if (this.muted) return
        if (context.state === 'suspended') void context.resume()
        const source = context.createBufferSource()
        source.buffer = buffer
        source.playbackRate.value = rate
        const gain = context.createGain()
        gain.gain.value = BASE_VOLUMES[name] * volume * this.masterVolume
        source.connect(gain)
        gain.connect(context.destination)
        source.start(context.currentTime + Math.max(0, delay))
      })
      .catch(() => {
        // Missing audio should never break the run.
      })
  }

  private load(name: GameSound): Promise<AudioBuffer> {
    const cached = this.buffers.get(name)
    if (cached) return Promise.resolve(cached)
    const existing = this.pending.get(name)
    if (existing) return existing

    const context = this.context
    if (!context) return Promise.reject(new Error('Audio context is not ready.'))

    const baseUrl = import.meta.env.BASE_URL ?? '/'
    const request = fetch(`${baseUrl}game/audio/${SOUND_FILES[name]}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load ${name}: ${response.status}`)
        return response.arrayBuffer()
      })
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        this.buffers.set(name, buffer)
        this.pending.delete(name)
        return buffer
      })
      .catch((error) => {
        this.pending.delete(name)
        throw error
      })

    this.pending.set(name, request)
    return request
  }
}

export const gameAudio = new GameAudio()
