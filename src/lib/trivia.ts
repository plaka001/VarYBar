// Trivia en vivo + ruleta.
// El primero que acierte en el chat gana 1 punto; al final hay ruleta y cada punto es una oportunidad.
// Todo el estado vive en una sola fila de Supabase (tabla `trivia`, columna `estado`).
// Estas funciones no tocan la red: reciben un estado y devuelven el siguiente, o un error para el máster.

export type FaseTrivia = 'inicio' | 'trivia' | 'ruleta' | 'ganador';
/** u = nick como se escribió, k = clave en minúsculas, p = puntos, t1 = cuándo hizo su primer punto */
export type Jugador = { u: string; k: string; p: number; t1: number };
/** Una pregunta jugada: quién la ganó (k = null: nadie acertó) */
export type Jugada = { q: number; k: string | null; u?: string };
export type Ganador = { u: string; k: string; p: number; pct: number };
/** Un giro de la ruleta: id nuevo en cada giro; phi = ángulo de la ruleta donde frena (cae dentro de la tajada del ganador) */
export type Giro = { id: string; phi: number; vueltas: number };

export type EstadoTrivia = {
  fase: FaseTrivia;
  pregunta: number;
  total: number;
  terminada: boolean;
  premio: string;
  partido: string;
  jug: Jugador[];
  hist: Jugada[];
  excluidos: string[];
  ganador: Ganador | null;
  giro: Giro | null;
};

export type Resultado = { e: EstadoTrivia; error?: undefined } | { e?: undefined; error: string };
/** Entero uniforme en [0, n) */
export type Azar = (n: number) => number;

export const MAX_PREGUNTAS = 20;
export const DUR_GIRO = 8200;
export const TAU = Math.PI * 2;

export function nuevaTrivia(base: Partial<Pick<EstadoTrivia, 'premio' | 'partido' | 'total'>> = {}): EstadoTrivia {
  return {
    fase: 'inicio',
    pregunta: 1,
    total: base.total ?? 10,
    terminada: false,
    premio: base.premio ?? 'Entrada doble',
    partido: base.partido ?? '',
    jug: [],
    hist: [],
    excluidos: [],
    ganador: null,
    giro: null,
  };
}

