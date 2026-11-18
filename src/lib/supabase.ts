import { createClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Respuestas de las funciones con PIN (ver supabase/migrations).
export type Respuesta =
  | 'ok'
  | 'sin_pin'
  | 'pin_incorrecto'
  | 'bloqueado'
  | 'pin_corto'
  | 'ya_existe'
  | 'no_existe'
  | 'invalido';

export const MENSAJES: Record<string, string> = {
  sin_pin: 'Todavía no hay PIN creado',
  pin_incorrecto: 'PIN incorrecto',
  bloqueado: 'Demasiados intentos. Esperen 5 minutos',
  pin_corto: 'El PIN debe tener mínimo 4 caracteres',
  ya_existe: 'Ya hay un PIN creado',
  no_existe: 'Ese partido o participante no existe',
  invalido: 'Dato inválido',
};

export async function llamar(funcion: string, args: Record<string, unknown> = {}): Promise<Respuesta> {
  const { data, error } = await sb.rpc(funcion, args);
  if (error) throw new Error(error.message || 'No hubo conexión');
  return data as Respuesta;
}
