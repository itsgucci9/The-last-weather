// Procedural ambience: wind, a low drone, engine rumble and radio static, synthesised with the
// Web Audio API. No audio files and nothing downloaded. Sound only starts after a tap or key
// press (browser autoplay rules), pauses when the app is in the background, and the random
// static bursts are atmosphere only: they never touch game state.

export const MOODS = ['wind', 'interior', 'storm', 'launch', 'space', 'shelter', 'relay', 'field'] as const;
export type Mood = (typeof MOODS)[number];

interface Mix {
  wind: number; // wind loudness
  tone: number; // wind filter centre (Hz): lower = more muffled
  gust: number; // how far gusts sweep the filter (Hz)
  drone: number; // low synth pad
  rumble: number; // engine / thunder bed
  crackle: number; // electrical static bursts per ~10 s
}

const MIX: Record<Mood, Mix> = {
  wind: { wind: 0.3, tone: 520, gust: 260, drone: 0.05, rumble: 0, crackle: 0 },
  interior: { wind: 0.08, tone: 260, gust: 60, drone: 0.07, rumble: 0, crackle: 0 },
  storm: { wind: 0.42, tone: 820, gust: 480, drone: 0.06, rumble: 0.07, crackle: 1.2 },
  launch: { wind: 0.2, tone: 640, gust: 300, drone: 0.08, rumble: 0.35, crackle: 0.4 },
  space: { wind: 0, tone: 300, gust: 0, drone: 0.1, rumble: 0.03, crackle: 0 },
  shelter: { wind: 0.12, tone: 200, gust: 50, drone: 0.06, rumble: 0.05, crackle: 0.5 },
  relay: { wind: 0.04, tone: 180, gust: 30, drone: 0.11, rumble: 0.02, crackle: 0.3 }, // cold interior hum
  field: { wind: 0.2, tone: 1400, gust: 600, drone: 0.05, rumble: 0.12, crackle: 1.5 }, // grit hiss on the hull
};

const VOLUME = 0.5;

export function isMood(value: unknown): value is Mood {
  return typeof value === 'string' && (MOODS as readonly string[]).includes(value);
}

interface Graph {
  ctx: BaseAudioContext;
  noise: AudioBuffer;
  master: GainNode;
  wind: GainNode;
  windFilter: BiquadFilterNode;
  gustDepth: GainNode;
  swellDepth: GainNode;
  drone: GainNode;
  rumble: GainNode;
}

function makeNoise(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function build(ctx: BaseAudioContext): Graph {
  const noise = makeNoise(ctx);
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const loop = () => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    return src;
  };

  // Wind: noise through a band-pass whose centre is swept slowly (gusts) and whose level swells.
  const windSrc = loop();
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.Q.value = 0.8;
  const wind = ctx.createGain();
  wind.gain.value = 0;
  windSrc.connect(windFilter).connect(wind).connect(master);
  const gustLfo = ctx.createOscillator();
  gustLfo.frequency.value = 0.09;
  const gustDepth = ctx.createGain();
  gustLfo.connect(gustDepth).connect(windFilter.frequency);
  const swellLfo = ctx.createOscillator();
  swellLfo.frequency.value = 0.053;
  const swellDepth = ctx.createGain();
  swellLfo.connect(swellDepth).connect(wind.gain);

  // Drone: two soft sines a fifth apart, slightly detuned.
  const drone = ctx.createGain();
  drone.gain.value = 0;
  const droneFilter = ctx.createBiquadFilter();
  droneFilter.type = 'lowpass';
  droneFilter.frequency.value = 400;
  drone.connect(droneFilter).connect(master);
  for (const [freq, detune] of [
    [55, -4],
    [82.4, 5],
  ]) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(drone);
    osc.start();
  }

  // Rumble: deep low-passed noise (engine, distant thunder).
  const rumbleSrc = loop();
  const rumbleFilter = ctx.createBiquadFilter();
  rumbleFilter.type = 'lowpass';
  rumbleFilter.frequency.value = 110;
  const rumble = ctx.createGain();
  rumble.gain.value = 0;
  rumbleSrc.connect(rumbleFilter).connect(rumble).connect(master);

  windSrc.start();
  rumbleSrc.start();
  gustLfo.start();
  swellLfo.start();
  return { ctx, noise, master, wind, windFilter, gustDepth, swellDepth, drone, rumble };
}