// ---------------------------------------------------------------- leer lo que viene de la base
const entero = (v: unknown, def: number, lo: number, hi: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : def;
const texto = (v: unknown, def = '') => (typeof v === 'string' ? v : def);

export function normalizar(x: unknown): EstadoTrivia {
  const b = nuevaTrivia();
  if (!x || typeof x !== 'object') return b;
  const o = x as Record<string, unknown>;
  const fases: FaseTrivia[] = ['inicio', 'trivia', 'ruleta', 'ganador'];
  const jug = Array.isArray(o.jug)
    ? (o.jug as Record<string, unknown>[])
        .filter((j) => j && typeof j.u === 'string' && typeof j.k === 'string')
        .map((j) => ({ u: j.u as string, k: j.k as string, p: entero(j.p, 0, 0, 999), t1: entero(j.t1, 0, 0, 9e15) }))
    : [];
  const hist = Array.isArray(o.hist)
    ? (o.hist as Record<string, unknown>[])
        .filter((h) => h && typeof h.q === 'number')
        .map((h) => ({ q: h.q as number, k: typeof h.k === 'string' ? h.k : null, ...(typeof h.u === 'string' ? { u: h.u } : {}) }))
    : [];
  const g = o.ganador as Record<string, unknown> | null;
  const gi = o.giro as Record<string, unknown> | null;
  const e: EstadoTrivia = {
    fase: fases.includes(o.fase as FaseTrivia) ? (o.fase as FaseTrivia) : 'inicio',
    pregunta: entero(o.pregunta, 1, 1, MAX_PREGUNTAS),
    total: entero(o.total, b.total, 1, MAX_PREGUNTAS),
    terminada: o.terminada === true,
    premio: texto(o.premio, b.premio),
    partido: texto(o.partido),
    jug,
    hist,
    excluidos: Array.isArray(o.excluidos) ? (o.excluidos as unknown[]).filter((k): k is string => typeof k === 'string') : [],
    ganador:
      g && typeof g === 'object' && typeof g.u === 'string' && typeof g.k === 'string'
        ? { u: g.u, k: g.k, p: entero(g.p, 0, 0, 999), pct: typeof g.pct === 'number' ? g.pct : 0 }
        : null,
    giro:
      gi && typeof gi === 'object' && typeof gi.id === 'string' && typeof gi.phi === 'number'
        ? { id: gi.id, phi: gi.phi, vueltas: entero(gi.vueltas, 6, 1, 20) }
        : null,
  };
  if (e.fase === 'ganador' && (!e.ganador || !e.giro)) e.fase = 'ruleta';
  return e;
}

// ---------------------------------------------------------------- lo que se calcula
export const activos = (e: EstadoTrivia) => e.jug.filter((j) => j.p > 0 && !e.excluidos.includes(j.k));
export const tickets = (e: EstadoTrivia) => activos(e).reduce((a, j) => a + j.p, 0);
/** Los de la ruleta, de más a menos puntos (empate: el que llegó primero) */
export const ranking = (e: EstadoTrivia) => activos(e).slice().sort((a, b) => b.p - a.p || a.t1 - b.t1);
export const pct = (p: number, T: number) => (T ? Math.round((p / T) * 1000) / 10 : 0);
export const pctTxt = (x: number) => `${String(x).replace('.', ',')}%`;
export const puntosTxt = (p: number) => (p === 1 ? '1 punto' : `${p} puntos`);

export type Porcion = { u: string; k: string; p: number; a0: number; a1: number };

/** Tajadas de la ruleta, en el orden en que cada uno hizo su primer punto. Cada una mide lo que valen sus puntos. */
export function porciones(e: EstadoTrivia): Porcion[] {
  const lista = activos(e);
  const T = lista.reduce((a, j) => a + j.p, 0);
  let a = 0;
  return lista.map((j) => {
    const a0 = a;
    a += (j.p / T) * TAU;
    return { u: j.u, k: j.k, p: j.p, a0, a1: a };
  });
}

/** La tajada que queda frente al puntero (a las 3 en punto) con la ruleta girada `rot` radianes */
export function bajoPuntero(pz: Porcion[], rot: number): Porcion | null {
  if (!pz.length) return null;
  const phi = (((-rot) % TAU) + TAU) % TAU;
  return pz.find((z) => phi >= z.a0 && phi < z.a1) ?? pz[pz.length - 1];
}

/** A dónde tiene que llegar la ruleta (desde `rot`, dando `vueltas` vueltas) para frenar con `phi` frente al puntero */
export function rotacionFinal(rot: number, phi: number, vueltas: number): number {
  const base = rot + vueltas * TAU;
  return -phi + TAU * Math.ceil((base + phi) / TAU);
}

/** Cada punto es un boleto: devuelve el índice del ganador */
export function eligePonderado(pesos: number[], azar: Azar): number {
  let r = azar(pesos.reduce((a, b) => a + b, 0));
  for (let i = 0; i < pesos.length; i++) {
    if (r < pesos[i]) return i;
    r -= pesos[i];
  }
  return pesos.length - 1;
}

/** Azar del navegador (criptográfico, parejo) */
export const azarCripto: Azar = (n) => {
  const buf = new Uint32Array(1);
  const lim = Math.floor(0x100000000 / n) * n;
  let x: number;
  do {
    globalThis.crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= lim);
  return x % n;
};

export const limpiarNick = (s: string) => s.trim().replace(/^@+/, '').replace(/\s+/g, '');

// ---------------------------------------------------------------- acciones del máster
const avanza = (e: EstadoTrivia) =>
  e.pregunta < e.total ? { pregunta: e.pregunta + 1, terminada: false } : { pregunta: e.pregunta, terminada: true };
const enPreguntas = (e: EstadoTrivia) => e.fase === 'inicio' || e.fase === 'trivia';

/** El que acertó primero: +1 y pasa a la siguiente pregunta */
export function darPunto(e: EstadoTrivia, nick: string, ahora = Date.now()): Resultado {
  const u = limpiarNick(nick);
  if (!u) return { error: 'Escribe el nick del que acertó' };
  if (u.length > 40) return { error: 'Ese nick está muy largo' };
  if (!enPreguntas(e)) return { error: 'Ya están en la ruleta. Para dar más puntos: «Volver a las preguntas»' };
  if (e.terminada) return { error: `Ya se hicieron las ${e.total} preguntas. Si quieren otra, suban el total.` };
  const k = u.toLowerCase();
  const previo = e.jug.find((j) => j.k === k);
  let jug: Jugador[];
  if (!previo) jug = [...e.jug, { u, k, p: 1, t1: ahora }];
  else if (previo.p === 0) jug = [...e.jug.filter((j) => j.k !== k), { u, k, p: 1, t1: ahora }];   // vuelve a entrar al final
  else jug = e.jug.map((j) => (j.k === k ? { ...j, p: j.p + 1 } : j));
  const nombre = jug.find((j) => j.k === k)!.u;
  return { e: { ...e, fase: 'trivia', jug, hist: [...e.hist, { q: e.pregunta, k, u: nombre }], ...avanza(e) } };
}

/** Nadie acertó: pasa a la siguiente sin punto */
export function siguiente(e: EstadoTrivia): Resultado {
  if (!enPreguntas(e)) return { error: 'Ya están en la ruleta' };
  if (e.terminada) return { error: 'Ya se hicieron todas las preguntas' };
  return { e: { ...e, fase: 'trivia', hist: [...e.hist, { q: e.pregunta, k: null }], ...avanza(e) } };
}

/** Quita lo último que se anotó (un punto o un «nadie acertó») y vuelve a esa pregunta */
export function deshacer(e: EstadoTrivia): Resultado {
  if (e.fase === 'ganador') return { error: 'Ya salió el ganador' };
  const h = e.hist[e.hist.length - 1];
  if (!h) return { error: 'No hay nada que deshacer' };
  const jug = h.k ? e.jug.map((j) => (j.k === h.k ? { ...j, p: Math.max(0, j.p - 1) } : j)) : e.jug;
  return { e: { ...e, fase: 'trivia', jug, hist: e.hist.slice(0, -1), pregunta: h.q, terminada: false, ganador: null } };
}

/** Le quita un punto a alguien (la última pregunta que ganó queda como «nadie acertó») */
export function menos(e: EstadoTrivia, k: string): Resultado {
  if (e.fase === 'ganador') return { error: 'Ya salió el ganador' };
  const j = e.jug.find((x) => x.k === k);
  if (!j || j.p <= 0) return { error: 'No tiene puntos' };
  let i = -1;
  for (let n = e.hist.length - 1; n >= 0; n--) if (e.hist[n].k === k) { i = n; break; }
  return {
    e: {
      ...e,
      jug: e.jug.map((x) => (x.k === k ? { ...x, p: x.p - 1 } : x)),
      hist: e.hist.map((h, n) => (n === i ? { q: h.q, k: null } : h)),
    },
  };
}

export function ponTotal(e: EstadoTrivia, n: number): Resultado {
  n = Math.round(n);
  if (!(n >= 1 && n <= MAX_PREGUNTAS)) return { error: `Entre 1 y ${MAX_PREGUNTAS} preguntas` };
  const hecha = e.hist.reduce((m, h) => Math.max(m, h.q), 0);   // última pregunta ya jugada
  const total = Math.max(n, hecha);
  let { pregunta, terminada } = e;
  if (terminada || pregunta > total) {
    if (hecha >= total) { terminada = true; pregunta = total; }
    else { terminada = false; pregunta = hecha + 1; }
  }
  return { e: { ...e, total, pregunta, terminada } };
}

export function ponPremio(e: EstadoTrivia, premio: string, partido: string): Resultado {
  return { e: { ...e, premio: premio.trim().slice(0, 80) || 'Entrada doble', partido: partido.trim().slice(0, 100) } };
}

/** Mostrar las reglas (inicio) o las preguntas (trivia) */
export function ponFase(e: EstadoTrivia, fase: 'inicio' | 'trivia'): Resultado {
  if (e.fase === 'ganador' && fase === 'inicio') return { error: 'Ya salió el ganador' };
  return { e: { ...e, fase, ganador: null } };
}

/** Se acabó la trivia: sale la ruleta con las oportunidades de cada uno */
export function aRuleta(e: EstadoTrivia): Resultado {
  if (!activos(e).length) return { error: 'Nadie tiene puntos todavía' };
  return { e: { ...e, fase: 'ruleta', ganador: null } };
}

/** Gira: el ganador sale aquí (cada punto es un boleto) y la ruleta frena en un punto al azar dentro de su tajada */
export function girar(e: EstadoTrivia, azar: Azar = azarCripto): Resultado {
  if (e.fase !== 'ruleta') return { error: 'Primero «Ir a la ruleta»' };
  const pz = porciones(e);
  if (!pz.length) return { error: 'No hay nadie en la ruleta' };
  const z = pz[eligePonderado(pz.map((x) => x.p), azar)];
  const phi = z.a0 + (0.18 + 0.64 * (azar(1_000_000) / 1_000_000)) * (z.a1 - z.a0);
  const giro: Giro = { id: `${Date.now().toString(36)}-${azar(1_000_000_000).toString(36)}`, phi, vueltas: 6 + azar(3) };
  return { e: { ...e, fase: 'ganador', ganador: { u: z.u, k: z.k, p: z.p, pct: pct(z.p, tickets(e)) }, giro } };
}

/** El ganador no sigue las redes: sale de la ruleta y se vuelve a girar */
export function otra(e: EstadoTrivia, azar: Azar = azarCripto): Resultado {
  if (e.fase !== 'ganador' || !e.ganador) return { error: 'Todavía no hay ganador' };
  const sin = { ...e, excluidos: [...e.excluidos, e.ganador.k], fase: 'ruleta' as const, ganador: null };
  if (!activos(sin).length) return { error: 'No queda nadie más en la ruleta' };
  return girar(sin, azar);
}

/** Vuelve a meter a la ruleta a alguien que habían sacado */
export function reincluir(e: EstadoTrivia, k: string): Resultado {
  if (e.fase === 'ganador') return { error: 'Ya salió el ganador' };
  return { e: { ...e, excluidos: e.excluidos.filter((x) => x !== k) } };
}

/** Todo en cero (se quedan el premio, el partido y el total de preguntas) */
export function reiniciar(e: EstadoTrivia): Resultado {
  return { e: nuevaTrivia({ premio: e.premio, partido: e.partido, total: e.total }) };
}
