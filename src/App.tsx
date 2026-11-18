import AlAire from './vistas/AlAire';
import Master from './vistas/Master';

// Dos páginas:
//   /        → lo que sale en el stream (fuente de Navegador en OBS, 1920 × 1080)
//   /master  → el panel del máster para anotar pronósticos y resultados (pide PIN)
export default function App() {
  const ruta = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  return ruta === '/master' ? <Master /> : <AlAire />;
}
