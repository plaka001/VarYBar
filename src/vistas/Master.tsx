import { useEffect, useRef, useState, type FormEvent } from 'react';
import Equipo from '../componentes/Equipo';
import { useDatos, type EstadoConexion } from '../lib/datos';
import { aInputLocal, cuando, desdeInputLocal, rangoDias } from '../lib/formato';
import { calificar } from '../lib/puntos';
import { llamar, MENSAJES } from '../lib/supabase';
import {
  clave,
  fechasDisponibles,
  mapaPronosticos,
  nombreFecha,
  partidosDeFecha,
  type Datos,
  type Partido,
  type Vista,
} from '../lib/tipos';

const LLAVE_PIN = 'polla_pin';
const leerPin = () => {
  try {
    return localStorage.getItem(LLAVE_PIN) ?? '';
  } catch {
    return '';
  }
};
const recordarPin = (pin: string) => {
  try {
    if (pin) localStorage.setItem(LLAVE_PIN, pin);
    else localStorage.removeItem(LLAVE_PIN);
  } catch {
    /* sin almacenamiento: toca escribir el PIN cada vez */
  }
};

export default function Master() {
  const [pin, setPin] = useState(leerPin);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    document.title = 'Máster · La Polla';
    document.documentElement.classList.add('modo-master');
  }, []);

  // Si el PIN guardado ya no sirve (lo cambiaron), se vuelve a pedir.
  useEffect(() => {
    if (!pin) return;
    llamar('verificar_pin', { p_pin: pin })
      .then((r) => {
        if (r === 'pin_incorrecto' || r === 'sin_pin') salir(MENSAJES[r]);
      })
      .catch(() => {
        /* sin conexión: se deja entrar y cada cambio avisa si no se guardó */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function salir(motivo = '') {
    recordarPin('');
    setPin('');
    setAviso(motivo);
  }

  if (!pin) {
    return (
      <Entrada
        aviso={aviso}
        onListo={(p) => {
          recordarPin(p);
          setAviso('');
          setPin(p);
        }}
      />
    );
  }
  return <Panel pin={pin} onSalir={salir} onPinNuevo={(p) => { recordarPin(p); setPin(p); }} />;
}

// ---------------------------------------------------------------- entrada con PIN
function Entrada({ aviso, onListo }: { aviso: string; onListo: (pin: string) => void }) {
  const [modo, setModo] = useState<'cargando' | 'crear' | 'entrar'>('cargando');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [msg, setMsg] = useState(aviso);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    llamar('estado_pin')
      .then((r) => setModo((r as string) === 'con_pin' ? 'entrar' : 'crear'))
      .catch(() => {
        setModo('entrar');
        setMsg('Sin conexión con la base de datos. Revisen el internet.');
      });
  }, []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const p = pin.trim();
    if (modo === 'crear' && p !== pin2.trim()) {
      setMsg('Los dos PIN no coinciden');
      return;
    }
    setOcupado(true);
    setMsg('');
    try {
      const r = await llamar(modo === 'crear' ? 'crear_pin' : 'verificar_pin', { p_pin: p });
      if (r === 'ok') onListo(p);
      else if (r === 'ya_existe') {
        setModo('entrar');
        setMsg('Ya hay un PIN creado: escríbelo para entrar');
      } else setMsg(MENSAJES[r] ?? r);
    } catch {
      setMsg('Sin conexión con la base de datos');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <main className="m-entrada">
      <form className="m-tarjeta m-login" onSubmit={enviar}>
        <div className="m-kicker">VAR y BAR</div>
        <h1>
          La Polla <span>· Máster</span>
        </h1>
        {modo === 'cargando' ? (
          <p className="m-suave">Conectando…</p>
        ) : (
          <>
            <p className="m-suave">
              {modo === 'crear'
                ? 'Primera vez: crea el PIN del máster. Con ese PIN se anotan pronósticos y resultados.'
                : 'Escribe el PIN del máster.'}
            </p>
            <label>
              PIN
              <input
                type="password"
                autoComplete={modo === 'crear' ? 'new-password' : 'current-password'}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                minLength={4}
                required
                autoFocus
              />
            </label>
            {modo === 'crear' && (
              <label>
                Repite el PIN
                <input
                  type="password"
                  autoComplete="new-password"
                  value={pin2}
                  onChange={(e) => setPin2(e.target.value)}
                  minLength={4}
                  required
                />
              </label>
            )}
            {msg && <p className="m-error">{msg}</p>}
            <button className="m-boton principal" disabled={ocupado}>
              {ocupado ? 'Un momento…' : modo === 'crear' ? 'Crear PIN y entrar' : 'Entrar'}
            </button>
          </>
        )}
      </form>
    </main>
  );
}

// ---------------------------------------------------------------- panel
type Guardar = (fn: string, args: Record<string, unknown>) => Promise<string | null>;

function Panel({
  pin,
  onSalir,
  onPinNuevo,
}: {
  pin: string;
  onSalir: (motivo?: string) => void;
  onPinNuevo: (pin: string) => void;
}) {
  const { datos, estado, recargar, cambiarLocal } = useDatos();
  const [fecha, setFecha] = useState<number | null>(null);

  useEffect(() => {
    if (datos && fecha == null) setFecha(datos.alAire.fecha);
  }, [datos, fecha]);

  const guardar: Guardar = async (fn, args) => {
    try {
      const r = await llamar(fn, { p_pin: pin, ...args });
      if (r === 'ok') {
        void recargar();
        return null;
      }
      if (r === 'pin_incorrecto' || r === 'sin_pin') onSalir(MENSAJES[r]);
      return MENSAJES[r] ?? r;
    } catch {
      return 'Sin conexión: no se guardó';
    }
  };

  if (!datos || fecha == null) {
    return (
      <main className="m-pagina">
        <BarraMaster estado={estado} onSalir={() => onSalir()} />
        <p className="m-suave">{estado === 'error' ? 'Sin conexión con la base de datos…' : 'Cargando…'}</p>
      </main>
    );
  }

  const fechas = fechasDisponibles(datos);
  const partidos = partidosDeFecha(datos, fecha);

  return (
    <main className="m-pagina">
      <BarraMaster estado={estado} onSalir={() => onSalir()} />
      <ControlAlAire d={datos} guardar={guardar} cambiarLocal={cambiarLocal} onElegirFecha={setFecha} />

      <section className="m-seccion">
        <p className="m-ayuda">Anotar pronósticos y resultados</p>
        <div className="m-tabs" role="tablist" aria-label="Fecha para anotar">
          {fechas.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={f === fecha}
              className={f === fecha ? 'activo' : ''}
              onClick={() => setFecha(f)}
            >
              {nombreFecha(datos, f)}
            </button>
          ))}
        </div>
        <h2 className="m-titulo-fecha">
          {nombreFecha(datos, fecha)} <span>{rangoDias(partidos.map((p) => p.inicio))}</span>
        </h2>
        {partidos.map((m) => (
          <TarjetaPartido key={m.id} m={m} d={datos} guardar={guardar} cambiarLocal={cambiarLocal} />
        ))}
      </section>

      <CambiarPin pin={pin} onPinNuevo={onPinNuevo} />
    </main>
  );
}

