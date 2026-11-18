import Cabecera from '../componentes/Cabecera';
import { tabla, ultimaFechaJugada } from '../lib/puntos';
import { nombreFecha, type Datos } from '../lib/tipos';

export default function VistaTabla({ d }: { d: Datos }) {
  const filas = tabla(d);
  const ult = ultimaFechaJugada(d);
  const deUltima = ult != null ? new Map(tabla(d, ult).map((f) => [f.participante.id, f.pts])) : null;
  const torneo = d.partidos[0]?.torneo ?? 'Liga BetPlay';
  const fase = d.partidos[0]?.fase ?? 'Cuadrangulares';

  return (
    <div className="vista entrar">
      <Cabecera
        kicker={`${torneo} · ${fase}`}
        sub={ult != null ? `Tabla · después de la ${nombreFecha(d, ult).toLowerCase()}` : 'Tabla · arrancamos en cero'}
      />
      <div className="tg">
        <div className="tg-cab">
          <span>Pos</span>
          <span>Participante</span>
          <span className="centro">Plenos</span>
          <span className="centro">Aciertos</span>
          <span className="der">Puntos</span>
        </div>
        {filas.map((f, i) => (
          <div
            key={f.participante.id}
            className={`tg-fila ${f.pos === 1 && ult != null ? 'lider' : ''}`}
            style={{ animationDelay: `${150 + i * 90}ms` }}
          >
            <span className="tg-pos">{f.pos}</span>
            <span className="tg-nombre">
              {f.participante.nombre}
              {deUltima && (
                <span className={`tg-ultima ${(deUltima.get(f.participante.id) ?? 0) > 0 ? 'con' : ''}`}>
                  +{deUltima.get(f.participante.id) ?? 0} en la {nombreFecha(d, ult!).toLowerCase()}
                </span>
              )}
            </span>
            <span className="tg-num">{f.plenos}</span>
            <span className="tg-num">{f.aciertos}</span>
            <span key={f.pts} className="tg-pts pop">
              {f.pts}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
