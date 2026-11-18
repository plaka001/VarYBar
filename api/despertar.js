// Vercel Cron llama esta ruta dos veces al día (ver vercel.json).
// Supabase, en el plan gratis, pausa los proyectos con poca actividad durante una semana;
// con estas consultas diarias la base de la polla no se duerme antes del stream.
const URL = process.env.VITE_SUPABASE_URL || 'https://dzcnquvkedpammqjucie.supabase.co';
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_TxyFzuGWmt4Jk4GqbGGAEw_OmH35SDT';
const CONSULTAS = ['al_aire?select=id', 'participantes?select=id', 'partidos?select=id&limit=1'];

export default async function handler(_req, res) {
  try {
    const estados = [];
    for (const c of CONSULTAS) {
      const r = await fetch(`${URL}/rest/v1/${c}`, { headers: { apikey: KEY } });
      estados.push(r.status);
    }
    const ok = estados.every((s) => s === 200);
    res.status(ok ? 200 : 502).json({ ok, estados, hora: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e) });
  }
}
