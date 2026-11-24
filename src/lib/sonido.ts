// Sonidos de la trivia, hechos con el navegador (sin archivos).
// En OBS suenan si la fuente tiene marcado "Controlar audio a través de OBS".
const VOLUMEN = 0.7;
let actx: AudioContext | null = null;

function ctx(): AudioContext | null {
  try {
    actx = actx ?? new AudioContext();
    if (actx.state === 'suspended') void actx.resume();
    return actx;
  } catch {
    return null;
  }
}

function bip(c: AudioContext, t: number, f: number, dur: number, vol: number, tipo: OscillatorType = 'square') {
  const o = c.createOscillator();
  const g = c.createGain();
  const lp = c.createBiquadFilter();
  o.type = tipo;
  o.frequency.value = f;
  lp.type = 'lowpass';
  lp.frequency.value = 3600;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol * VOLUMEN, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp);
  lp.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** Pitazo de árbitro */
function pitazo(c: AudioContext, dur: number) {
  const t = c.currentTime + 0.03;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(0.42 * VOLUMEN, t + 0.03);
  out.gain.setValueAtTime(0.42 * VOLUMEN, t + dur - 0.09);
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  out.connect(c.destination);
  const lfo = c.createOscillator();
  lfo.frequency.value = 33;
  for (const [f, dev, amp] of [[3150, 140, 1], [6300, 280, 0.25]]) {
    const o = c.createOscillator();
    const g = c.createGain();
    const lg = c.createGain();
    o.frequency.setValueAtTime(f * 0.94, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    lg.gain.value = dev;
    lfo.connect(lg);
    lg.connect(o.frequency);
    g.gain.value = amp;
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  lfo.start(t);
  lfo.stop(t + dur + 0.02);
}

const con = (fn: (c: AudioContext) => void) => () => {
  const c = ctx();
  if (!c) return;
  try {
    fn(c);
  } catch {
    /* sin sonido */
  }
};

export const sonidos = {
  punto: con((c) => {
    const t = c.currentTime + 0.02;
    bip(c, t, 988, 0.1, 0.2);
    bip(c, t + 0.1, 1319, 0.1, 0.2);
    bip(c, t + 0.2, 1976, 0.28, 0.2);
  }),
  salta: con((c) => {
    bip(c, c.currentTime + 0.02, 660, 0.12, 0.14);
    bip(c, c.currentTime + 0.16, 494, 0.18, 0.14);
  }),
  clic: con((c) => bip(c, c.currentTime + 0.005, 2300, 0.025, 0.07, 'triangle')),
  pitazo: con((c) => pitazo(c, 0.45)),
  ganador: con((c) => {
    pitazo(c, 0.7);
    const t = c.currentTime + 0.8;
    [523, 659, 784, 1047].forEach((f, i) => bip(c, t + i * 0.12, f, 0.35, 0.16, 'sawtooth'));
    [523, 659, 784].forEach((f) => bip(c, t + 0.55, f, 0.9, 0.1, 'sawtooth'));
  }),
};
