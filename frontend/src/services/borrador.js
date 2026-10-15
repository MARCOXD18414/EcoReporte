/**
 * Autoguardado del reporte en curso (borrador).
 * Mientras el usuario coloca el pin, elige combos o toma la foto, todo se guarda en el
 * teléfono; si cierra la app o se le apaga la pantalla, al volver sigue donde se quedó.
 * Se borra al enviar el reporte definitivo.
 */
const KEY = 'ecoreporta_borrador';
const VIGENCIA_MS = 24 * 60 * 60 * 1000;

export function leerBorrador() {
  try {
    const b = JSON.parse(localStorage.getItem(KEY));
    if (!b || Date.now() - new Date(b.guardadoEn).getTime() > VIGENCIA_MS) return null;
    return b;
  } catch {
    return null;
  }
}

export function guardarBorrador(datos) {
  const guardadoEn = new Date().toISOString();
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...datos, guardadoEn }));
  } catch {
    // Sin espacio (foto muy grande): se guarda todo menos la foto
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...datos, fotoDataUrl: null, guardadoEn }));
    } catch {
      return null;
    }
  }
  return guardadoEn;
}

export function borrarBorrador() {
  localStorage.removeItem(KEY);
}

export const archivoADataUrl = (archivo) =>
  new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => resolve(null);
    r.readAsDataURL(archivo);
  });

export async function dataUrlAArchivo(dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], 'reporte.jpg', { type: blob.type || 'image/jpeg' });
}