function BarraMaster({ estado, onSalir }: { estado: EstadoConexion; onSalir: () => void }) {
  const texto: Record<EstadoConexion, string> = {
    cargando: 'Conectando',
    'en-vivo': 'En vivo',
    respaldo: 'Conectado',
    error: 'Sin conexión',
  };
  return (
    <header className="m-barra">
      <div>
        <div className="m-kicker">VAR y BAR</div>
        <div className="m-marca">
          La Polla <span>· Máster</span>
        </div>
      </div>
      <div className="m-barra-der">
        <span className={`m-estado ${estado}`}>{texto[estado]}</span>
        <button className="m-boton chico" onClick={onSalir}>
          Salir
        </button>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- qué sale al aire
function ControlAlAire({
  d,
  guardar,
  cambiarLocal,
  onElegirFecha,
}: {
  d: Datos;
  guardar: Guardar;
  cambiarLocal: (fn: (d: Datos) => Datos) => void;
  onElegirFecha: (f: number) => void;
}) {
  const [msg, setMsg] = useState('');
  const { vista, fecha } = d.alAire;

  async function poner(v: Vista, f: number) {
    setMsg('');
    if (v === 'fecha') onElegirFecha(f);
    cambiarLocal((x) => ({ ...x, alAire: { ...x.alAire, vista: v, fecha: f } }));
    const err = await guardar('poner_al_aire', { p_vista: v, p_fecha: f });
    if (err) setMsg(err);
  }

  return (
    <section className="m-tarjeta m-aire">
      <div className="m-aire-cab">
        <span className="m-aire-ahora">
          <i className="punto-vivo" /> Al aire:{' '}
          <b>{vista === 'tabla' ? 'Tabla general' : `${nombreFecha(d, fecha)} · partidos`}</b>
        </span>
        <a className="m-link" href="/" target="_blank" rel="noreferrer">
          Abrir vista al aire ↗
        </a>
      </div>
      <div className="m-botones">
        {fechasDisponibles(d).map((f) => (
          <button
            key={f}
            className={`m-boton ${vista === 'fecha' && fecha === f ? 'activo' : ''}`}
            onClick={() => void poner('fecha', f)}
          >
            {nombreFecha(d, f)}
          </button>
        ))}
        <button
          className={`m-boton tabla ${vista === 'tabla' ? 'activo' : ''}`}
          onClick={() => void poner('tabla', fecha)}
        >
          Tabla general
        </button>
      </div>
      <p className="m-ayuda">Toca un botón y la pantalla del stream cambia sola.</p>
      {msg && <p className="m-error">{msg}</p>}
    </section>
  );
}

// ---------------------------------------------------------------- un partido
function TarjetaPartido({
  m,
  d,
  guardar,
  cambiarLocal,
}: {
  m: Partido;
  d: Datos;
  guardar: Guardar;
  cambiarLocal: (fn: (d: Datos) => Datos) => void;
}) {
  const [editando, setEditando] = useState(false);
  const pron = mapaPronosticos(d.pronosticos);

  async function guardarResultado(l: number | null, v: number | null) {
    cambiarLocal((x) => ({
      ...x,
      partidos: x.partidos.map((p) => (p.id === m.id ? { ...p, goles_local: l, goles_visitante: v } : p)),
    }));
    return guardar('guardar_resultado', { p_partido: m.id, p_local: l, p_visitante: v });
  }

  async function guardarPronostico(participante: string, l: number | null, v: number | null) {
    cambiarLocal((x) => {
      const resto = x.pronosticos.filter((p) => !(p.partido_id === m.id && p.participante_id === participante));
      return {
        ...x,
        pronosticos:
          l == null || v == null
            ? resto
            : [...resto, { partido_id: m.id, participante_id: participante, goles_local: l, goles_visitante: v }],
      };
    });
    return guardar('guardar_pronostico', {
      p_partido: m.id,
      p_participante: participante,
      p_local: l,
      p_visitante: v,
    });
  }

  return (
    <article className="m-tarjeta m-partido">
      <header className="m-partido-cab">
        <div>
          <div className="m-equipos">
            {m.grupo && <span className="grupo">{m.grupo}</span>}
            <Equipo nombre={m.local} />
            <span className="vs">vs</span>
            <Equipo nombre={m.visitante} />
          </div>
          <div className="m-meta">
            {cuando(m.inicio)}
            {m.estadio ? ` · ${m.estadio}` : ''}
          </div>
        </div>
        <button className="m-boton chico" onClick={() => setEditando((x) => !x)}>
          {editando ? 'Cerrar' : 'Editar partido'}
        </button>
      </header>

      {editando && <EditarPartido m={m} guardar={guardar} onListo={() => setEditando(false)} />}

      <div className="m-fila m-fila-resultado">
        <span className="m-nombre">Resultado</span>
        <Marcador
          local={m.goles_local}
          visitante={m.goles_visitante}
          onGuardar={guardarResultado}
          etiqueta={`Resultado ${m.local} vs ${m.visitante}`}
        />
        <span className="m-insignia" />
      </div>

      <div className="m-pronosticos">
        {d.participantes.map((p) => {
          const pr = pron.get(clave(m.id, p.id));
          const c = calificar(pr, m);
          return (
            <div className="m-fila" key={p.id}>
              <span className="m-nombre">{p.nombre}</span>
              <Marcador
                local={pr?.goles_local ?? null}
                visitante={pr?.goles_visitante ?? null}
                onGuardar={(l, v) => guardarPronostico(p.id, l, v)}
                etiqueta={`Pronóstico de ${p.nombre}`}
              />
              <span className={`m-insignia ${c.tipo}`}>
                {c.tipo === 'pleno' || c.tipo === 'acierto' ? `+${c.pts}` : c.tipo === 'fallo' ? '0' : ''}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

// Dos casillas (local – visitante). Guarda solo cuando las dos tienen número, o cuando las dos quedan vacías (borrar).
function Marcador({
  local,
  visitante,
  onGuardar,
  etiqueta,
}: {
  local: number | null;
  visitante: number | null;
  onGuardar: (l: number | null, v: number | null) => Promise<string | null>;
  etiqueta: string;
}) {
  const [l, setL] = useState(local?.toString() ?? '');
  const [v, setV] = useState(visitante?.toString() ?? '');
  const [estado, setEstado] = useState<'' | 'falta' | 'guardando' | 'ok' | 'error'>('');
  const [msg, setMsg] = useState('');
  const sucio = useRef(false);
  const espera = useRef<number | undefined>(undefined);

  // Si cambia desde otro lado (otro equipo, tiempo real) y aquí no se está escribiendo, se actualiza.
  useEffect(() => {
    if (sucio.current) return;
    setL(local?.toString() ?? '');
    setV(visitante?.toString() ?? '');
  }, [local, visitante]);

  useEffect(() => () => window.clearTimeout(espera.current), []);

  function cambio(nl: string, nv: string) {
    sucio.current = true;
    window.clearTimeout(espera.current);
    const vacio = nl === '' && nv === '';
    const lleno = nl !== '' && nv !== '';
    if (!vacio && !lleno) {
      setEstado('falta');
      return;
    }
    setEstado('guardando');
    espera.current = window.setTimeout(async () => {
      const err = await onGuardar(vacio ? null : Number(nl), vacio ? null : Number(nv));
      sucio.current = false;
      if (err) {
        setEstado('error');
        setMsg(err);
      } else {
        setEstado('ok');
        setMsg('');
      }
    }, 450);
  }

  const limpiar = (x: string) => x.replace(/\D/g, '').slice(0, 2);

  return (
    <span className="m-marcador" title={estado === 'error' ? msg : undefined}>
      <input
        aria-label={`${etiqueta}: goles local`}
        inputMode="numeric"
        pattern="[0-9]*"
        value={l}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const x = limpiar(e.target.value);
          setL(x);
          cambio(x, v);
        }}
      />
      <i>–</i>
      <input
        aria-label={`${etiqueta}: goles visitante`}
        inputMode="numeric"
        pattern="[0-9]*"
        value={v}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const x = limpiar(e.target.value);
          setV(x);
          cambio(l, x);
        }}
      />
      <span className={`m-guardado ${estado}`}>
        {estado === 'falta'
          ? 'falta un número'
          : estado === 'guardando'
            ? 'guardando…'
            : estado === 'ok'
              ? '✓ guardado'
              : estado === 'error'
                ? msg
                : ''}
      </span>
    </span>
  );
}

function EditarPartido({ m, guardar, onListo }: { m: Partido; guardar: Guardar; onListo: () => void }) {
  const [local, setLocal] = useState(m.local);
  const [visitante, setVisitante] = useState(m.visitante);
  const [inicio, setInicio] = useState(aInputLocal(m.inicio));
  const [estadio, setEstadio] = useState(m.estadio ?? '');
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    const err = await guardar('editar_partido', {
      p_partido: m.id,
      p_local: local,
      p_visitante: visitante,
      p_inicio: desdeInputLocal(inicio),
      p_estadio: estadio,
    });
    setOcupado(false);
    if (err) setMsg(err);
    else onListo();
  }

  return (
    <form className="m-editar" onSubmit={enviar}>
      <label>
        Local
        <input value={local} onChange={(e) => setLocal(e.target.value)} required />
      </label>
      <label>
        Visitante
        <input value={visitante} onChange={(e) => setVisitante(e.target.value)} required />
      </label>
      <label>
        Día y hora (Colombia)
        <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} />
      </label>
      <label>
        Estadio
        <input value={estadio} onChange={(e) => setEstadio(e.target.value)} />
      </label>
      <div className="m-editar-acciones">
        {msg && <span className="m-error">{msg}</span>}
        <button className="m-boton principal" disabled={ocupado}>
          {ocupado ? 'Guardando…' : 'Guardar partido'}
        </button>
      </div>
    </form>
  );
}

function CambiarPin({ pin, onPinNuevo }: { pin: string; onPinNuevo: (p: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [nuevo, setNuevo] = useState('');
  const [nuevo2, setNuevo2] = useState('');
  const [msg, setMsg] = useState('');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (nuevo.trim() !== nuevo2.trim()) {
      setMsg('Los dos PIN no coinciden');
      return;
    }
    try {
      const r = await llamar('cambiar_pin', { p_pin: pin, p_nuevo: nuevo.trim() });
      if (r === 'ok') {
        onPinNuevo(nuevo.trim());
        setMsg('✓ PIN cambiado');
        setNuevo('');
        setNuevo2('');
      } else setMsg(MENSAJES[r] ?? r);
    } catch {
      setMsg('Sin conexión: no se cambió');
    }
  }

  return (
    <section className="m-pie">
      <button className="m-boton chico" onClick={() => setAbierto((x) => !x)}>
        {abierto ? 'Cerrar' : 'Cambiar PIN'}
      </button>
      {abierto && (
        <form className="m-editar" onSubmit={enviar}>
          <label>
            PIN nuevo
            <input type="password" autoComplete="new-password" value={nuevo} onChange={(e) => setNuevo(e.target.value)} minLength={4} required />
          </label>
          <label>
            Repite el PIN nuevo
            <input type="password" autoComplete="new-password" value={nuevo2} onChange={(e) => setNuevo2(e.target.value)} minLength={4} required />
          </label>
          <div className="m-editar-acciones">
            {msg && <span className={msg.startsWith('✓') ? 'm-ok' : 'm-error'}>{msg}</span>}
            <button className="m-boton principal">Cambiar PIN</button>
          </div>
        </form>
      )}
    </section>
  );
}
