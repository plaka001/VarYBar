import { Fragment } from 'react';
import Cabecera from '../componentes/Cabecera';
import Equipo from '../componentes/Equipo';
import { cuando, rangoDias } from '../lib/formato';
import { calificar, tabla } from '../lib/puntos';
import {
  clave,
  jugado,
  mapaPronosticos,
  nombreFecha,
  partidosDeFecha,
  type Datos,
  type Partido,
  type Pronostico,
} from '../lib/tipos';

export default function VistaFecha({ d, fecha }: { d: Datos; fecha: number }) {
  const partidos = partidosDeFecha(d, fecha);
  const pron = mapaPronosticos(d.pronosticos);
  const hayResultados = partidos.some(jugado);
  const ptsFecha = new Map(tabla(d, fecha).map((f) => [f.participante.id, f.pts]));
  const torneo = partidos[0]?.torneo ?? 'Liga BetPlay';

  return (
    <div className="vista entrar">
      <Cabecera
        kicker={`${torneo} · ${partidos[0]?.fase ?? 'Cuadrangulares'}`}
        sub={`${nombreFecha(d, fecha)} · ${rangoDias(partidos.map((p) => p.inicio))}`}
      />

      {partidos.length === 0 ? (
        <div className="vacio">Esta fecha todavía no tiene partidos cargados.</div>
      ) : (
        <div
          className="grilla"
          style={{ gridTemplateColumns: `640px 170px repeat(${d.participantes.length}, minmax(0, 1fr))` }}
        >
          <div className="col-tit">Partido</div>
          <div className="col-tit centro">Resultado</div>
          {d.participantes.map((p) => (
            <div className="col-persona" key={p.id}>
              <span className="persona-nombre">{p.nombre}</span>
              {hayResultados && (
                <span className={`persona-pts ${(ptsFecha.get(p.id) ?? 0) > 0 ? 'con' : ''}`}>
                  {ptsFecha.get(p.id) ?? 0} pts
                </span>
              )}
            </div>
          ))}

          {partidos.map((m, i) => (
            <Fragment key={m.id}>
              <CeldaPartido m={m} i={i} />
              <CeldaResultado m={m} i={i} />
              {d.participantes.map((p) => (
                <CeldaPronostico key={p.id} m={m} pr={pron.get(clave(m.id, p.id))} i={i} />
              ))}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

const retraso = (i: number) => ({ animationDelay: `${120 + i * 70}ms` });

function CeldaPartido({ m, i }: { m: Partido; i: number }) {
  return (
    <div className="celda c-partido" style={retraso(i)}>
      {m.grupo && <span className="grupo">{m.grupo}</span>}
      <div className="c-partido-txt">
        <div className="equipos">
          <Equipo nombre={m.local} />
          <span className="vs">vs</span>
          <Equipo nombre={m.visitante} />
        </div>
        <div className="meta">
          {cuando(m.inicio)}
          {m.estadio ? ` · ${m.estadio}` : ''}
        </div>
      </div>
    </div>
  );
}

function CeldaResultado({ m, i }: { m: Partido; i: number }) {
  return (
    <div className={`celda c-resultado ${jugado(m) ? 'jugado' : ''}`} style={retraso(i)}>
      {jugado(m) ? (
        <span key={`${m.goles_local}-${m.goles_visitante}`} className="marcador pop">
          {m.goles_local}
          <i>–</i>
          {m.goles_visitante}
        </span>
      ) : (
        <span className="por-jugar">por jugar</span>
      )}
    </div>
  );
}

function CeldaPronostico({ m, pr, i }: { m: Partido; pr: Pronostico | undefined; i: number }) {
  const c = calificar(pr, m);
  const calificado = c.tipo === 'pleno' || c.tipo === 'acierto' || c.tipo === 'fallo';
  return (
    <div className={`celda c-pron ${c.tipo}`} style={retraso(i)}>
      {pr ? (
        <span key={`${pr.goles_local}-${pr.goles_visitante}`} className="marcador pop">
          {pr.goles_local}
          <i>–</i>
          {pr.goles_visitante}
        </span>
      ) : (
        <span className="nada">—</span>
      )}
      {calificado && <span className="insignia">{c.pts > 0 ? `+${c.pts}` : '0'}</span>}
    </div>
  );
}
