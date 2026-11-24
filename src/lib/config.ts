// Proyecto de Supabase "VarYBar".
// La clave publicable está hecha para ir en el navegador: nadie puede escribir con ella,
// porque las tablas solo dejan leer y todo cambio pasa por funciones que piden el PIN del máster.
// Si algún día cambian de proyecto, se pueden sobreescribir con variables de entorno en Vercel.
export const SUPABASE_URL: string =
  import.meta.env.VITE_SUPABASE_URL || 'https://dzcnquvkedpammqjucie.supabase.co';

export const SUPABASE_KEY: string =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_TxyFzuGWmt4Jk4GqbGGAEw_OmH35SDT';

// Redes que salen con QR en la trivia (hay que seguirlas para reclamar el premio).
export const REDES = [
  { nombre: 'Instagram', url: 'https://instagram.com/varybarpodcast', muestra: '@varybarpodcast' },
  { nombre: 'TikTok', url: 'https://www.tiktok.com/@varybarpodcast', muestra: '@varybarpodcast' },
  { nombre: 'Kick', url: 'https://kick.com/varybarpodcast', muestra: 'kick.com/varybarpodcast' },
];
