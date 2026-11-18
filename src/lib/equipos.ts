// Colores de cada equipo para la rayita al lado del nombre: [principal, secundario].
const COLORES: Record<string, [string, string]> = {
  nacional: ['#0C8A45', '#FFFFFF'],
  medellin: ['#D0142E', '#1E43A0'],
  'santa fe': ['#D51A30', '#FFFFFF'],
  'once caldas': ['#F4F1EA', '#151515'],
  millonarios: ['#1B4FA8', '#FFFFFF'],
  america: ['#D0142E', '#F4F1EA'],
  cali: ['#0D8A40', '#FFFFFF'],
  bucaramanga: ['#FFD21F', '#0D7A3B'],
  junior: ['#D0142E', '#FFFFFF'],
  tolima: ['#7A1E2E', '#F2C230'],
  pereira: ['#E21C2A', '#FFD21F'],
};

const normaliza = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function coloresEquipo(nombre: string): [string, string] {
  const n = normaliza(nombre);
  if (COLORES[n]) return COLORES[n];
  const k = Object.keys(COLORES).find((x) => n.includes(x));
  return k ? COLORES[k] : ['#8A8F94', '#3A4045'];
}
