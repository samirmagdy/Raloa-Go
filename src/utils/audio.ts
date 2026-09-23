export const SOUND_STORAGE_KEY = 'raloa_sound_enabled';

/**
 * Retrieve initial sound preference from localStorage.
 * Defaults to false (muted by default to respect user browsing privacy).
 */
export function getInitialSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const saved = localStorage.getItem(SOUND_STORAGE_KEY);
    return saved === 'true';
  } catch {
    return false;
  }
}

/**
 * Persist sound preference to localStorage.
 */
export function persistSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Graceful error handling for storage limits or strict private mode
  }
}

/**
 * Procedural ambient soundscape generator using Web Audio API.
 * Synthesizes a calming, warm, dreamy ambient harmonic drone (Fmaj9 / Am chord cluster)
 * with slow low-pass filter breathing and soft volume ramps.
 */
class AmbientSoundscapeEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private isPlaying: boolean = false;

  private initContext(): boolean {
    if (this.ctx && this.ctx.state !== 'closed') {
      return true;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();
      return true;
    } catch {
      return false;
    }
  }

  public async start(): Promise<void> {
    if (this.isPlaying) return;

    if (!this.initContext() || !this.ctx) return;

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        // Will resume on next user gesture
      }
    }

    const now = this.ctx.currentTime;

    // Master Gain for smooth fade-in / fade-out
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.0001, now);
    // Smooth fade in over 1.5 seconds to a soft, relaxing level
    this.masterGain.gain.exponentialRampToValueAtTime(0.07, now + 1.5);
    this.masterGain.connect(this.ctx.destination);

    // Warm resonant low-pass filter to keep sound lush and unobtrusive
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.setValueAtTime(320, now);
    this.filter.Q.setValueAtTime(1.8, now);
    this.filter.connect(this.masterGain);

    // Slow LFO for subtle, natural breathing movement
    try {
      this.lfo = this.ctx.createOscillator();
      this.lfo.type = 'sine';
      this.lfo.frequency.setValueAtTime(0.12, now); // ~8 second breathing cycle

      this.lfoGain = this.ctx.createGain();
      this.lfoGain.gain.setValueAtTime(110, now); // Modulate cutoff by +/- 110Hz

      this.lfo.connect(this.lfoGain);
      this.lfoGain.connect(this.filter.frequency);
      this.lfo.start(now);
    } catch {
      // LFO optional
    }

    // Harmonic chord cluster frequencies (warm Fmaj9 / Cmaj9 frequencies: F2, C3, A3, E4, G4)
    // with subtle detuning for stereo warmth
    const frequencies = [
      { freq: 87.31, type: 'sine' as OscillatorType, gain: 0.35, detune: -4 },  // F2 deep root
      { freq: 130.81, type: 'sine' as OscillatorType, gain: 0.28, detune: 3 },  // C3 fifth
      { freq: 220.00, type: 'triangle' as OscillatorType, gain: 0.18, detune: -6 }, // A3 major third
      { freq: 329.63, type: 'sine' as OscillatorType, gain: 0.14, detune: 5 },  // E4 major seventh
      { freq: 392.00, type: 'sine' as OscillatorType, gain: 0.10, detune: -2 }   // G4 ninth
    ];

    this.oscillators = [];

    for (const note of frequencies) {
      try {
        const osc = this.ctx.createOscillator();
        osc.type = note.type;
        osc.frequency.setValueAtTime(note.freq, now);
        osc.detune.setValueAtTime(note.detune, now);

        const voiceGain = this.ctx.createGain();
        voiceGain.gain.setValueAtTime(note.gain, now);

        osc.connect(voiceGain);
        voiceGain.connect(this.filter);

        osc.start(now);
        this.oscillators.push(osc);
      } catch {
        // Continue if single voice fails
      }
    }

    this.isPlaying = true;
  }

  public stop(): void {
    if (!this.isPlaying || !this.ctx || !this.masterGain) {
      this.isPlaying = false;
      return;
    }

    const now = this.ctx.currentTime;

    try {
      // Smooth fade out over 0.6 seconds to eliminate any clicks
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

      const oscs = [...this.oscillators];
      const lfo = this.lfo;

      setTimeout(() => {
        oscs.forEach((osc) => {
          try {
            osc.stop();
            osc.disconnect();
          } catch {
            // Ignore
          }
        });
        if (lfo) {
          try {
            lfo.stop();
            lfo.disconnect();
          } catch {
            // Ignore
          }
        }
      }, 700);
    } catch {
      // Fallback
    }

    this.oscillators = [];
    this.lfo = null;
    this.lfoGain = null;
    this.isPlaying = false;
  }

  public getStatus(): boolean {
    return this.isPlaying;
  }
}

export const ambientSound = new AmbientSoundscapeEngine();

/**
 * Synthesizes a joyous, sparkling multi-tone fanfare chime
 * to celebrate special milestones and secret Easter egg triggers.
 */
export function playCelebratoryFanfare(): void {
  if (typeof window === 'undefined') return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Ascending arpeggio frequencies (C5, E5, G5, B5, C6)
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];

    notes.forEach((freq, index) => {
      const startTime = now + index * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = index === notes.length - 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Envelope: swift attack, smooth decay
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.65);
    });

    // Clean up audio context after playback completes
    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        // Ignore
      }
    }, 1500);
  } catch {
    // Gracefully ignore audio permissions errors
  }
}
