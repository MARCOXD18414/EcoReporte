import { useEffect, useState } from 'react';
import { Siren, X, Loader2, LocateFixed, MapPin, Send, CheckCircle2 } from 'lucide-react';
import InteractivePinMap from './InteractivePinMap.jsx';
import useGeolocation, { textoGps } from '../Shared/useGeolocation.js';
import { enviarOGuardar } from '../../services/syncService.js';
import { CENTRO_CARMEN, ESTILO_SEVERIDAD, TIPOS_ALERTA_RAPIDA } from '../../services/catalogos.js';

/**
 * Alerta Rápida / Emergencia Express (SIN foto obligatoria).
 *  1) Ubicación: “Usar mi GPS” (alta precisión) o “Colocar pin” en el mini mapa.
 *  2) Tipo con íconos grandes + severidad (Crítica por defecto).
 *  3) Botón “Enviar alerta” desde la misma ventana.
 */
export default function QuickAlert({ abierto, onCerrar, catalogos, notificar, onEnviado }) {
  const gps = useGeolocation({ auto: false });
  const [modo, setModo] = useState('gps'); // 'gps' | 'pin'
  const [pin, setPin] = useState(null);
  const [tipoId, setTipoId] = useState(null);
  const [severidadId, setSeveridadId] = useState(3);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (abierto) {
      setModo('gps');
      setPin(null);
      setTipoId(null);
      setSeveridadId(3);
      gps.obtener();
    } else {
      gps.detener();
    }
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  // En modo GPS el pin sigue la mejor lectura
  useEffect(() => {
    if (modo === 'gps' && gps.coords) setPin({ ...gps.coords, manual: false });
  }, [gps.coords, modo]);

  useEffect(() => {
    if (!abierto) return;
    const esc = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  const tipos = catalogos.tipos.filter((t) => TIPOS_ALERTA_RAPIDA.includes(t.id));

  function usarGps() {
    setModo('gps');
    setPin(gps.coords ? { ...gps.coords, manual: false } : null);
    gps.obtener();
  }

  function usarPin() {
    setModo('pin');
    gps.detener();
    // Arranca donde esté el GPS (o el centro de Carmen) para que sólo haya que moverlo
    setPin((p) => ({ ...(p || { lat: CENTRO_CARMEN[0], lng: CENTRO_CARMEN[1] }), manual: true }));
  }

  async function enviar() {
    if (!pin) {
      notificar({ tipo: 'error', mensaje: 'Aún no hay ubicación: espera el GPS o elige “Colocar pin”.' });
      return;
    }
    if (!tipoId) {
      notificar({ tipo: 'error', mensaje: 'Elige qué está pasando tocando uno de los íconos.' });
      return;
    }
    setEnviando(true);
    try {
      const { estado } = await enviarOGuardar({
        tipo_desecho_id: tipoId,
        severidad_id: severidadId,
        latitud: pin.lat,
        longitud: pin.lng,
        ubicacion_ajustada: modo === 'pin',
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
      setEnviando(false);
    }
  }

  const listo = Boolean(pin && tipoId);

  return (
    <div className="fixed inset-0 z-[2500] flex items-end justify-center bg-morado-950/70 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-alerta"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[95dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-start justify-between">
          <h2 id="titulo-alerta" className="flex items-center gap-2 text-xl font-bold text-magenta-600">
            <Siren aria-hidden /> Alerta rápida
          </h2>
          <button onClick={onCerrar} className="rounded-lg p-1.5 hover:bg-morado-50" aria-label="Cerrar alerta rápida">
            <X aria-hidden />
          </button>
        </div>
        <p className="mt-1 text-sm text-morado-600">No necesitas foto. Indica dónde, qué pasa y envía.</p>

        {/* 1. Ubicación */}
        <h3 className="mt-4 text-sm font-bold text-morado-900">1. ¿Dónde?</h3>
        <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Forma de indicar la ubicación">
          <button
            role="radio"
            aria-checked={modo === 'gps'}
            onClick={usarGps}
            className={`chip justify-center ${modo === 'gps' ? 'border-morado-700 bg-morado-700 text-white' : 'border-morado-200 text-morado-700'}`}
          >
            <LocateFixed size={16} aria-hidden className={gps.cargando || gps.afinando ? 'animate-pulse' : ''} /> Usar mi GPS
          </button>
          <button
            role="radio"
            aria-checked={modo === 'pin'}
            onClick={usarPin}
            className={`chip justify-center ${modo === 'pin' ? 'border-morado-700 bg-morado-700 text-white' : 'border-morado-200 text-morado-700'}`}
          >
            <MapPin size={16} aria-hidden /> Colocar pin
          </button>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium" aria-live="polite">
          {modo === 'pin' ? (
            <span className="flex items-center gap-1 text-turquesa-800">
              <CheckCircle2 size={14} aria-hidden /> Toca el mapa o arrastra el pin 📌 · {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
            </span>
          ) : (
            <span className={gps.coords && !gps.afinando ? 'text-turquesa-800' : 'text-morado-600'}>{textoGps(gps)}</span>
          )}
        </p>
        <InteractivePinMap
          className="mt-2 h-44 shrink-0 sm:h-52"
          pinEditable={pin || { lat: CENTRO_CARMEN[0], lng: CENTRO_CARMEN[1], manual: false }}
          onMoverPin={(p) => {
            setModo('pin');
            gps.detener();
            setPin({ ...p, manual: true });
          }}
          precisionPin={modo === 'gps' ? gps.precision : null}
          mostrarTarjeta={false}
        />

        {/* 2. Qué pasa */}
        <h3 className="mt-4 text-sm font-bold text-morado-900">2. ¿Qué está pasando?</h3>
        <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de alerta">
          {tipos.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={tipoId === t.id}
              onClick={() => setTipoId(t.id)}
              className={`flex min-h-[86px] flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 text-center text-xs font-bold transition ${
                tipoId === t.id ? 'border-magenta-500 bg-magenta-50 text-magenta-800' : 'border-morado-100 bg-white text-morado-800 hover:border-morado-300'
              }`}
            >
              <span className="text-3xl" aria-hidden>{t.icono}</span>
              <span className="leading-tight">{t.nombre.split(' / ')[0]}</span>
            </button>
          ))}
        </div>

        {/* 3. Nivel */}
        <h3 className="mt-4 text-sm font-bold text-morado-900">3. Nivel</h3>
        <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Nivel de la alerta">
          {catalogos.severidades.map((s) => {
            const est = ESTILO_SEVERIDAD[s.slug];
            return (
              <button
                key={s.id}
                role="radio"
                aria-checked={severidadId === s.id}
                onClick={() => setSeveridadId(s.id)}
                className={`chip justify-center ${severidadId === s.id ? est.clase : 'border-morado-100 text-morado-600'}`}
              >
                {est.icono} {s.nombre}
              </button>
            );
          })}
        </div>

        <button onClick={enviar} disabled={enviando || !listo} className="btn mt-5 w-full shrink-0 bg-magenta-500 text-lg text-white hover:bg-magenta-600">
          {enviando ? <Loader2 className="animate-spin" size={20} aria-hidden /> : <Send size={20} aria-hidden />}
          {enviando ? 'Enviando…' : 'Enviar alerta'}
        </button>
        {!listo && (
          <p className="mt-2 text-center text-xs text-morado-500">
            {!pin ? 'Esperando ubicación…' : 'Elige qué está pasando para poder enviar.'}
          </p>
        )}
      </div>
    </div>
  );
}
