import { describe, expect, it } from 'vitest';
import { calificar, tabla, ultimaFechaJugada } from './puntos';
import type { Datos, Partido } from './tipos';

const partido = (id: string, fecha: number, gl: number | null, gv: number | null, multiplicador = 1): Partido => ({
  id,
  torneo: 'Liga BetPlay 2026-II',
  fase: 'Cuadrangulares',
  fecha,
  grupo: 'A',
  local: 'Medellín',
  visitante: 'Santa Fe',
  inicio: null,
  estadio: null,
  goles_local: gl,
  goles_visitante: gv,
  multiplicador,
  orden: 1,
});

describe('calificar', () => {
  const m = partido('p', 1, 2, 1);
  it('marcador exacto = pleno (3)', () => expect(calificar({ goles_local: 2, goles_visitante: 1 }, m)).toEqual({ tipo: 'pleno', pts: 3 }));
  it('ganador correcto = acierto (1)', () => expect(calificar({ goles_local: 3, goles_visitante: 0 }, m)).toEqual({ tipo: 'acierto', pts: 1 }));
  it('empate acertado = acierto (1)', () =>
    expect(calificar({ goles_local: 0, goles_visitante: 0 }, partido('e', 1, 1, 1))).toEqual({ tipo: 'acierto', pts: 1 }));
  it('al revés = fallo (0)', () => expect(calificar({ goles_local: 0, goles_visitante: 1 }, m)).toEqual({ tipo: 'fallo', pts: 0 }));
  it('sin resultado = pendiente', () =>
    expect(calificar({ goles_local: 1, goles_visitante: 0 }, partido('x', 1, null, null)).tipo).toBe('pendiente'));
  it('sin pronóstico = sin', () => expect(calificar(undefined, m).tipo).toBe('sin'));
  it('la final vale doble', () =>
    expect(calificar({ goles_local: 2, goles_visitante: 1 }, partido('f', 7, 2, 1, 2))).toEqual({ tipo: 'pleno', pts: 6 }));
});

describe('tabla', () => {
  const d: Datos = {
    participantes: [
      { id: 'a', nombre: 'Santiago', orden: 1, activo: true },
      { id: 'b', nombre: 'Sebastián', orden: 2, activo: true },
      { id: 'c', nombre: 'Dani', orden: 3, activo: true },
    ],
    partidos: [partido('m1', 1, 2, 1), partido('m2', 1, 0, 0), partido('m3', 2, null, null)],
    pronosticos: [
      { partido_id: 'm1', participante_id: 'a', goles_local: 2, goles_visitante: 1 }, // pleno 3
      { partido_id: 'm2', participante_id: 'a', goles_local: 1, goles_visitante: 0 }, // fallo
      { partido_id: 'm1', participante_id: 'b', goles_local: 1, goles_visitante: 0 }, // acierto 1
      { partido_id: 'm2', participante_id: 'b', goles_local: 2, goles_visitante: 2 }, // acierto 1
      { partido_id: 'm3', participante_id: 'b', goles_local: 5, goles_visitante: 0 }, // pendiente
      { partido_id: 'm2', participante_id: 'c', goles_local: 0, goles_visitante: 0 }, // pleno 3
    ],
    alAire: { vista: 'fecha', fecha: 1 },
  };

  it('ordena por puntos, luego plenos, y comparte posición en empate exacto', () => {
    const t = tabla(d);
    expect(t.map((f) => [f.participante.id, f.pts, f.plenos, f.aciertos, f.pos])).toEqual([
      ['a', 3, 1, 0, 1],
      ['c', 3, 1, 0, 1],
      ['b', 2, 0, 2, 3],
    ]);
  });

  it('cuenta solo la fecha pedida', () => {
    expect(tabla(d, 2).every((f) => f.pts === 0)).toBe(true);
  });

  it('sabe cuál es la última fecha con resultados', () => {
    expect(ultimaFechaJugada(d)).toBe(1);
  });
});
