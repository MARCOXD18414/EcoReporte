import { CATALOGOS_LOCALES } from './catalogos.js';

const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const SESION_KEY = 'ecoreporta_sesion';
const CATALOGOS_KEY = 'ecoreporta_catalogos';

// ---------- Sesión ----------
export function getSesion() {
  try {
    return JSON.parse(localStorage.getItem(SESION_KEY)) || null;
  } catch {
    return null;
  }
}
export function setSesion(sesion) {
  localStorage.setItem(SESION_KEY, JSON.stringify(sesion));
}
export function cerrarSesion() {
  const previa = getSesion();
  localStorage.removeItem(SESION_KEY);
  // Conservamos el id del ciudadano para reutilizar su perfil al volver
  if (previa?.usuario?.rol === 'ciudadano') localStorage.setItem('ecoreporta_ultimo_ciudadano', previa.usuario.id);
}

export class ApiError extends Error {
  constructor(message, status, offline = false) {
    super(message);
    this.status = status;
    this.offline = offline;
  }
}

async function request(path, { method = 'GET', body, formData, timeoutMs = 30000 } = {}) {
  const headers = {};
  const token = getSesion()?.token;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: formData || (body ? JSON.stringify(body) : undefined),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new ApiError('Sin conexión con el servidor', 0, true);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Error ${res.status}`, res.status, Boolean(data.offline));
  return data;
}

export const api = {
  // Catálogos con respaldo local
  async catalogos() {
    try {
      const data = await request('/reportes/catalogos', { timeoutMs: 8000 });
      localStorage.setItem(CATALOGOS_KEY, JSON.stringify(data));
      return data;
    } catch {
      try {
        return JSON.parse(localStorage.getItem(CATALOGOS_KEY)) || CATALOGOS_LOCALES;
      } catch {
        return CATALOGOS_LOCALES;
      }
    }
  },

  analizar(imagen, descripcion = '') {
    const fd = new FormData();
    if (imagen) fd.append('imagen', imagen, imagen.name || 'reporte.jpg');
    if (descripcion) fd.append('descripcion', descripcion);
    return request('/reportes/analizar', { method: 'POST', formData: fd, timeoutMs: 45000 });
  },
  crearReporte: (formData) => request('/reportes', { method: 'POST', formData, timeoutMs: 60000 }),
  listarReportes: (params = {}) => request(`/reportes?${new URLSearchParams(params)}`),
  obtenerReporte: (id) => request(`/reportes/${id}`),

  // Comunidad
  feed: (filtro = 'todos') => request(`/comunidad/feed?filtro=${filtro}`),
  brigadas: () => request('/comunidad/brigadas'),
  crearBrigada: (datos) => request('/comunidad/brigadas', { method: 'POST', body: datos }),
  unirseBrigada: (id) => request(`/comunidad/brigadas/${id}/unirse`, { method: 'POST' }),

  // Auth
  loginCiudadano: (alias) =>
    request('/auth/ciudadano', {
      method: 'POST',
      body: { alias, usuario_id: localStorage.getItem('ecoreporta_ultimo_ciudadano') || undefined },
    }),
  loginAdmin: (email, password) => request('/auth/admin', { method: 'POST', body: { email, password } }),

  // Dashboard (admin)
  kpis: () => request('/dashboard/kpis'),
  reportesAdmin: (params = {}) => request(`/dashboard/reportes?${new URLSearchParams(params)}`),
  notificaciones: () => request('/dashboard/notificaciones'),
  marcarLeida: (id) => request(`/dashboard/notificaciones/${id}/leida`, { method: 'PATCH' }),
  actualizarEstado: (id, estado, comentario) =>
    request(`/dashboard/reportes/${id}/estado`, { method: 'PATCH', body: { estado, comentario } }),
};
