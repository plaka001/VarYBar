import { useCallback, useEffect, useRef, useState } from 'react';
import { sb } from './supabase';
import type { AlAire, Datos, Participante, Partido, Pronostico } from './tipos';

export type EstadoConexion = 'cargando' | 'en-vivo' | 'respaldo' | 'error';

const AL_AIRE_INICIAL: AlAire = { vista: 'fecha', fecha: 1 };

async function traerTodo(): Promise<Datos> {
  const [pa, pt, pr, aa] = await Promise.all([
    sb.from('participantes').select('*').eq('activo', true).order('orden'),
    sb.from('partidos').select('*').order('fecha').order('orden'),
    sb.from('pronosticos').select('*'),
    sb.from('al_aire').select('*').eq('id', 1).maybeSingle(),
  ]);
  const error = pa.error ?? pt.error ?? pr.error ?? aa.error;
  if (error) throw error;
  return {
    participantes: (pa.data ?? []) as Participante[],
    partidos: (pt.data ?? []) as Partido[],
    pronosticos: (pr.data ?? []) as Pronostico[],
    alAire: (aa.data as AlAire | null) ?? AL_AIRE_INICIAL,
  };
}

/**
 * Trae toda la polla y la mantiene al día:
 * - en tiempo real (Supabase Realtime) cuando hay conexión,
 * - y de respaldo pregunta cada 5 s si el tiempo real no conecta (o cada minuto si sí).
 */
export function useDatos() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [estado, setEstado] = useState<EstadoConexion>('cargando');
  const vivo = useRef(false);
  const ocupado = useRef(false);
  const otraVez = useRef(false);
  const ultimo = useRef(0);
  const espera = useRef<number | undefined>(undefined);

  const recargar = useCallback(async () => {
    if (ocupado.current) {
      otraVez.current = true;
      return;
    }
    ocupado.current = true;
    try {
      const d = await traerTodo();
      ultimo.current = Date.now();
      setDatos(d);
      setEstado(vivo.current ? 'en-vivo' : 'respaldo');
    } catch (e) {
      console.warn('[polla] no pude leer los datos', e);
      setEstado('error');
    } finally {
      ocupado.current = false;
      if (otraVez.current) {
        otraVez.current = false;
        void recargar();
      }
    }
  }, []);

  useEffect(() => {
    void recargar();
    const programar = () => {
      window.clearTimeout(espera.current);
      espera.current = window.setTimeout(() => void recargar(), 200);
    };
    const canal = sb
      .channel('polla-cambios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pronosticos' }, programar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partidos' }, programar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'al_aire' }, programar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participantes' }, programar)
      .subscribe((status) => {
        const antes = vivo.current;
        vivo.current = status === 'SUBSCRIBED';
        if (vivo.current && !antes) void recargar();
        if (!vivo.current) setEstado((e) => (e === 'en-vivo' ? 'respaldo' : e));
      });

    const reloj = window.setInterval(() => {
      const cada = vivo.current ? 60_000 : 5_000;
      if (Date.now() - ultimo.current >= cada - 250) void recargar();
    }, 5_000);
    const alVolver = () => {
      if (document.visibilityState === 'visible') void recargar();
    };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('online', alVolver);
    return () => {
      window.clearInterval(reloj);
      window.clearTimeout(espera.current);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('online', alVolver);
      void sb.removeChannel(canal);
    };
  }, [recargar]);

  /** Cambio optimista en pantalla mientras la base confirma. */
  const cambiarLocal = useCallback((fn: (d: Datos) => Datos) => {
    setDatos((d) => (d ? fn(d) : d));
  }, []);

  return { datos, estado, recargar, cambiarLocal };
}
