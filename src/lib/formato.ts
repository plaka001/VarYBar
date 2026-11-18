// Fechas y horas siempre en hora de Colombia (sin horario de verano: UTC-5).
const ZONA = 'America/Bogota';

const partes = (d: Date, opciones: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, ...opciones })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

const limpia = (s: string) => s.replace(/\./g, '').trim();
const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Vie 20 nov" */
export function dia(iso: string): string {
  const p = partes(new Date(iso), { weekday: 'short', day: 'numeric', month: 'short' });
  return `${mayus(limpia(p.weekday))} ${p.day} ${limpia(p.month)}`;
}

/** "4:30 p. m." */
export function hora(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, hour: 'numeric', minute: '2-digit', hour12: true })
    .format(new Date(iso))
    .replace(/ | /g, ' ');
}

/** "Vie 20 nov · 4:30 p. m." o "Por programar" */
export function cuando(iso: string | null): string {
  return iso ? `${dia(iso)} · ${hora(iso)}` : 'Por programar';
}

/** "Vie 20 y sáb 21 nov", "Mar 24 nov" o "Por programar" */
export function rangoDias(isos: (string | null)[]): string {
  const conDia = isos.filter((x): x is string => !!x).sort();
  if (!conDia.length) return 'Por programar';
  const unicos: string[] = [];
  for (const iso of conDia) {
    const p = partes(new Date(iso), { weekday: 'short', day: 'numeric', month: 'short' });
    const txt = `${limpia(p.weekday)} ${p.day}|${limpia(p.month)}`;
    if (!unicos.includes(txt)) unicos.push(txt);
  }
  const dias = unicos.map((u) => u.split('|')[0]);
  const meses = [...new Set(unicos.map((u) => u.split('|')[1]))];
  const lista =
    dias.length === 1 ? dias[0] : `${dias.slice(0, -1).join(', ')} y ${dias[dias.length - 1]}`;
  const faltan = conDia.length < isos.length ? ' · algunos por programar' : '';
  return `${mayus(lista)} ${meses.join('-')}${faltan}`;
}

/** Para <input type="datetime-local">: "2026-11-20T16:30" en hora de Colombia. */
export function aInputLocal(iso: string | null): string {
  if (!iso) return '';
  const p = partes(new Date(iso), {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** De "2026-11-20T16:30" (hora de Colombia) a ISO con zona. */
export function desdeInputLocal(valor: string): string | null {
  return valor ? `${valor}:00-05:00` : null;
}
