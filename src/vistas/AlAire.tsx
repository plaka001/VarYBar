import { useEffect, useState } from 'react';
import { useDatos } from '../lib/datos';
import type { Vista } from '../lib/tipos';
import VistaFecha from './VistaFecha';
import VistaTabla from './VistaTabla';
import VistaTrivia from './VistaTrivia';

const ANCHO = 1920;
const ALTO = 1080;

// La página se diseña a 1920 × 1080 (lo que usa OBS) y se escala sola en cualquier otra pantalla.
function useEscala() {
  const medir = () => {
    const s = Math.min(window.innerWidth / ANCHO, window.innerHeight / ALTO);
    return { s, x: (window.innerWidth - ANCHO * s) / 2, y: (window.innerHeight - ALTO * s) / 2 };
  };
  const [e, setE] = useState(medir);
  useEffect(() => {
    const f = () => setE(medir());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return e;
}

export default function AlAire() {
  const { datos, estado } = useDatos();
  const escala = useEscala();
  const params = new URLSearchParams(window.location.search);
  const vistaFija = params.get('vista');
  const fechaFija = Number(params.get('fecha'));
  const guia = params.has('guia');

  useEffect(() => {
    document.documentElement.classList.add('modo-aire');
  }, []);

  // Por defecto manda el máster (tabla al_aire); con ?vista=tabla, ?vista=trivia o ?fecha=2 se puede fijar.
  const vista: Vista =
    vistaFija === 'tabla' || vistaFija === 'fecha' || vistaFija === 'trivia' ? vistaFija : (datos?.alAire.vista ?? 'fecha');
  const fecha = fechaFija > 0 ? fechaFija : (datos?.alAire.fecha ?? 1);

  return (
    <div
      className="escenario"
      style={{ transform: `translate(${escala.x}px, ${escala.y}px) scale(${escala.s})` }}
    >
      <div className="fondo" />
      {vista === 'trivia' ? (
        <VistaTrivia key="trivia" />
      ) : !datos ? (
        <div className="aire-cargando">{estado === 'error' ? 'Conectando con la polla…' : 'Cargando la polla…'}</div>
      ) : vista === 'tabla' ? (
        <VistaTabla key="tabla" d={datos} />
      ) : (
        <VistaFecha key={`fecha-${fecha}`} d={datos} fecha={fecha} />
      )}
      {estado === 'error' && datos && <i className="aire-sin-conexion" title="Sin conexión: mostrando lo último que llegó" />}
      {guia && <Guia />}
    </div>
  );
}

// Con ?guia en la URL se ven las zonas que tapa el lienzo de Reacción (cámara, barra y chat).
function Guia() {
  return (
    <div className="guia">
      <div className="guia-zona" style={{ left: 1205, top: 632, width: 686, height: 420 }}>
        Cámara (lienzo de Reacción)
      </div>
      <div className="guia-zona" style={{ left: 40, top: 968, width: 1102, height: 80 }}>
        Barra
      </div>
      <div className="guia-zona suave" style={{ left: 40, top: 760, width: 440, height: 200 }}>
        Chat compacto
      </div>
    </div>
  );
}
