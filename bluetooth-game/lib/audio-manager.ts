export class AudioManager {
  private audioContext: AudioContext | null = null
  private enabled = true
  private masterVolume = 0.3

  constructor() {
    this.initializeAudioContext()
  }

  private initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (error) {
      console.warn("Web Audio API not supported:", error)
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  private createOscillator(frequency: number, type: OscillatorType = "sine"): OscillatorNode | null {
    if (!this.audioContext || !this.enabled) return null

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime)

    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)
    gainNode.gain.setValueAtTime(this.masterVolume, this.audioContext.currentTime)

    return oscillator
  }

  playLaserShot() {
    if (!this.audioContext || !this.enabled) return

    const oscillator = this.createOscillator(800, "sawtooth")
    if (!oscillator) return

    const gainNode = oscillator.context.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    const now = this.audioContext.currentTime
    gainNode.gain.setValueAtTime(0.1, now)
    oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.1)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1)

    oscillator.start(now)
    oscillator.stop(now + 0.1)
  }

  playExplosion() {
    if (!this.audioContext || !this.enabled) return

    // Create noise for explosion
    const bufferSize = this.audioContext.sampleRate * 0.5
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate)
    const output = buffer.getChannelData(0)

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1
    }

    const whiteNoise = this.audioContext.createBufferSource()
    whiteNoise.buffer = buffer

    const bandpass = this.audioContext.createBiquadFilter()
    bandpass.type = "bandpass"
    bandpass.frequency.value = 1000

    const gainNode = this.audioContext.createGain()
    const now = this.audioContext.currentTime

    whiteNoise.connect(bandpass)
    bandpass.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    gainNode.gain.setValueAtTime(0.3, now)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5)

    whiteNoise.start(now)
    whiteNoise.stop(now + 0.5)
  }

  playPowerUp() {
    if (!this.audioContext || !this.enabled) return

    const oscillator = this.createOscillator(440, "sine")
    if (!oscillator) return

    const gainNode = oscillator.context.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    const now = this.audioContext.currentTime
    gainNode.gain.setValueAtTime(0.1, now)
    oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.2)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2)

    oscillator.start(now)
    oscillator.stop(now + 0.2)
  }

  playGameStart() {
    if (!this.audioContext || !this.enabled) return

    // Play ascending notes
    const notes = [261.63, 329.63, 392.0, 523.25] // C, E, G, C

    notes.forEach((frequency, index) => {
      const oscillator = this.createOscillator(frequency, "triangle")
      if (!oscillator) return

      const gainNode = oscillator.context.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)

      const now = this.audioContext.currentTime
      const startTime = now + index * 0.15

      gainNode.gain.setValueAtTime(0.15, startTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3)

      oscillator.start(startTime)
      oscillator.stop(startTime + 0.3)
    })
  }

  playHit() {
    if (!this.audioContext || !this.enabled) return

    const oscillator = this.createOscillator(150, "square")
    if (!oscillator) return

    const gainNode = oscillator.context.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    const now = this.audioContext.currentTime
    gainNode.gain.setValueAtTime(0.2, now)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1)

    oscillator.start(now)
    oscillator.stop(now + 0.1)
  }

  playBoost() {
    if (!this.audioContext || !this.enabled) return

    const oscillator = this.createOscillator(300, "sine")
    if (!oscillator) return

    const gainNode = oscillator.context.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    const now = this.audioContext.currentTime
    gainNode.gain.setValueAtTime(0.1, now)
    oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.3)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3)

    oscillator.start(now)
    oscillator.stop(now + 0.3)
  }

  cleanup() {
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }
}
