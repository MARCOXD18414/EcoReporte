import { useEffect, useState } from 'react';
import { Camera, Sparkles, Loader2, MapPin, Send, Trash2, PencilLine, CloudOff, LocateFixed, Siren } from 'lucide-react';
import CameraModal from './CameraModal.jsx';
import InteractivePinMap from './InteractivePinMap.jsx';
import { ComboTipo, ComboSeveridad } from './ComboSelectors.jsx';
import useGeolocation from '../Shared/useGeolocation.js';
import { api } from '../../services/api.js';
import { enviarOGuardar } from '../../services/syncService.js';
import { CENTRO_CARMEN } from '../../services/catalogos.js';

/**
 * Flujo "cero escritura":
 *  1) Foto → Gemma 4 analiza y PRE-SELECCIONA los combos (tipo y severidad).
 *  2) El usuario sólo confirma/modifica con combos y botones con íconos.
 *  3) GPS automático + pin arrastrable para corregir la ubicación.
 *  4) Texto libre opcional, oculto por defecto.
 *  Sin señal → se guarda en IndexedDB y Gemma lo analiza al sincronizar.
 */
export default function AutoFillFormWithCombos({ catalogos, enLinea, notificar, onEnviado, onAlertaRapida }) {
  const gps = useGeolocation();
  const [camara, setCamara] = useState(false);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analisis, setAnalisis] = useState(null);
  const [analizando, setAnalizando] = useState(false);
  const [tipoId, setTipoId] = useState(null);
  const [severidadId, setSeveridadId] = useState(2);
  const [sugeridos, setSugeridos] = useState({ tipo: false, severidad: false });
  const [pin, setPin] = useState(null);
  const [verDetalle, setVerDetalle] = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [enviando, setEnviando] = useState(false);

  // El GPS coloca el pin mientras el usuario no lo haya movido a mano
  useEffect(() => {
    if (gps.coords && !pin?.manual) setPin({ ...gps.coords, manual: false });
  }, [gps.coords]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  async function alTomarFoto(archivo) {
    setFoto(archivo);
    setPreview(URL.createObjectURL(archivo));
    setAnalisis(null);
    if (!navigator.onLine) {
      notificar({ tipo: 'offline', mensaje: 'Sin señal: elige el tipo con los íconos. Gemma analizará la foto al sincronizar.' });
      return;
    }
    setAnalizando(true);
    try {
      const { analisis: a, autocompletar } = await api.analizar(archivo, descripcion);
      setAnalisis(a);
      if (autocompletar && a.es_incidente_ambiental) {
        setTipoId(a.tipo_desecho_id);
        setSeveridadId(a.severidad_id);
        setSugeridos({ tipo: true, severidad: true });
      } else if (!a.es_incidente_ambiental) {
        notificar({ tipo: 'info', mensaje: 'Gemma no detectó un incidente ambiental claro. Elige el tipo manualmente.' });
      }
    } catch (err) {
      notificar({ tipo: err.offline ? 'offline' : 'error', mensaje: `No se pudo analizar ahora (${err.message}). Puedes continuar manualmente.` });
    } finally {
      setAnalizando(false);
    }
  }

  function quitarFoto() {
    setFoto(null);
    setPreview(null);
    setAnalisis(null);
    setSugeridos({ tipo: false, severidad: false });
  }

  function reiniciar() {
    quitarFoto();
    setTipoId(null);
    setSeveridadId(2);
    setDescripcion('');
    setVerDetalle(false);
    setPin(gps.coords ? { ...gps.coords, manual: false } : null);
  }

  async function enviar(e) {
    e.preventDefault();
    const ubicacion = pin || (gps.coords ? { ...gps.coords } : null);
    if (!ubicacion) {
      notificar({ tipo: 'error', mensaje: 'Indica la ubicación: activa el GPS o toca el mapa.' });
      return;
    }
    if (!tipoId && !foto) {
      notificar({ tipo: 'error', mensaje: 'Elige el tipo de problema o toma una foto.' });
      return;
    }
    setEnviando(true);
    try {
      const { estado } = await enviarOGuardar({
        tipo_desecho_id: tipoId,
        severidad_id: severidadId,
        latitud: ubicacion.lat,
        longitud: ubicacion.lng,
        ubicacion_ajustada: Boolean(pin?.manual),
        descripcion_detallada: descripcion.trim() || null,
        imagen: foto,
        analisis_ia: analisis,
        es_alerta_rapida: false,
      });
      notificar(
        estado === 'enviado'
          ? { tipo: 'exito', mensaje: '¡Gracias! Tu reporte fue enviado a Servicios Públicos. 🧡' }
          : { tipo: 'offline', mensaje: 'Guardado sin señal. Se enviará automáticamente al recuperar la red.' }
      );
      reiniciar();
      onEnviado?.();
    } catch (err) {
      notificar({ tipo: 'error', mensaje: err.message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-2" aria-labelledby="titulo-reporte">
      <div className="lg:col-span-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="titulo-reporte" className="text-2xl font-bold sm:text-3xl">Nuevo reporte</h1>
          <p className="text-marino-600">Toma una foto y deja que Gemma llene los datos por ti.</p>
        </div>
        <button type="button" onClick={onAlertaRapida} className="btn bg-red-600 text-white hover:bg-red-700 sm:hidden">
          <Siren size={18} aria-hidden /> Alerta rápida
        </button>
      </div>

      {/* Columna 1: foto + combos */}
      <section className="tarjeta space-y-5 p-4 sm:p-6">
        {!enLinea && (
          <p className="flex items-center gap-2 rounded-xl bg-marino-100 p-3 text-sm font-medium text-marino-800">
            <CloudOff size={18} aria-hidden /> Modo sin señal: tu reporte se guardará en el teléfono.
          </p>
        )}

        {preview ? (
          <div className="relative">
            <img src={preview} alt="Foto del incidente a reportar" className="h-56 w-full rounded-xl object-cover sm:h-72" />
            <button
              type="button"
              onClick={quitarFoto}
              className="absolute right-2 top-2 rounded-full bg-white/90 p-2 text-red-600 shadow"
              aria-label="Quitar foto"
            >
              <Trash2 size={18} aria-hidden />
            </button>
            {analizando && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-marino-900/70 text-white" role="status">
                <Loader2 size={36} className="animate-spin" aria-hidden />
                <p className="font-semibold">Gemma está analizando la foto…</p>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCamara(true)}
            className="flex h-48 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-naranja-400 bg-naranja-50 text-naranja-700 hover:bg-naranja-100 sm:h-60"
          >
            <Camera size={44} aria-hidden />
            <span className="text-lg font-bold">Tomar foto</span>
            <span className="text-sm">La IA detecta el problema automáticamente</span>
          </button>
        )}

        {analisis && (
          <div className="rounded-xl border border-naranja-200 bg-naranja-50 p-3 text-sm" role="status">
            <p className="flex items-center gap-1.5 font-bold text-naranja-800">
              <Sparkles size={16} aria-hidden /> Análisis de Gemma · {Math.round(analisis.confianza * 100)}% de confianza
            </p>
            {analisis.resumen && <p className="mt-1 text-marino-800">{analisis.resumen}</p>}
            {analisis.objetos_detectados?.length > 0 && (
              <p className="mt-1 text-xs text-marino-600">Detectado: {analisis.objetos_detectados.join(', ')}</p>
            )}
            {analisis.riesgo_fauna && <p className="mt-1 font-semibold text-red-700">🐢 Posible fauna en riesgo</p>}
          </div>
        )}

        <ComboTipo
          tipos={catalogos.tipos}
          valor={tipoId}
          sugeridoIA={sugeridos.tipo}
          onChange={(v) => {
            setTipoId(v);
            setSugeridos((s) => ({ ...s, tipo: false }));
          }}
        />
        <ComboSeveridad
          severidades={catalogos.severidades}
          valor={severidadId}
          sugeridoIA={sugeridos.severidad}
          onChange={(v) => {
            setSeveridadId(v);
            setSugeridos((s) => ({ ...s, severidad: false }));
          }}
        />
      </section>

      {/* Columna 2: ubicación + detalle opcional + enviar */}
      <section className="tarjeta flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 font-bold">
            <MapPin size={18} className="text-naranja-500" aria-hidden /> Ubicación
          </h2>
          <button type="button" onClick={() => { setPin(null); gps.obtener(); }} className="btn-suave min-h-[40px] px-3 text-sm">
            <LocateFixed size={16} aria-hidden /> {gps.cargando ? 'Buscando GPS…' : 'Usar mi GPS'}
          </button>
        </div>
        <p className="text-xs text-marino-600" aria-live="polite">
          {gps.error ||
            (pin
              ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}${pin.manual ? ' · ajustada manualmente' : gps.precision ? ` · precisión ±${gps.precision} m` : ''}`
              : 'Obteniendo ubicación…')}
        </p>
        <InteractivePinMap
          className="h-64 sm:h-80"
          pinEditable={pin || { lat: CENTRO_CARMEN[0], lng: CENTRO_CARMEN[1], manual: false }}
          onMoverPin={(p) => setPin({ ...p, manual: true })}
          mostrarTarjeta={false}
        />

        {verDetalle ? (
          <div>
            <label htmlFor="detalle" className="etiqueta">Especificación detallada (opcional)</label>
            <textarea
              id="detalle"
              rows={3}
              maxLength={1000}
              className="campo"
              placeholder="Sólo si algo no lo cubren las opciones. Ej. “La red tiene una tortuga atrapada”"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
            <p className="mt-1 text-right text-xs text-marino-500">{descripcion.length}/1000</p>
          </div>
        ) : (
          <button type="button" onClick={() => setVerDetalle(true)} className="btn justify-start px-0 text-sm text-marino-600 hover:text-marino-900">
            <PencilLine size={16} aria-hidden /> Agregar una especificación (opcional)
          </button>
        )}

        <button type="submit" disabled={enviando || analizando} className="btn-primario mt-auto w-full text-lg">
          {enviando ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <Send size={20} aria-hidden />}
          {enviando ? 'Enviando…' : enLinea ? 'Enviar reporte' : 'Guardar para enviar'}
        </button>
      </section>

      <CameraModal abierto={camara} onCerrar={() => setCamara(false)} onFoto={alTomarFoto} />
    </form>
  );
}
