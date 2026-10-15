import { useEffect, useState } from 'react';
import { Siren, X, Loader2, LocateFixed } from 'lucide-react';
import useGeolocation from '../Shared/useGeolocation.js';
import { enviarOGuardar } from '../../services/syncService.js';
import { ESTILO_SEVERIDAD, TIPOS_ALERTA_RAPIDA } from '../../services/catalogos.js';

/**
 * Alerta Rápida / Emergencia Express: SIN foto obligatoria.
 * 1 toque sobre el ícono = se envía con GPS instantáneo y la severidad elegida (Crítica por defecto).
 */
export default function QuickAlert({ abierto, onCerrar, catalogos, notificar, onEnviado }) {
  const gps = useGeolocation({ auto: false });
  const [severidadId, setSeveridadId] = useState(3);
  const [enviandoId, setEnviandoId] = useState(null);

  useEffect(() => {
    if (abierto) {
      gps.obtener();
      setSeveridadId(3);
    }
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!abierto) return;
    const esc = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  const tipos = catalogos.tipos.filter((t) => TIPOS_ALERTA_RAPIDA.includes(t.id));

  async function enviar(tipoId) {
    if (!gps.coords) {
      notificar({ tipo: 'error', mensaje: 'Aún no hay GPS. Espera un momento o usa “Reportar” para colocar el pin.' });
      return;
    }
    setEnviandoId(tipoId);
    try {
      const { estado } = await enviarOGuardar({
        tipo_desecho_id: tipoId,
        severidad_id: severidadId,
        latitud: gps.coords.lat,
        longitud: gps.coords.lng,
        es_alerta_rapida: true,
      });
      notificar(
        estado === 'enviado'
          ? { tipo: 'exito', mensaje: '🚨 Alerta enviada. Servicios Públicos ya fue notificado.' }
          : { tipo: 'offline', mensaje: '🚨 Alerta guardada sin señal. Se enviará en cuanto haya red.' }
      );
      onEnviado?.();
      onCerrar();
    } catch (err) {
      notificar({ tipo: 'error', mensaje: err.message });
    } finally {
      setEnviandoId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[2500] flex items-end justify-center bg-marino-950/70 sm:items-center" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-alerta"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-3xl bg-white p-5 sm:rounded-3xl"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-start justify-between">
          <h2 id="titulo-alerta" className="flex items-center gap-2 text-xl font-bold text-red-700">
            <Siren aria-hidden /> Alerta rápida
          </h2>
          <button onClick={onCerrar} className="rounded-lg p-1.5 hover:bg-marino-50" aria-label="Cerrar alerta rápida">
            <X aria-hidden />
          </button>
        </div>
        <p className="mt-1 text-sm text-marino-600">Toca un ícono y se envía al instante con tu ubicación. No necesitas foto.</p>

        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium" aria-live="polite">
          <LocateFixed size={14} aria-hidden className={gps.coords ? 'text-emerald-600' : 'text-naranja-500'} />
          {gps.cargando
            ? 'Obteniendo GPS…'
            : gps.coords
              ? `GPS listo · ±${gps.precision} m`
              : gps.error || 'GPS no disponible'}
          {!gps.coords && !gps.cargando && (
            <button onClick={gps.obtener} className="ml-1 underline">Reintentar</button>
          )}
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Severidad">
          {catalogos.severidades.map((s) => {
            const est = ESTILO_SEVERIDAD[s.slug];
            return (
              <button
                key={s.id}
                role="radio"
                aria-checked={severidadId === s.id}
                onClick={() => setSeveridadId(s.id)}
                className={`chip justify-center ${severidadId === s.id ? est.clase : 'border-marino-100 text-marino-600'}`}
              >
                {est.icono} {s.nombre}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tipos.map((t) => (
            <button
              key={t.id}
              disabled={Boolean(enviandoId) || !gps.coords}
              onClick={() => enviar(t.id)}
              className="flex min-h-[104px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-red-200 bg-red-50 p-3 text-center text-sm font-bold text-red-900 hover:border-red-500 disabled:opacity-50"
            >
              {enviandoId === t.id ? <Loader2 className="animate-spin" size={32} aria-hidden /> : <span className="text-4xl" aria-hidden>{t.icono}</span>}
              <span className="leading-tight">{t.nombre.split(' / ')[0]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
