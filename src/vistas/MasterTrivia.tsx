import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTrivia, type EstadoConexion } from '../lib/datos';
import { llamar, MENSAJES } from '../lib/supabase';
import {
  aRuleta,
  darPunto,
  deshacer,
  DUR_GIRO,
  girar,
  limpiarNick,
  MAX_PREGUNTAS,
  menos,
  otra,
  pct,
  pctTxt,
  ponFase,
  ponPremio,
  ponTotal,
  puntosTxt,
  ranking,
  reincluir,
  reiniciar,
  siguiente,
  tickets,
  type EstadoTrivia,
  type Resultado,
} from '../lib/trivia';

type Aviso = { t: string; tipo: 'ok' | 'error' } | null;

export default function MasterTrivia({
  pin,
  onSalir,
  enAire,
  ponerAlAire,
}: {
  pin: string;
  onSalir: (motivo?: string) => void;
  enAire: boolean;
  ponerAlAire: () => Promise<string | null>;
}) {
  const { fila, estado, recargar, aceptar } = useTrivia();
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [nick, setNick] = useState('');
  const entrada = useRef<HTMLInputElement>(null);

  // Mientras la ruleta gira en el stream, aquí tampoco se ve el ganador (para no cantarlo antes)
  const e = fila?.estado;
  const giroId = e?.fase === 'ganador' ? (e.giro?.id ?? null) : null;
  const cargado = !!fila;
  const visto = useRef<string | null | undefined>(undefined);
  const [girandoId, setGirandoId] = useState<string | null>(null);
  useEffect(() => {
    if (!cargado) return;
    if (visto.current === undefined) {
      visto.current = giroId;
      return;
    }
    if (!giroId || giroId === visto.current) return;
    visto.current = giroId;
    setGirandoId(giroId);
    const t = window.setTimeout(() => setGirandoId((id) => (id === giroId ? null : id)), DUR_GIRO);
    return () => window.clearTimeout(t);
  }, [cargado, giroId]);
  const girando = !!giroId && girandoId === giroId;

  async function hacer(fn: (x: EstadoTrivia) => Resultado, exito?: (x: EstadoTrivia) => string) {
    if (!fila || ocupado) return false;
    const r = fn(fila.estado);
    if (r.error !== undefined) {
      setAviso({ t: r.error, tipo: 'error' });
      return false;
    }
    setOcupado(true);
    setAviso(null);
    try {
      const res = await llamar('guardar_trivia', { p_pin: pin, p_estado: r.e, p_version: fila.version });
      if (res === 'ok') {
        aceptar({ estado: r.e, version: fila.version + 1, actualizado: new Date().toISOString() });
        if (exito) setAviso({ t: exito(r.e), tipo: 'ok' });
        return true;
      }
      if (res === 'pin_incorrecto' || res === 'sin_pin') onSalir(MENSAJES[res]);
      if (res === 'conflicto') await recargar();
      setAviso({ t: MENSAJES[res] ?? res, tipo: 'error' });
      return false;
    } catch {
      setAviso({ t: 'Sin conexión: no se guardó', tipo: 'error' });
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function punto(n: string, ev?: FormEvent) {
    ev?.preventDefault();
    const quien = limpiarNick(n);
    const listo = await hacer(
      (x) => darPunto(x, quien),
      (x) => `✓ +1 para ${x.hist[x.hist.length - 1]?.u ?? quien} (pregunta ${x.hist[x.hist.length - 1]?.q}). ${x.terminada ? 'Era la última.' : `Sigue la ${x.pregunta}.`}`,
    );
    if (listo) {
      setNick('');
      entrada.current?.focus();
    }
  }

  if (!fila || !e) {
    return <p className="m-suave">{estado === 'error' ? 'Sin conexión con la trivia…' : 'Cargando la trivia…'}</p>;
  }

  const rk = ranking(e);
  const T = tickets(e);
  const fuera = e.jug.filter((j) => j.p > 0 && e.excluidos.includes(j.k));
  const enPreguntas = e.fase === 'inicio' || e.fase === 'trivia';
  const ultima = e.hist[e.hist.length - 1];
  const nombreDe = (k: string | null) => (k ? (e.jug.find((j) => j.k === k)?.u ?? k) : null);

  return (
    <section className="mt">
      <div className="m-tarjeta mt-cab">
        <div>
          <div className="mt-fase">
            {e.fase === 'inicio' && 'En pantalla: cómo se juega'}
            {e.fase === 'trivia' && (e.terminada ? `Se acabaron las ${e.total} preguntas` : `Pregunta ${e.pregunta} de ${e.total}`)}
            {e.fase === 'ruleta' && 'En pantalla: la ruleta con las oportunidades'}
            {e.fase === 'ganador' && (girando ? 'Girando la ruleta…' : 'Ya salió el ganador')}
          </div>
          <div className="mt-premio">
            {e.premio}
            {e.partido ? ` · ${e.partido}` : ''}
          </div>
        </div>
        <div className="mt-cab-der">
          <Conexion estado={estado} />
          {enAire ? (
            <span className="mt-al-aire">
              <i className="punto-vivo" /> Al aire
            </span>
          ) : (
            <button
              className="m-boton chico"
              disabled={ocupado}
              onClick={async () => {
                const err = await ponerAlAire();
                setAviso(err ? { t: err, tipo: 'error' } : { t: '✓ La trivia ya está al aire', tipo: 'ok' });
              }}
            >
              Poner la trivia al aire
            </button>
          )}
        </div>
      </div>

      {aviso && <p className={`mt-aviso ${aviso.tipo}`}>{aviso.t}</p>}

      {/* ---------- lo que toca hacer ahora */}
      {enPreguntas && !e.terminada && (
        <div className="m-tarjeta mt-accion">
          <div className="mt-grande">
            Pregunta <b>{e.pregunta}</b> <span>de {e.total}</span>
          </div>
          {e.fase === 'inicio' && (
            <p className="m-ayuda mt-ayuda-ini">
              En pantalla salen las reglas y los QR. Cuando arranquen, toquen «Empezar» (o den el primer punto).
            </p>
          )}
          <form className="mt-punto" onSubmit={(ev) => void punto(nick, ev)}>
            <label className="mt-label" htmlFor="mt-nick">
              ¿Quién acertó primero? (nick del chat)
            </label>
            <div className="mt-punto-fila">
              <input
                id="mt-nick"
                ref={entrada}
                list="mt-nicks"
                value={nick}
                onChange={(ev) => setNick(ev.target.value)}
                placeholder="nick"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <button className="m-boton principal mt-mas" disabled={ocupado || !limpiarNick(nick)}>
                +1 punto
              </button>
            </div>
            <datalist id="mt-nicks">
              {e.jug.map((j) => (
                <option key={j.k} value={j.u} />
              ))}
            </datalist>
          </form>
          {rk.length > 0 && (
            <div className="mt-rapidos">
              <span className="m-ayuda">O toquen a uno que ya tiene puntos:</span>
              <div className="mt-chips">
                {rk.map((j) => (
                  <button key={j.k} className="mt-chip" disabled={ocupado} onClick={() => void punto(j.u)}>
                    {j.u} <b>{j.p}</b>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="m-botones">
            <button className="m-boton" disabled={ocupado} onClick={() => void hacer(siguiente, (x) => `Nadie acertó. Sigue la ${x.pregunta}.`)}>
              Nadie acertó · siguiente
            </button>
            <button
              className="m-boton"
              disabled={ocupado || !ultima}
              onClick={() => void hacer(deshacer, () => '↶ Listo, se deshizo')}
              title={ultima ? `Quita: pregunta ${ultima.q} · ${nombreDe(ultima.k) ?? 'nadie'}` : undefined}
            >
              ↶ Deshacer{ultima ? ` (P${ultima.q} · ${nombreDe(ultima.k) ?? 'nadie'})` : ''}
            </button>
            {e.fase === 'inicio' && (
              <button className="m-boton" disabled={ocupado} onClick={() => void hacer((x) => ponFase(x, 'trivia'))}>
                Empezar
              </button>
            )}
          </div>
        </div>
      )}

      {enPreguntas && e.terminada && (
        <div className="m-tarjeta mt-accion">
          <div className="mt-grande">¡Se acabaron las {e.total} preguntas!</div>
          <div className="m-botones">
            <button className="m-boton principal mt-xl" disabled={ocupado || !rk.length} onClick={() => void hacer(aRuleta)}>
              Ir a la ruleta
            </button>
            <button
              className="m-boton"
              disabled={ocupado || !ultima}
              onClick={() => void hacer(deshacer, () => '↶ Listo, se deshizo')}
            >
              ↶ Deshacer{ultima ? ` (P${ultima.q} · ${nombreDe(ultima.k) ?? 'nadie'})` : ''}
            </button>
            {e.total < MAX_PREGUNTAS && (
              <button className="m-boton" disabled={ocupado} onClick={() => void hacer((x) => ponTotal(x, x.total + 1))}>
                Una pregunta más
              </button>
            )}
          </div>
          {!rk.length && <p className="m-ayuda">Nadie tiene puntos: no hay ruleta.</p>}
        </div>
      )}

      {e.fase === 'ruleta' && (
        <div className="m-tarjeta mt-accion">
          <div className="mt-grande">
            {rk.length} {rk.length === 1 ? 'hincha' : 'hinchas'} <span>· {T} oportunidades</span>
          </div>
          <div className="m-botones">
            <button className="m-boton principal mt-xl" disabled={ocupado} onClick={() => void hacer((x) => girar(x))}>
              ¡Girar!
            </button>
            <button className="m-boton" disabled={ocupado} onClick={() => void hacer((x) => ponFase(x, 'trivia'))}>
              ← Volver a las preguntas
            </button>
          </div>
        </div>
      )}

      {e.fase === 'ganador' && e.ganador && (
        <div className="m-tarjeta mt-accion mt-ganador">
          {girando ? (
            <div className="mt-grande">Girando… <span>no lo canten todavía</span></div>
          ) : (
            <>
              <div className="mt-grande">
                <b>{e.ganador.u}</b>
              </div>
              <p className="m-suave">
                Tenía {puntosTxt(e.ganador.p)} ({pctTxt(e.ganador.pct)} de opciones). Revisen que siga a VAR y BAR en Instagram,
                TikTok, YouTube y Kick, y que sea el mismo nick del chat.
              </p>
              <div className="m-botones">
                <button
                  className="m-boton peligro"
                  disabled={ocupado}
                  onClick={() => void hacer((x) => otra(x), () => `Se sacó a ${e.ganador?.u}. Girando otra vez…`)}
                >
                  No sigue las redes · sacarlo y girar otra vez
                </button>
                <button className="m-boton" disabled={ocupado} onClick={() => void hacer(aRuleta)}>
                  Volver a la ruleta
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ---------- puntos */}
      <div className="m-tarjeta">
        <div className="mt-sub">Puntos {T > 0 && <span>· {T} oportunidades en total</span>}</div>
        {rk.length === 0 && fuera.length === 0 ? (
          <p className="m-suave">Todavía nadie tiene puntos.</p>
        ) : (
          <div className="mt-tabla">
            {rk.map((j, i) => (
              <div className="mt-fila" key={j.k}>
                <span className="mt-pos">{i + 1}</span>
                <span className="mt-nick">{j.u}</span>
                <span className="mt-pts">{j.p}</span>
                <span className="mt-pct">{pctTxt(pct(j.p, T))}</span>
                <span className="mt-acc">
                  {enPreguntas && !e.terminada && (
                    <button className="m-boton chico" disabled={ocupado} onClick={() => void punto(j.u)} aria-label={`+1 a ${j.u}`}>
                      +1
                    </button>
                  )}
                  {e.fase !== 'ganador' && (
                    <button
                      className="m-boton chico"
                      disabled={ocupado}
                      onClick={() => void hacer((x) => menos(x, j.k), () => `−1 a ${j.u}`)}
                      aria-label={`−1 a ${j.u}`}
                    >
                      −1
                    </button>
                  )}
                </span>
              </div>
            ))}
            {fuera.map((j) => (
              <div className="mt-fila fuera" key={j.k}>
                <span className="mt-pos">–</span>
                <span className="mt-nick">
                  {j.u} <small>fuera de la ruleta</small>
                </span>
                <span className="mt-pts">{j.p}</span>
                <span className="mt-pct" />
                <span className="mt-acc">
                  {e.fase !== 'ganador' && (
                    <button className="m-boton chico" disabled={ocupado} onClick={() => void hacer((x) => reincluir(x, j.k))}>
                      Meterlo otra vez
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        {e.hist.length > 0 && (
          <div className="mt-hist">
            {e.hist.map((h, i) => (
              <span key={i} className={h.k ? '' : 'nadie'}>
                P{h.q} · {nombreDe(h.k) ?? 'nadie'}
              </span>
            ))}
          </div>
        )}
      </div>

      <Ajustes e={e} ocupado={ocupado} hacer={hacer} />
    </section>
  );
}

function Conexion({ estado }: { estado: EstadoConexion }) {
  const texto: Record<EstadoConexion, string> = { cargando: 'Conectando', 'en-vivo': 'En vivo', respaldo: 'Conectado', error: 'Sin conexión' };
  return <span className={`m-estado ${estado}`}>{texto[estado]}</span>;
}

function Ajustes({
  e,
  ocupado,
  hacer,
}: {
  e: EstadoTrivia;
  ocupado: boolean;
  hacer: (fn: (x: EstadoTrivia) => Resultado, exito?: (x: EstadoTrivia) => string) => Promise<boolean>;
}) {
  const [premio, setPremio] = useState(e.premio);
  const [partido, setPartido] = useState(e.partido);
  const [total, setTotal] = useState(String(e.total));
  useEffect(() => {
    setPremio(e.premio);
    setPartido(e.partido);
    setTotal(String(e.total));
  }, [e.premio, e.partido, e.total]);

  async function guardar(ev: FormEvent) {
    ev.preventDefault();
    const n = Number(total);
    await hacer(
      (x) => {
        const a = ponPremio(x, premio, partido);
        return a.e ? ponTotal(a.e, Number.isFinite(n) ? n : x.total) : a;
      },
      () => '✓ Guardado',
    );
  }

  return (
    <details className="m-tarjeta mt-ajustes" open={e.fase === 'inicio' && e.hist.length === 0}>
      <summary>Premio, preguntas y reiniciar</summary>
      <form className="m-editar mt-form" onSubmit={guardar}>
        <label>
          Premio
          <input value={premio} onChange={(ev) => setPremio(ev.target.value)} maxLength={80} />
        </label>
        <label>
          Partido (opcional)
          <input value={partido} onChange={(ev) => setPartido(ev.target.value)} maxLength={100} placeholder="Nacional vs Medellín · Atanasio Girardot" />
        </label>
        <label>
          Cuántas preguntas
          <input inputMode="numeric" value={total} onChange={(ev) => setTotal(ev.target.value.replace(/\D/g, '').slice(0, 2))} />
        </label>
        <div className="m-editar-acciones">
          <button className="m-boton principal" disabled={ocupado}>
            Guardar
          </button>
        </div>
      </form>
      <div className="m-botones">
        {e.fase === 'trivia' && (
          <button className="m-boton" disabled={ocupado} onClick={() => void hacer((x) => ponFase(x, 'inicio'))}>
            Mostrar otra vez las reglas en pantalla
          </button>
        )}
        <button
          className="m-boton peligro"
          disabled={ocupado}
          onClick={() => {
            if (window.confirm('¿Borrar toda la trivia (puntos y ganador) y empezar de cero?')) void hacer(reiniciar, () => '✓ Trivia en cero');
          }}
        >
          Reiniciar trivia
        </button>
      </div>
    </details>
  );
}
