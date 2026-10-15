/**
 * Sincronización híbrida: en línea → backend (Gemma 4); sin señal → IndexedDB.
 * Al recuperar la red se envía la cola y el backend ejecuta la inferencia pendiente.
 */
import { api } from './api.js';
import { guardarPendiente, listarPendientes, eliminarPendiente, actualizarPendiente, contarPendientes } from './offlineStorage.js';

export const EVENTO_SYNC = 'ecoreporta:sync';
let sincronizando = false;

function emitir(detalle) {
  window.dispatchEvent(new CustomEvent(EVENTO_SYNC, { detail: detalle }));
}

export function reporteAFormData(r, extra = {}) {
  const fd = new FormData();
  const campos = {
    client_uuid: r.client_uuid,
    tipo_desecho_id: r.tipo_desecho_id,
    severidad_id: r.severidad_id,
    latitud: r.latitud,
    longitud: r.longitud,
    ubicacion_ajustada: r.ubicacion_ajustada,
    descripcion_detallada: r.descripcion_detallada,
    es_alerta_rapida: r.es_alerta_rapida,
    capturado_en: r.capturado_en,
    analisis_ia: r.analisis_ia ? JSON.stringify(r.analisis_ia) : undefined,
    ...extra,
  };
  Object.entries(campos).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') fd.append(k, String(v));
  });
  if (r.imagen) fd.append('imagen', r.imagen, 'reporte.jpg');
  return fd;
}

/**
 * Intenta enviar; si no hay red (o el servidor no responde) guarda en IndexedDB.
 * @returns {{estado: 'enviado'|'guardado_offline', reporte?: object}}
 */
export async function enviarOGuardar(reporte) {
  const registro = {
    ...reporte,
    client_uuid: reporte.client_uuid || crypto.randomUUID(),
    capturado_en: reporte.capturado_en || new Date().toISOString(),
  };

  if (navigator.onLine) {
    try {
      const { reporte: guardado } = await api.crearReporte(reporteAFormData(registro));
      return { estado: 'enviado', reporte: guardado };
    } catch (err) {
      // Error de validación real (4xx): no tiene sentido encolarlo
      if (!err.offline && err.status >= 400 && err.status < 500) throw err;
    }
  }
  await guardarPendiente(registro);
  emitir({ pendientes: await contarPendientes() });
  solicitarBackgroundSync();
  return { estado: 'guardado_offline', reporte: registro };
}

export async function sincronizarPendientes() {
  if (sincronizando || !navigator.onLine) return { enviados: 0, fallidos: 0 };
  sincronizando = true;
  let enviados = 0;
  let fallidos = 0;
  try {
    const pendientes = await listarPendientes();
    if (!pendientes.length) return { enviados, fallidos };
    emitir({ sincronizando: true, pendientes: pendientes.length });

    for (const p of pendientes) {
      try {
        await api.crearReporte(reporteAFormData(p, { procesado_offline: true }));
        await eliminarPendiente(p.client_uuid);
        enviados++;
      } catch (err) {
        fallidos++;
        if (err.offline) break; // se volvió a ir la señal
        await actualizarPendiente({ ...p, intentos: (p.intentos || 0) + 1, ultimo_error: err.message });
      }
    }
  } finally {
    sincronizando = false;
    emitir({ sincronizando: false, enviados, fallidos, pendientes: await contarPendientes() });
  }
  return { enviados, fallidos };
}

export async function solicitarBackgroundSync() {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg && 'sync' in reg) await reg.sync.register('ecoreporta-sync');
  } catch {
    /* Background Sync no soportado (Safari/Firefox): basta el evento 'online' */
  }
}

/** Arranca los disparadores de sincronización. Devuelve función de limpieza. */
export function iniciarSincronizacion() {
  const alVolverRed = () => sincronizarPendientes();
  const alMensajeSW = (e) => e.data?.type === 'SYNC_REPORTS' && sincronizarPendientes();

  window.addEventListener('online', alVolverRed);
  navigator.serviceWorker?.addEventListener('message', alMensajeSW);
  const intervalo = setInterval(sincronizarPendientes, 60_000);
  sincronizarPendientes();

  return () => {
    window.removeEventListener('online', alVolverRed);
    navigator.serviceWorker?.removeEventListener('message', alMensajeSW);
    clearInterval(intervalo);
  };
}
