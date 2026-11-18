import { coloresEquipo } from '../lib/equipos';

export default function Equipo({ nombre }: { nombre: string }) {
  const [c1, c2] = coloresEquipo(nombre);
  return (
    <span className="equipo">
      <i className="franja" style={{ background: `linear-gradient(${c1} 0 55%, ${c2} 55% 100%)` }} />
      {nombre}
    </span>
  );
}
