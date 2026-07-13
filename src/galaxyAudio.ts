/**
 * محرك صوت خفيف للعبة الحركة.
 * لا يحمّل ملفات خارجية ولا يتداخل مع مشغّل المقالات والبودكاست.
 */
class GalaxyAudioEngine {
  private context: AudioContext | null = null

  private getContext() {
    if (typeof window === 'undefined') return null
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return null
    if (!this.context) this.context = new AudioContextCtor()
    if (this.context.state === 'suspended') void this.context.resume()
    return this.context
  }

  success() {
    const context = this.getContext()
    if (!context) return
    const now = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(520, now)
    oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.12)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.22)
  }

  speak(message: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.success()
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(message)
    utterance.lang = 'en-US'
    utterance.rate = 1.05
    utterance.pitch = 1.12
    utterance.volume = 0.82
    window.speechSynthesis.speak(utterance)
  }
}

export const audioEngine = new GalaxyAudioEngine()
