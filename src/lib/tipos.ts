export type Participante = {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
};

export type Partido = {
  id: string;
  torneo: string;
  fase: string;
  fecha: number;
  grupo: 'A' | 'B' | null;
  local: string;
  visitante: string;
  inicio: string | null;
  estadio: string | null;
  goles_local: number | null;
  goles_visitante: number | null;
  multiplicador: number;
  orden: number;
};

export type Pronostico = {
  partido_id: string;
  participante_id: string;
  goles_local: number;
  goles_visitante: number;
  actualizado?: string;
};

export type Vista = 'fecha' | 'tabla';

export type AlAire = {
  vista: Vista;
  fecha: number;
  actualizado?: string;
};

export type Datos = {
  participantes: Participante[];
  partidos: Partido[];
  pronosticos: Pronostico[];
  alAire: AlAire;
};

export const jugado = (m: Partido) => m.goles_local != null && m.goles_visitante != null;

export const clave = (partidoId: string, participanteId: string) => `${partidoId}|${participanteId}`;

export function mapaPronosticos(lista: Pronostico[]): Map<string, Pronostico> {
  const m = new Map<string, Pronostico>();
  for (const p of lista) m.set(clave(p.partido_id, p.participante_id), p);
  return m;
}

export function partidosDeFecha(d: Datos, fecha: number): Partido[] {
  return d.partidos
    .filter((p) => p.fecha === fecha)
    .sort((a, b) => a.orden - b.orden || a.id.localeCompare(b.id));
}

export function fechasDisponibles(d: Datos): number[] {
  return [...new Set(d.partidos.map((p) => p.fecha))].sort((a, b) => a - b);
}

export function nombreFecha(d: Datos, fecha: number): string {
  const m = d.partidos.find((p) => p.fecha === fecha);
  if (!m || m.fase === 'Cuadrangulares') return `Fecha ${fecha}`;
  return m.fase;
}
