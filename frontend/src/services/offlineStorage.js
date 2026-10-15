/**
 * Base de datos #2 (gratuita, local): IndexedDB.
 * Guarda reportes capturados sin señal — incluida la foto como Blob — hasta poder sincronizarlos.
 */
const DB_NAME = 'ecoreporta-carmen';
const DB_VERSION = 1;
const STORE = 'reportes_pendientes';

let dbPromise = null;

function abrirDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB no disponible'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'client_uuid' });
        store.createIndex('capturado_en', 'capturado_en');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(modo, fn) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, modo);
    const store = t.objectStore(STORE);
    const resultado = fn(store);
    t.oncomplete = () => resolve(resultado?.result ?? resultado);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/**
 * @param {object} reporte  { client_uuid, tipo_desecho_id, severidad_id, latitud, longitud,
 *                            descripcion_detallada, imagen (Blob|null), es_alerta_rapida, ... }
 */
export function guardarPendiente(reporte) {
  const registro = {
    ...reporte,
    client_uuid: reporte.client_uuid || crypto.randomUUID(),
    capturado_en: reporte.capturado_en || new Date().toISOString(),
    intentos: reporte.intentos || 0,
  };
  return tx('readwrite', (s) => s.put(registro)).then(() => registro);
}

export function listarPendientes() {
  return tx('readonly', (s) => s.getAll()).then((r) =>
    (r || []).sort((a, b) => a.capturado_en.localeCompare(b.capturado_en))
  );
}

export function eliminarPendiente(clientUuid) {
  return tx('readwrite', (s) => s.delete(clientUuid));
}

export function actualizarPendiente(registro) {
  return tx('readwrite', (s) => s.put(registro));
}

export async function contarPendientes() {
  try {
    return await tx('readonly', (s) => s.count());
  } catch {
    return 0;
  }
}
