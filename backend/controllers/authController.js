import bcrypt from 'bcryptjs';
import { db, check } from '../config/supabase.js';
import { firmarToken } from '../middleware/auth.js';

const ROL_SLUG = { 1: 'ciudadano', 2: 'admin' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST /api/auth/ciudadano  { alias?, usuario_id? } — acceso sin contraseña. */
export async function loginCiudadano(req, res) {
  const alias = String(req.body.alias || '').trim().slice(0, 40) || `Vecin@ ${Math.floor(1000 + Math.random() * 9000)}`;
  const previo = UUID_RE.test(req.body.usuario_id || '') ? req.body.usuario_id : null;

  let usuario = null;
  if (previo) {
    const { data } = await db().from('usuarios').select('id, alias, rol_id').eq('id', previo).eq('rol_id', 1).maybeSingle();
    usuario = data;
    if (usuario && alias !== usuario.alias) {
      usuario = check(await db().from('usuarios').update({ alias }).eq('id', usuario.id).select('id, alias, rol_id').single());
    }
  }
  if (!usuario) {
    if (alias.length < 2) return res.status(400).json({ error: 'El alias debe tener al menos 2 caracteres' });
    usuario = check(await db().from('usuarios').insert({ alias, rol_id: 1 }).select('id, alias, rol_id').single());
  }

  const sesion = { id: usuario.id, alias: usuario.alias, rol: ROL_SLUG[usuario.rol_id] };
  res.json({ usuario: sesion, token: firmarToken(sesion) });
}

/** POST /api/auth/admin  { email, password } */
export async function loginAdmin(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });

  const { data: usuario } = await db()
    .from('usuarios')
    .select('id, alias, rol_id, password_hash')
    .eq('email', email)
    .eq('rol_id', 2)
    .maybeSingle();

  const valido = usuario?.password_hash && (await bcrypt.compare(password, usuario.password_hash));
  if (!valido) return res.status(401).json({ error: 'Credenciales inválidas' });

  const sesion = { id: usuario.id, alias: usuario.alias, rol: 'admin' };
  res.json({ usuario: sesion, token: firmarToken(sesion) });
}
