import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import { REDES } from '../lib/config';
import { useTrivia, type FilaTrivia } from '../lib/datos';
import { sonidos } from '../lib/sonido';
import {
  activos,
  bajoPuntero,
  DUR_GIRO,
  pct,
  pctTxt,
  porciones,
  puntosTxt,
  ranking,
  rotacionFinal,
  TAU,
  tickets,
  type EstadoTrivia,
  type Giro,
  type Porcion,
} from '../lib/trivia';

// La trivia al aire (1920 × 1080). Respeta lo que tapa el lienzo de Reacción:
// cámara abajo a la derecha (nada a la derecha de x = 1180 pasa de y = 610), barra abajo y chat abajo a la izquierda.
const DIAMETRO = 610;

export default function VistaTrivia() {
  const { fila, estado } = useTrivia();
  if (!fila) {
    return <div className="aire-cargando">{estado === 'error' ? 'Conectando con la trivia…' : 'Cargando la trivia…'}</div>;
  }
  return <Trivia fila={fila} />;
}

type Toast = { u: string; q: number; p: number; n: number };

function Trivia({ fila }: { fila: FilaTrivia }) {
  const e = fila.estado;
  const pz = useMemo(() => porciones(e), [e]);
  const [girando, setGirando] = useState(false);
  const [vivo, setVivo] = useState<Porcion | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [fiesta, setFiesta] = useState(0);
  const [fuentes, setFuentes] = useState(false);

  const rueda = useRef<HTMLCanvasElement>(null);
  const rot = useRef(0);
  const anim = useRef<{ desde: number; hasta: number; inicio: number; dur: number } | null>(null);
  const pzRef = useRef(pz);
  const faseRef = useRef(e.fase);
  const previo = useRef<EstadoTrivia | null>(null);

  useLayoutEffect(() => {
    pzRef.current = pz;
    faseRef.current = e.fase;
  });

  useEffect(() => {
    void document.fonts.ready.then(() => setFuentes(true));
  }, []);

  function empezarGiro(g: Giro, dur: number) {
    const desde = rot.current;
    anim.current = { desde, hasta: rotacionFinal(desde, g.phi, g.vueltas), inicio: performance.now(), dur };
    setVivo(bajoPuntero(pzRef.current, desde));
    setGirando(true);
  }

  // Qué cambió desde lo último que llegó: punto, nadie acertó, ruleta, giro…
  useEffect(() => {
    const antes = previo.current;
    previo.current = e;
    if (!antes) {
      if (e.fase === 'ganador' && e.giro) {
        const pasado = Date.now() - Date.parse(fila.actualizado);
        if (pasado >= 0 && pasado < DUR_GIRO - 500) empezarGiro(e.giro, DUR_GIRO - pasado);   // se recargó a mitad del giro
        else rot.current = -e.giro.phi;   // la ruleta queda donde frenó
      }
      return;
    }
    if (e.fase === 'ganador' && e.giro && e.giro.id !== antes.giro?.id) {
      empezarGiro(e.giro, DUR_GIRO);
      return;
    }
    if (e.fase !== 'ganador' && anim.current) {
      anim.current = null;
      setGirando(false);
    }
    if (e.hist.length > antes.hist.length) {
      const h = e.hist[e.hist.length - 1];
      if (h.k) {
        const j = e.jug.find((x) => x.k === h.k);
        setToast({ u: j?.u ?? h.u ?? h.k, q: h.q, p: j?.p ?? 1, n: Date.now() });
        sonidos.punto();
      } else sonidos.salta();
    }
    if (e.fase === 'ruleta' && antes.fase !== 'ruleta') sonidos.pitazo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fila]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2900);
    return () => window.clearTimeout(t);
  }, [toast]);

  // La ruleta: vuelta suave mientras se juega, giro con freno al sortear
  useEffect(() => {
    let h = 0;
    let prev = performance.now();
    let ultimoK: string | null = null;
    let ultimoClic = 0;
    const paso = (t: number) => {
      const dt = Math.min(64, t - prev);
      prev = t;
      const a = anim.current;
      if (a) {
        const x = Math.min(1, (t - a.inicio) / a.dur);
        rot.current = a.desde + (a.hasta - a.desde) * (1 - Math.pow(1 - x, 4));
        const z = bajoPuntero(pzRef.current, rot.current);
        if (z && z.k !== ultimoK) {
          ultimoK = z.k;
          setVivo(z);
          if (t - ultimoClic > 45) {
            sonidos.clic();
            ultimoClic = t;
          }
        }
        if (x >= 1) {
          anim.current = null;
          ultimoK = null;
          rot.current = a.hasta % TAU;
          setGirando(false);
          sonidos.ganador();
          setFiesta((f) => f + 1);
        }
      } else if (faseRef.current !== 'ganador') rot.current += dt * 0.00018;
      if (rueda.current) rueda.current.style.transform = `rotate(${rot.current}rad)`;
      h = requestAnimationFrame(paso);
    };
    h = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(h);
  }, []);

  const resaltado = !girando && e.fase === 'ganador' ? (e.ganador?.k ?? null) : null;
  useEffect(() => {
    if (rueda.current) dibujar(rueda.current, pz, resaltado);
  }, [pz, resaltado, fuentes]);

  const fase = girando ? 'girando' : e.fase;
  const enRuleta = fase === 'ruleta' || fase === 'girando' || fase === 'ganador';
  const act = activos(e);
  const T = tickets(e);
  const rk = ranking(e);
  const g = e.ganador;
  const premio = e.premio + (e.partido ? ` · ${e.partido}` : '');

  return (
    <div className="vista entrar tv">
      <header className="cabeza">
        <div className="cabeza-izq">
          <div className="kicker">VAR y BAR · Sorteo en vivo</div>
          <div className="titulo-linea">
            <h1 className="titulo">
              LA <span>{enRuleta ? 'RULETA' : 'TRIVIA'}</span>
            </h1>
            <div className="sub tv-premio">{premio}</div>
          </div>
        </div>
        <div className="leyenda">
          <div className="chip acierto">
            <b>+1</b> El primero que acierte en el chat
          </div>
          <div className="chip pleno">
            <b>1 = 1</b> Cada punto es una oportunidad
          </div>
        </div>
      </header>

      <aside className="tv-redes">
        <div className="tv-redes-tit">Síguenos</div>
        {REDES.map((r) => (
          <div className="tv-qr" key={r.nombre} data-url={r.url}>
            <Qr url={r.url} />
            <div>
              <b>{r.nombre}</b>
              <small>{r.muestra}</small>
            </div>
          </div>
        ))}
      </aside>

      <div className={`tv-caja f-${fase}`}>
        <canvas ref={rueda} className="tv-rueda" width={DIAMETRO * 2} height={DIAMETRO * 2} />
        <div className="tv-aro" />
        <Luces />
        <div className="tv-centro">
          <div>
            <div className="tv-neon">
              VAR<i>y</i>BAR
            </div>
            <small>
              {fase === 'inicio'
                ? 'TRIVIA'
                : fase === 'trivia'
                  ? e.terminada
                    ? '¡A LA RULETA!'
                    : `PREGUNTA ${e.pregunta}`
                  : fase === 'ganador'
                    ? '¡GANADOR!'
                    : '¡A GIRAR!'}
            </small>
          </div>
        </div>
        <svg className="tv-puntero" viewBox="0 0 92 68" aria-hidden="true">
          <path d="M4 34 L84 6 Q92 4 90 12 L90 56 Q92 64 84 62 Z" fill="#E9A23B" stroke="#FFE3A8" strokeWidth="3" />
          <circle cx="72" cy="34" r="8" fill="#0B0F11" />
        </svg>
      </div>

      <section className="tv-panel">
        <div className={`tv-estado ${fase === 'inicio' ? 'on' : ''}`}>
          <div className="tv-tit">¿Cómo se juega?</div>
          <ol className="tv-pasos">
            <li>
              <b>1</b>
              <span>
                Síguenos en <strong>Instagram, TikTok, YouTube y Kick</strong>: los QR están a la izquierda.
              </span>
            </li>
            <li>
              <b>2</b>
              <span>
                Hacemos <strong>{e.total} preguntas</strong>. El <strong>primero</strong> que responda bien en el chat gana{' '}
                <strong>1 punto</strong>.
              </span>
            </li>
            <li>
              <b>3</b>
              <span>
                Al final, ruleta: <strong>cada punto es una oportunidad</strong>. Más puntos, más chance.
              </span>
            </li>
          </ol>
        </div>

        <div className={`tv-estado ${fase === 'trivia' ? 'on' : ''}`}>
          <div className="tv-tit verde">Trivia · responde en el chat</div>
          <div className={`tv-preg ${e.terminada ? 'listo' : ''}`}>
            <span className="lbl">{e.terminada ? '¡LISTO!' : 'PREGUNTA'}</span>
            <span className="num">{e.terminada ? e.total : e.pregunta}</span>
            <span className="de">/{e.total}</span>
          </div>
          <div className={`tv-puntos ${e.total > 14 ? 'chicos' : ''}`}>
            {Array.from({ length: e.total }, (_, i) => {
              const h = e.hist.filter((x) => x.q === i + 1).pop();
              const c = h ? (h.k ? 'hecha' : 'saltada') : i + 1 === e.pregunta && !e.terminada ? 'actual' : '';
              return <i key={i} className={c} />;
            })}
          </div>
          <div className="tv-regla">
            {e.terminada ? (
              <>
                <b>¡Se acabaron las preguntas!</b> Ahora, la ruleta
              </>
            ) : (
              <>
                El primero que acierte gana <b>1 punto</b> · cada punto es <b>1 oportunidad</b>
              </>
            )}
          </div>
          <div className="tv-tabla">
            {rk.length === 0 ? (
              <div className="vacio-t">Todavía nadie tiene puntos. ¡Pilas con la primera!</div>
            ) : (
              rk.slice(0, 10).map((j, i) => (
                <div key={j.k} className={`fila ${toast && toast.u.toLowerCase() === j.k ? 'ultimo' : ''}`}>
                  <span className="pos">{i + 1}</span>
                  <span className="nick">{j.u}</span>
                  <span key={j.p} className="pts pop">
                    {j.p}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={`tv-estado ${fase === 'ruleta' ? 'on' : ''}`}>
          <div className="tv-tit verde">Se acabó la trivia · ¡a la ruleta!</div>
          <div className="tv-grande">
            <b>{act.length}</b>
            <span>
              {act.length === 1 ? 'hincha' : 'hinchas'} · {T} {T === 1 ? 'oportunidad' : 'oportunidades'}
            </span>
          </div>
          <div className="tv-chances">
            {rk.slice(0, 6).map((j) => (
              <div className="fila" key={j.k}>
                <span className="barra" style={{ width: `${pct(j.p, T)}%` }} />
                <span className="nick">{j.u}</span>
                <span className="det">
                  <b>{puntosTxt(j.p)}</b> · {pctTxt(pct(j.p, T))}
                </span>
              </div>
            ))}
            {act.length > 6 && <div className="mas">y {act.length - 6} más en la ruleta</div>}
          </div>
        </div>

        <div className={`tv-estado ${fase === 'girando' ? 'on' : ''}`}>
          <div className="tv-tit">Girando…</div>
          <Ajustado className="tv-nombre" texto={vivo?.u ?? '—'} />
          <div className="tv-vivo-pts">{vivo ? puntosTxt(vivo.p) : ''}</div>
        </div>

        <div className={`tv-estado ${fase === 'ganador' ? 'on' : ''}`}>
          <div className="tv-tit verde">¡Tenemos ganador!</div>
          {g && fase === 'ganador' && (
            <>
              <Ajustado key={e.giro?.id} className="tv-nombre oro" texto={g.u} />
              <div className="tv-linea">
                Con <b>{puntosTxt(g.p)}</b> tenía el <b>{pctTxt(g.pct)}</b> de opciones
              </div>
              <div className="tv-linea">
                Se lleva: <b>{premio}</b>
              </div>
              <div className="tv-verifica">👀 Revisemos que nos siga en las redes</div>
            </>
          )}
        </div>

        {toast && (
          <div key={toast.n} className="tv-toast">
            <div className="t1">¡Punto!</div>
            <Ajustado className="t2" texto={toast.u} max={600} grande={104} chico={48} />
            <div className="t3">
              Pregunta {toast.q} · ahora tiene <b>{puntosTxt(toast.p)}</b>
            </div>
          </div>
        )}
      </section>

      <Confeti disparo={fiesta} />
    </div>
  );
}

// ---------------------------------------------------------------- piezas
const PALETA: [string, string][] = [
  ['#E9A23B', '#1D1305'],
  ['#16262C', '#F2EADB'],
  ['#F2EADB', '#14100A'],
  ['#123A27', '#F2EADB'],
  ['#7CFFA6', '#06210F'],
];
const colorDe = (i: number, n: number) => PALETA[n > 1 && i === n - 1 && i % 4 === 0 ? 4 : i % 4];

function dibujar(c: HTMLCanvasElement, pz: Porcion[], resaltado: string | null) {
  const g = c.getContext('2d');
  if (!g) return;
  const W = c.width;
  const R = W / 2 - 4;
  g.clearRect(0, 0, W, W);
  g.save();
  g.translate(W / 2, W / 2);
  if (!pz.length) {
    for (let i = 0; i < 16; i++) {
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, R, (i * TAU) / 16, ((i + 1) * TAU) / 16);
      g.closePath();
      g.fillStyle = i % 2 ? '#141C20' : '#1C262B';
      g.fill();
    }
  } else {
    pz.forEach((z, i) => {
      const [fondo, tinta] = colorDe(i, pz.length);
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, R, z.a0, z.a1);
      g.closePath();
      g.fillStyle = fondo;
      g.fill();
      if (pz.length > 1) {
        g.strokeStyle = 'rgba(7,10,11,.55)';
        g.lineWidth = 3;
        g.stroke();
      }
      const fuente = Math.min(50, Math.floor((z.a1 - z.a0) * (R - 130) * 0.5));
      if (fuente >= 14) {
        g.save();
        g.rotate((z.a0 + z.a1) / 2);
        g.fillStyle = tinta;
        g.textAlign = 'right';
        g.textBaseline = 'middle';
        g.font = `800 ${fuente}px 'Big Shoulders Display', 'Arial Narrow', sans-serif`;
        const cola = ` · ${z.p}`;
        const max = R - 240 - g.measureText(cola).width;
        let txt = z.u;
        while (txt.length > 3 && g.measureText(txt).width > max) txt = txt.slice(0, -1);
        if (txt !== z.u) txt = `${txt.slice(0, -1)}…`;
        g.fillText(txt + cola, R - 34, 2);
        g.restore();
      }
    });
    const z = resaltado ? pz.find((x) => x.k === resaltado) : undefined;
    if (z) {
      g.beginPath();
      if (pz.length > 1) {
        g.moveTo(0, 0);
        g.arc(0, 0, R, z.a0, z.a1);
        g.closePath();
      } else g.arc(0, 0, R - 6, 0, TAU);   // una sola tajada: solo el borde
      g.lineWidth = 12;
      g.strokeStyle = '#7CFFA6';
      g.shadowColor = '#7CFFA6';
      g.shadowBlur = 30;
      g.stroke();
      g.shadowBlur = 0;
    }
  }
  g.beginPath();
  g.arc(0, 0, 196, 0, TAU);
  g.fillStyle = 'rgba(7,10,11,.35)';
  g.fill();
  g.restore();
}

function Luces() {
  const r = DIAMETRO / 2 + 8;
  return (
    <div className="tv-luces">
      {Array.from({ length: 36 }, (_, i) => {
        const a = (i / 36) * TAU;
        return (
          <i
            key={i}
            style={{
              left: DIAMETRO / 2 + r * Math.cos(a),
              top: DIAMETRO / 2 + r * Math.sin(a),
              animationDelay: `${-(i % 2) * 0.6}s`,
            }}
          />
        );
      })}
    </div>
  );
}

function Qr({ url }: { url: string }) {
  const d = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(url);
    q.make();
    const n = q.getModuleCount();
    let p = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) p += `M${c} ${r}h1v1h-1z`;
    return { n, p };
  }, [url]);
  return (
    <svg className="tv-qr-codigo" viewBox={`-1 -1 ${d.n + 2} ${d.n + 2}`} shapeRendering="crispEdges" aria-label={url}>
      <path d={d.p} fill="#141414" />
    </svg>
  );
}

