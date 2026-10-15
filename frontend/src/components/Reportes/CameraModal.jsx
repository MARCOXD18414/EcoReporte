import { useEffect, useRef, useState } from 'react';
import { Camera, ImageUp, RefreshCw, X } from 'lucide-react';

/** Reduce la foto a ≤1280 px JPEG: menos datos móviles y cabe en IndexedDB. */
export async function comprimirImagen(archivo, max = 1280, calidad = 0.8) {
  const bitmap = await createImageBitmap(archivo).catch(() => null);
  if (!bitmap) return archivo; // formato no decodificable (p. ej. HEIC en algunos navegadores)
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', calidad));
  return new File([blob], 'reporte.jpg', { type: 'image/jpeg' });
}

/**
 * Cámara en vivo (getUserMedia) con respaldo a selector de archivo / cámara nativa.
 * @param {{abierto: boolean, onCerrar: () => void, onFoto: (file: File) => void}} props
 */
export default function CameraModal({ abierto, onCerrar, onFoto }) {
  const videoRef = useRef(null);
  const inputRef = useRef(null);
  const streamRef = useRef(null);
  const [modo, setModo] = useState('environment');
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    setListo(false);
    setError('');

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: modo, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelado) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setListo(true);
        }
      } catch {
        setError('No se pudo abrir la cámara. Usa “Elegir foto” para tomarla con la app de cámara.');
      }
    })();

    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [abierto, modo]);

  useEffect(() => {
    if (!abierto) return;
    const esc = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [abierto, onCerrar]);

  async function capturar() {
    const v = videoRef.current;
    if (!v?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d').drawImage(v, 0, 0);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
    onFoto(await comprimirImagen(blob));
    onCerrar();
  }

  async function desdeArchivo(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    onFoto(await comprimirImagen(archivo));
    onCerrar();
  }

  if (!abierto) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Tomar foto del incidente" className="fixed inset-0 z-[3000] flex flex-col bg-black">
      <div className="flex items-center justify-between p-3 text-white" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <h2 className="font-semibold">Foto del incidente</h2>
        <button onClick={onCerrar} className="rounded-full p-2 hover:bg-white/15" aria-label="Cerrar cámara">
          <X size={26} aria-hidden />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {error ? (
          <p className="max-w-sm px-6 text-center text-white">{error}</p>
        ) : (
          <video ref={videoRef} playsInline muted className="h-full w-full object-contain" aria-label="Vista previa de la cámara" />
        )}
      </div>

      <div className="flex items-center justify-around gap-4 p-5" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        <button onClick={() => inputRef.current?.click()} className="flex flex-col items-center gap-1 text-sm text-white">
          <span className="rounded-full bg-white/15 p-3.5"><ImageUp size={26} aria-hidden /></span>
          Elegir foto
        </button>
        <button
          onClick={capturar}
          disabled={!listo}
          aria-label="Tomar foto"
          className="h-20 w-20 rounded-full border-[6px] border-white bg-magenta-500 disabled:opacity-40"
        >
          <Camera size={30} className="mx-auto text-white" aria-hidden />
        </button>
        <button
          onClick={() => setModo((m) => (m === 'environment' ? 'user' : 'environment'))}
          className="flex flex-col items-center gap-1 text-sm text-white"
        >
          <span className="rounded-full bg-white/15 p-3.5"><RefreshCw size={26} aria-hidden /></span>
          Girar
        </button>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={desdeArchivo} />
      </div>
    </div>
  );
}
