import { createClient } from '@supabase/supabase-js';

// Toma sólo el primer "token": tolera claves pegadas con espacios, comillas o líneas extra
// (p. ej. en el panel del hosting se pegó "eyJ...\nSUPABASE_BUCKET=reportes").
export const limpiarValor = (v) => String(v || '').trim().replace(/^["']|["']$/g, '').split(/\s+/)[0] || undefined;

const url = limpiarValor(process.env.SUPABASE_URL);
const serviceKey = limpiarValor(process.env.SUPABASE_SERVICE_ROLE_KEY);

export const STORAGE_BUCKET = limpiarValor(process.env.SUPABASE_BUCKET) || 'reportes';

export const supabase =
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

if (!supabase) {
  console.warn('[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configurados: la API responderá 503 en rutas de datos.');
}

/** Devuelve el cliente o lanza un 503 legible. */
export function db() {
  if (!supabase) {
    const err = new Error('Base de datos no configurada. Revisa backend/.env');
    err.status = 503;
    throw err;
  }
  return supabase;
}

/** Lanza el error de Supabase con un status HTTP útil. */
export function check({ data, error }, status = 500) {
  if (error) {
    const err = new Error(error.message);
    err.status = error.code === 'PGRST116' ? 404 : status;
    err.details = error.details;
    throw err;
  }
  return data;
}