/** Texto en una línea que achica la letra hasta que quepa */
function Ajustado({
  texto,
  className,
  max = 648,
  grande = 112,
  chico = 52,
}: {
  texto: string;
  className: string;
  max?: number;
  grande?: number;
  chico?: number;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const txt = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const medir = () => {
      const c = caja.current;
      const t = txt.current;
      if (!c || !t) return;
      let f = grande;
      c.style.fontSize = `${f}px`;
      while (f > chico && t.offsetWidth > max) {
        f -= 4;
        c.style.fontSize = `${f}px`;
      }
    };
    medir();
    let vivo = true;
    void document.fonts.ready.then(() => vivo && medir());
    return () => {
      vivo = false;
    };
  }, [texto, max, grande, chico]);
  return (
    <div ref={caja} className={className}>
      <span ref={txt}>{texto}</span>
    </div>
  );
}

function Confeti({ disparo }: { disparo: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const g = c?.getContext('2d');
    if (!disparo || !c || !g) return;
    const col = ['#E9A23B', '#F2EADB', '#7CFFA6', '#FFE08A', '#FF6B5E'];
    let piezas = Array.from({ length: 240 }, (_, i) => ({
      x: 960 + (Math.random() - 0.5) * 1700,
      y: -40 - Math.random() * 500,
      vx: (Math.random() - 0.5) * 4,
      vy: 3 + Math.random() * 5,
      w: 8 + Math.random() * 10,
      h: 5 + Math.random() * 7,
      r: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.3,
      c: col[i % col.length],
    }));
    let h = 0;
    const cae = () => {
      g.clearRect(0, 0, 1920, 1080);
      piezas = piezas.filter((p) => p.y < 1120);
      for (const p of piezas) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.r += p.vr;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.r);
        g.fillStyle = p.c;
        g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        g.restore();
      }
      if (piezas.length) h = requestAnimationFrame(cae);
    };
    h = requestAnimationFrame(cae);
    return () => {
      cancelAnimationFrame(h);
      g.clearRect(0, 0, 1920, 1080);
    };
  }, [disparo]);
  return <canvas ref={ref} className="tv-confeti" width={1920} height={1080} />;
}
