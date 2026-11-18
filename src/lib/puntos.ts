import { clave, jugado, mapaPronosticos, type Datos, type Participante, type Partido } from './tipos';

// Reglas de la polla: marcador exacto = 3 (pleno), ganador o empate = 1 (acierto).
// Un partido con multiplicador 2 (la final) vale doble.
export const PUNTOS_PLENO = 3;
export const PUNTOS_ACIERTO = 1;

export type Calificacion = 'pleno' | 'acierto' | 'fallo' | 'pendiente' | 'sin';

export function calificar(
  pr: { goles_local: number; goles_visitante: number } | undefined,
  m: Partido,
): { tipo: Calificacion; pts: number } {
  if (!pr) return { tipo: 'sin', pts: 0 };
  if (!jugado(m)) return { tipo: 'pendiente', pts: 0 };
  const mult = m.multiplicador || 1;
  const gl = m.goles_local as number;
  const gv = m.goles_visitante as number;
  if (pr.goles_local === gl && pr.goles_visitante === gv) return { tipo: 'pleno', pts: PUNTOS_PLENO * mult };
  if (Math.sign(pr.goles_local - pr.goles_visitante) === Math.sign(gl - gv)) {
    return { tipo: 'acierto', pts: PUNTOS_ACIERTO * mult };
  }
  return { tipo: 'fallo', pts: 0 };
}

export type FilaTabla = {
  participante: Participante;
  pos: number;
  pts: number;
  plenos: number;
  aciertos: number;
  jugados: number;
};

/** Tabla acumulada. Si se pasa `soloFecha`, cuenta solo esa fecha. */
export function tabla(d: Datos, soloFecha?: number): FilaTabla[] {
  const pron = mapaPronosticos(d.pronosticos);
  const partidos = d.partidos.filter((m) => jugado(m) && (soloFecha == null || m.fecha === soloFecha));
  const filas = d.participantes.map((participante) => {
    let pts = 0, plenos = 0, aciertos = 0, jugados = 0;
    for (const m of partidos) {
      const pr = pron.get(clave(m.id, participante.id));
      if (!pr) continue;
      jugados++;
      const c = calificar(pr, m);
      pts += c.pts;
      if (c.tipo === 'pleno') plenos++;
      if (c.tipo === 'acierto') aciertos++;
    }
    return { participante, pos: 0, pts, plenos, aciertos, jugados };
  });
  filas.sort(
    (a, b) =>
      b.pts - a.pts ||
      b.plenos - a.plenos ||
      b.aciertos - a.aciertos ||
      a.participante.orden - b.participante.orden,
  );
  filas.forEach((f, i) => {
    const prev = filas[i - 1];
    f.pos = prev && prev.pts === f.pts && prev.plenos === f.plenos && prev.aciertos === f.aciertos ? prev.pos : i + 1;
  });
  return filas;
}

/** Última fecha que ya tiene al menos un resultado (o null si no se ha jugado nada). */
export function ultimaFechaJugada(d: Datos): number | null {
  const fechas = d.partidos.filter(jugado).map((m) => m.fecha);
  return fechas.length ? Math.max(...fechas) : null;
}
