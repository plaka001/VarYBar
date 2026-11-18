import { PUNTOS_ACIERTO, PUNTOS_PLENO } from '../lib/puntos';

export default function Cabecera({ kicker, sub }: { kicker: string; sub: string }) {
  return (
    <header className="cabeza">
      <div className="cabeza-izq">
        <div className="kicker">{kicker}</div>
        <div className="titulo-linea">
          <h1 className="titulo">
            LA <span>POLLA</span>
          </h1>
          <div className="sub">{sub}</div>
        </div>
      </div>
      <div className="leyenda">
        <div className="chip pleno">
          <b>+{PUNTOS_PLENO}</b> Pleno · marcador exacto
        </div>
        <div className="chip acierto">
          <b>+{PUNTOS_ACIERTO}</b> Acierto · ganador o empate
        </div>
      </div>
    </header>
  );
}
