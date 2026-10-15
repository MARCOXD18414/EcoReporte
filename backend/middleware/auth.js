import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-secret-ecoreporta';
if (!process.env.JWT_SECRET) console.warn('[auth] JWT_SECRET no definido: usando secreto de desarrollo.');

export function firmarToken(usuario) {
  return jwt.sign({ sub: usuario.id, alias: usuario.alias, rol: usuario.rol }, SECRET, { expiresIn: '30d' });
}

function leerToken(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(h.slice(7), SECRET);
  } catch {
    return null;
  }
}

/** Adjunta req.usuario si hay token válido; nunca bloquea. */
export function autenticacionOpcional(req, _res, next) {
  req.usuario = leerToken(req);
  next();
}

export function requiereAuth(req, res, next) {
  req.usuario = leerToken(req);
  if (!req.usuario) return res.status(401).json({ error: 'Inicia sesión para continuar' });
  next();
}

export function requiereAdmin(req, res, next) {
  req.usuario = leerToken(req);
  if (!req.usuario) return res.status(401).json({ error: 'Sesión requerida' });
  if (req.usuario.rol !== 'admin') return res.status(403).json({ error: 'Acceso exclusivo para Servicios Públicos' });
  next();
}
