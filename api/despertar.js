// Vercel Cron llama esta ruta una vez al día (ver vercel.json).
// Supabase, en el plan gratis, pausa los proyectos que pasan una semana sin uso;
// con esta consulta diaria la base de la polla nunca se duerme antes del stream.
const URL = process.env.VITE_SUPABASE_URL || 'https://dzcnquvkedpammqjucie.supabase.co';
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_TxyFzuGWmt4Jk4GqbGGAEw_OmH35SDT';

export default async function handler(_req, res) {
  try {
    const r = await fetch(`${URL}/rest/v1/al_aire?select=id`, { headers: { apikey: KEY } });
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, estado: r.status, hora: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e) });
  }
}
