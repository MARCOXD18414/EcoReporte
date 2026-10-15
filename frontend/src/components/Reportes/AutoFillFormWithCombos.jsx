import { useEffect, useRef, useState } from 'react';
import { Camera, Sparkles, Loader2, MapPin, Send, Trash2, PencilLine, CloudOff, LocateFixed, Siren, Save, CheckCircle2 } from 'lucide-react';
import CameraModal from './CameraModal.jsx';
import InteractivePinMap from './InteractivePinMap.jsx';
import { ComboTipo, ComboSeveridad } from './ComboSelectors.jsx';
import useGeolocation, { textoGps } from '../Shared/useGeolocation.js';
import { api } from '../../services/api.js';
import { enviarOGuardar } from '../../services/syncService.js';
import { CENTRO_CARMEN } from '../../services/catalogos.js';
import { leerBorrador, guardarBorrador, borrarBorrador, archivoADataUrl, dataUrlAArchivo } from '../../services/borrador.js';

/**
 * Flujo "cero escritura":
 *  1) Foto → Gemma 4 analiza y PRE-SELECCIONA los combos (tipo y severidad).
 *  2) El usuario sólo confirma/modifica con combos y botones con íconos.
 *  3) GPS de alta precisión + pin arrastrable para corregir la ubicación.
 *     Todo se AUTOGUARDA como borrador hasta enviar la ubicación definitiva.
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
  const [guardadoEn, setGuardadoEn] = useState(null);
  const [fotoDataUrl, setFotoDataUrl] = useState(null);
  const restaurado = useRef(false);

  // Restaurar el borrador autoguardado (si el usuario cerró la app antes de enviar)
  useEffect(() => {
    const b = leerBorrador();
    if (b) {
      if (b.pin) setPin(b.pin);
      if (b.tipoId) setTipoId(b.tipoId);
      if (b.severidadId) setSeveridadId(b.severidadId);
      if (b.descripcion) {
        setDescripcion(b.descripcion);
        setVerDetalle(true);
      }
      if (b.analisis) setAnalisis(b.analisis);
      if (b.fotoDataUrl) {
        setFotoDataUrl(b.fotoDataUrl);
        setPreview(b.fotoDataUrl);
        dataUrlAArchivo(b.fotoDataUrl).then(setFoto).catch(() => {});
      }
      setGuardadoEn(b.guardadoEn);
      notificar({ tipo: 'info', mensaje: 'Recuperamos tu reporte sin enviar: la ubicación y los datos siguen guardados.' });
    }
    restaurado.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Autoguardado: cada cambio (pin, combos, texto, foto) se guarda en el teléfono
  useEffect(() => {
    if (!restaurado.current) return;
    if (!(pin || tipoId || descripcion || fotoDataUrl)) return;
    const t = setTimeout(() => {
      setGuardadoEn(guardarBorrador({ pin, tipoId, severidadId, descripcion, analisis, fotoDataUrl }));
    }, 400);
    return () => clearTimeout(t);
  }, [pin, tipoId, severidadId, descripcion, analisis, fotoDataUrl]);

  // El GPS coloca el pin mientras el usuario no lo haya movido a mano
  useEffect(() => {
    if (gps.coords && !pin?.manual) setPin({ ...gps.coords, manual: false });
  }, [gps.coords]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => preview?.startsWith('blob:') && URL.revokeObjectURL(preview), [preview]);

  async function alTomarFoto(archivo) {
    setFoto(archivo);
    setPreview(URL.createObjectURL(archivo));
    setAnalisis(null);
    archivoADataUrl(archivo).then(setFotoDataUrl);
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
    setFotoDataUrl(null);
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
    borrarBorrador();
    setGuardadoEn(null);
  }

  async function enviar(e) {
    e.preventDefault();
    const ubicacion = pin || (gps.coords ? { ...gps.coords } : null);
    if (!ubicacion) {
      notificar({ tipo: 'error', mensaje: 'Indica la ubicación: toca el mapa para dejar el pin o espera la señal GPS.' });
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
          ? { tipo: 'exito', mensaje: '¡Gracias! Tu reporte fue enviado a Servicios Públicos. 💜' }
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
          <p className="text-morado-600">Toma una foto y deja que Gemma llene los datos por ti.</p>
        </div>
        <button type="button" onClick={onAlertaRapida} className="btn bg-magenta-600 text-white hover:bg-magenta-700 sm:hidden">
          <Siren size={18} aria-hidden /> Alerta rápida
        </button>
      </div>

      {/* Columna 1: foto + combos */}
      <section className="tarjeta space-y-5 p-4 sm:p-6">
        {!enLinea && (
          <p className="flex items-center gap-2 rounded-xl bg-morado-100 p-3 text-sm font-medium text-morado-800">
            <CloudOff size={18} aria-hidden /> Modo sin señal: tu reporte se guardará en el teléfono.
          </p>
        )}

        {preview ? (
          <div className="relative">
            <img src={preview} alt="Foto del incidente a reportar" className="h-56 w-full rounded-xl object-cover sm:h-72" />
            <button
              type="button"
              onClick={quitarFoto}
              className="absolute right-2 top-2 rounded-full bg-white/90 p-2 text-magenta-600 shadow"
              aria-label="Quitar foto"
            >
              <Trash2 size={18} aria-hidden />
            </button>
            {analizando && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-morado-900/70 text-white" role="status">
                <Loader2 size={36} className="animate-spin" aria-hidden />
                <p className="font-semibold">Gemma está analizando la foto…</p>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCamara(true)}
            className="flex h-48 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-magenta-400 bg-magenta-50 text-magenta-700 hover:bg-magenta-100 sm:h-60"
          >
            <Camera size={44} aria-hidden />
            <span className="text-lg font-bold">Tomar foto</span>
            <span className="text-sm">La IA detecta el problema automáticamente</span>
          </button>
        )}

        {analisis && (
          <div className="rounded-xl border border-magenta-200 bg-magenta-50 p-3 text-sm" role="status">
            <p className="flex items-center gap-1.5 font-bold text-magenta-800">
              <Sparkles size={16} aria-hidden /> Análisis de Gemma · {Math.round(analisis.confianza * 100)}% de confianza
            </p>
            {analisis.resumen && <p className="mt-1 text-morado-800">{analisis.resumen}</p>}
            {analisis.objetos_detectados?.length > 0 && (
              <p className="mt-1 text-xs text-morado-600">Detectado: {analisis.objetos_detectados.join(', ')}</p>
            )}
            {analisis.riesgo_fauna && <p className="mt-1 font-semibold text-magenta-700">🐢 Posible fauna en riesgo</p>}
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
            <MapPin size={18} className="text-magenta-500" aria-hidden /> Ubicación
          </h2>
          <button
            type="button"
            onClick={() => {
              setPin((p) => (p ? { ...p, manual: false } : null));
              gps.obtener();
            }}
            className="btn-suave min-h-[40px] px-3 text-sm"
          >
            <LocateFixed size={16} aria-hidden className={gps.cargando || gps.afinando ? 'animate-pulse' : ''} />
            {gps.cargando ? 'Buscando GPS…' : gps.afinando ? 'Afinando…' : 'Usar mi GPS'}
          </button>
        </div>
        <div className="space-y-1 text-xs" aria-live="polite">
          {pin ? (
            <p className="flex flex-wrap items-center gap-1 font-semibold text-turquesa-800">
              <CheckCircle2 size={14} aria-hidden /> Ubicación guardada: {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
              <span className="font-normal text-morado-600">
                {pin.manual ? '· colocada por ti en el mapa' : gps.precision ? `· GPS ±${gps.precision} m` : ''}
              </span>
            </p>
          ) : (
            <p className="text-morado-600">Toca el mapa para dejar el pin o espera la señal GPS.</p>
          )}
          {!pin?.manual && (gps.cargando || gps.afinando || gps.error) && <p className="text-morado-500">{textoGps(gps)}</p>}
        </div>
        <InteractivePinMap
          className="h-64 sm:h-80"
          pinEditable={pin || { lat: CENTRO_CARMEN[0], lng: CENTRO_CARMEN[1], manual: false }}
          onMoverPin={(p) => {
            setPin({ ...p, manual: true });
            gps.detener(); // el usuario decidió: el GPS ya no mueve su pin
          }}
          precisionPin={gps.precision}
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
            <p className="mt-1 text-right text-xs text-morado-500">{descripcion.length}/1000</p>
          </div>
        ) : (
          <button type="button" onClick={() => setVerDetalle(true)} className="btn justify-start px-0 text-sm text-morado-600 hover:text-morado-900">
            <PencilLine size={16} aria-hidden /> Agregar una especificación (opcional)
          </button>
        )}

        {guardadoEn && (
          <p className="mt-auto flex items-center justify-between gap-2 text-xs text-morado-600" role="status">
            <span className="flex items-center gap-1">
              <Save size={14} aria-hidden /> Borrador guardado automáticamente ·{' '}
              {new Date(guardadoEn).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button type="button" onClick={reiniciar} className="font-semibold text-magenta-600 underline">
              Descartar
            </button>
          </p>
        )}
        <button type="submit" disabled={enviando || analizando} className={`btn-primario w-full text-lg ${guardadoEn ? '' : 'mt-auto'}`}>
          {enviando ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <Send size={20} aria-hidden />}
          {enviando ? 'Enviando…' : enLinea ? 'Enviar reporte' : 'Guardar para enviar'}
        </button>
      </section>

      <CameraModal abierto={camara} onCerrar={() => setCamara(false)} onFoto={alTomarFoto} />
    </form>
  );
}