function setMix(g: Graph, mood: Mood, on: boolean, seconds: number) {
  const m = MIX[mood];
  const t = g.ctx.currentTime;
  const k = Math.max(0.01, seconds / 3);
  g.master.gain.setTargetAtTime(on ? VOLUME : 0, t, k);
  g.wind.gain.setTargetAtTime(m.wind, t, k);
  g.swellDepth.gain.setTargetAtTime(m.wind * 0.35, t, k);
  g.windFilter.frequency.setTargetAtTime(m.tone, t, k);
  g.gustDepth.gain.setTargetAtTime(m.gust, t, k);
  g.drone.gain.setTargetAtTime(m.drone, t, k);
  g.rumble.gain.setTargetAtTime(m.rumble, t, k);
}

/** A short burst of radio static (MICA's voice channel, electrical arcs). */
function burst(g: Graph, at: number, level: number, length: number, cutoff: number) {
  const src = g.ctx.createBufferSource();
  src.buffer = g.noise;
  const filter = g.ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = cutoff;
  const gain = g.ctx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(level, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  src.connect(filter).connect(gain).connect(g.master);
  src.start(at, Math.random() * 1.5, length + 0.05);
}

class Ambience {
  private graph: Graph | null = null;
  private enabled = false;
  private mood: Mood = 'wind';

  get supported(): boolean {
    return typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window);
  }

  private get live(): boolean {
    return this.enabled && !!this.graph && (this.graph.ctx as AudioContext).state === 'running';
  }

  /** Call from a tap, click or key handler: browsers only start audio inside a user gesture. */
  unlock(): void {
    if (!this.enabled || !this.supported) return;
    try {
      if (!this.graph) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.graph = build(new Ctx());
        document.addEventListener('visibilitychange', () => {
          const ctx = this.graph?.ctx as AudioContext | undefined;
          if (!ctx) return;
          if (document.hidden) void ctx.suspend().catch(() => {});
          else if (this.enabled) void ctx.resume().catch(() => {});
        });
        setInterval(() => this.maybeCrackle(), 1000);
      }
      const ctx = this.graph.ctx as AudioContext;
      if (ctx.state !== 'running') void ctx.resume().catch(() => {});
      setMix(this.graph, this.mood, true, 1.5);
    } catch {
      /* audio unavailable: the game is fully playable without it */
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!this.graph) return;
    if (on) this.unlock();
    else setMix(this.graph, this.mood, false, 0.4);
  }

  setMood(mood: Mood): void {
    this.mood = mood;
    if (this.graph) setMix(this.graph, mood, this.enabled, 2.5);
  }

  /** MICA's radio channel opening. */
  radio(): void {
    if (!this.live || !this.graph) return;
    const t = this.graph.ctx.currentTime + 0.05;
    burst(this.graph, t, 0.12, 0.25, 2200);
    burst(this.graph, t + 0.32, 0.07, 0.12, 3000);
  }

  /** Soft confirmation when a choice is made. */
  tap(): void {
    if (!this.live || !this.graph) return;
    const { ctx, master } = this.graph;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.08);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  private maybeCrackle() {
    if (!this.live || !this.graph) return;
    const rate = MIX[this.mood].crackle;
    if (rate > 0 && Math.random() < rate / 10) burst(this.graph, this.graph.ctx.currentTime + 0.02, 0.05 + Math.random() * 0.05, 0.08 + Math.random() * 0.25, 1500);
  }

  /** Renders a few seconds of a mood offline and reports its level (used by the QA checks). */
  async measure(mood: Mood, seconds = 4): Promise<{ rms: number; peak: number }> {
    const ctx = new OfflineAudioContext(1, 44100 * seconds, 44100);
    const g = build(ctx);
    setMix(g, mood, true, 0.03);
    const data = (await ctx.startRendering()).getChannelData(0);
    let sum = 0;
    let peak = 0;
    for (let i = 44100; i < data.length; i += 1) {
      sum += data[i] * data[i];
      peak = Math.max(peak, Math.abs(data[i]));
    }
    return { rms: Math.sqrt(sum / (data.length - 44100)), peak };
  }
}

export const ambience = new Ambience();
