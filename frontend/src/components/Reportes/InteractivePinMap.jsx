import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import { Crosshair, MapPin, X, Navigation } from 'lucide-react';
import { CENTRO_CARMEN, ESTILO_ESTADO, ESTILO_SEVERIDAD } from '../../services/catalogos.js';

/**
 * Mapa de PINES EXCLUSIVOS (sin capas térmicas ni mapas de calor).
 *  - Modo consulta: pines por reporte; al seleccionar se enfoca y muestra la tarjeta "Ubicación Seleccionada".
 *  - Modo edición: pin arrastrable / toque en el mapa para corregir la ubicación.
 */
function iconoPin({ emoji = '📍', color = '#880EBA', seleccionado = false }) {
  const tam = seleccionado ? 48 : 38;
  return L.divIcon({
    className: `pin-eco${seleccionado ? ' seleccionado' : ''}`,
    html: `<div class="pin-cuerpo" style="background:${color}"><span>${emoji}</span></div>`,
    iconSize: [tam, tam],
    iconAnchor: [tam / 2, tam],
  });
}

const iconoEdicion = iconoPin({ emoji: '📌', color: '#880EBA', seleccionado: true });

function Enfocar({ objetivo, zoom = 16 }) {
  const map = useMap();
  useEffect(() => {
    if (objetivo) map.flyTo(objetivo, Math.max(map.getZoom(), zoom), { duration: 0.8 });
  }, [objetivo?.[0], objetivo?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ClicParaColocar({ activo, onColocar, onDeseleccionar }) {
  useMapEvents({
    click(e) {
      if (activo) onColocar({ lat: e.latlng.lat, lng: e.latlng.lng });
      else onDeseleccionar?.();
    },
  });
  return null;
}

function BotonCentrar({ objetivo }) {
  const map = useMap();
  return (
    <button
      type="button"
      onClick={() => map.flyTo(objetivo, 15)}
      className="absolute right-3 top-3 z-[500] rounded-xl bg-white p-2.5 text-morado-800 shadow-tarjeta hover:bg-morado-50"
      aria-label="Centrar mapa"
    >
      <Crosshair size={22} aria-hidden />
    </button>
  );
}

export function TarjetaUbicacion({ reporte, onCerrar, acciones }) {
  const estado = ESTILO_ESTADO[reporte.estado_slug] || ESTILO_ESTADO.pendiente;
  const sev = ESTILO_SEVERIDAD[reporte.severidad_slug] || ESTILO_SEVERIDAD.moderada;
  const lat = Number(reporte.latitud).toFixed(6);
  const lng = Number(reporte.longitud).toFixed(6);

  return (
    <article
      aria-label="Ubicación seleccionada"
      className="tarjeta absolute inset-x-3 bottom-3 z-[600] max-h-[60%] overflow-y-auto p-4 md:inset-x-auto md:right-3 md:top-3 md:bottom-auto md:w-96 md:max-h-[calc(100%-1.5rem)]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-magenta-600">
          <MapPin size={14} aria-hidden /> Ubicación seleccionada
        </p>
        <button onClick={onCerrar} className="-m-1 rounded-lg p-1 hover:bg-morado-50" aria-label="Cerrar detalle">
          <X size={18} aria-hidden />
        </button>
      </div>
      <h3 className="mt-1 text-lg font-bold leading-snug">
        <span aria-hidden>{reporte.tipo_icono}</span> {reporte.tipo_nombre}
      </h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${estado.clase}`}>{reporte.estado_nombre}</span>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${sev.clase}`}>
          {sev.icono} {reporte.severidad_nombre}
        </span>
        {reporte.es_alerta_rapida && <span className="rounded-full bg-magenta-600 px-2.5 py-0.5 text-xs font-bold text-white">Alerta rápida</span>}
        {reporte.procesado_offline && <span className="rounded-full bg-morado-100 px-2.5 py-0.5 text-xs font-bold text-morado-700">Enviado offline</span>}
      </div>

      {reporte.imagen_url && (
        <img src={reporte.imagen_url} alt={`Foto del reporte: ${reporte.tipo_nombre}`} loading="lazy" className="mt-3 h-40 w-full rounded-xl object-cover" />
      )}
      {reporte.analisis_ia?.resumen && (
        <p className="mt-3 rounded-xl bg-morado-50 p-2.5 text-sm">
          <strong className="text-morado-700">Gemma IA:</strong> {reporte.analisis_ia.resumen}
          {reporte.confianza_ia != null && <span className="text-morado-500"> · {Math.round(reporte.confianza_ia * 100)}%</span>}
        </p>
      )}
      {reporte.descripcion_detallada && <p className="mt-2 text-sm text-morado-700">“{reporte.descripcion_detallada}”</p>}

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="font-semibold text-morado-500">Coordenadas</dt>
          <dd className="font-mono">{lat}, {lng}</dd>
        </div>
        <div>
          <dt className="font-semibold text-morado-500">Fecha</dt>
          <dd>{new Date(reporte.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</dd>
        </div>
      </dl>
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
        target="_blank"
        rel="noreferrer"
        className="btn-suave mt-3 w-full text-sm"
      >
        <Navigation size={16} aria-hidden /> Cómo llegar
      </a>
      {acciones && <div className="mt-2">{acciones(reporte)}</div>}
    </article>
  );
}

export default function InteractivePinMap({
  reportes = [],
  seleccionadoId = null,
  onSeleccionar,
  pinEditable = null,
  onMoverPin,
  className = 'h-[60vh]',
  mostrarTarjeta = true,
  accionesTarjeta,
  precisionPin = null,
  mostrarLeyenda = false,
}) {
  const seleccionado = useMemo(() => reportes.find((r) => r.id === seleccionadoId), [reportes, seleccionadoId]);
  const editable = typeof onMoverPin === 'function';
  // Sólo se re-enfoca con selección o con GPS; un ajuste manual no mueve la cámara
  const objetivo = seleccionado
    ? [Number(seleccionado.latitud), Number(seleccionado.longitud)]
    : pinEditable && !pinEditable.manual
      ? [pinEditable.lat, pinEditable.lng]
      : null;

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-morado-100 ${className}`}>
      <MapContainer
        center={objetivo || (pinEditable ? [pinEditable.lat, pinEditable.lng] : CENTRO_CARMEN)}
        zoom={pinEditable?.manual ? 16 : 13} className="h-full w-full" scrollWheelZoom zoomControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <Enfocar objetivo={objetivo} />
        <BotonCentrar objetivo={objetivo || CENTRO_CARMEN} />
        <ClicParaColocar activo={editable} onColocar={(p) => onMoverPin?.(p, true)} onDeseleccionar={() => onSeleccionar?.(null)} />

        {reportes.map((r) => (
          <Marker
            key={r.id}
            position={[Number(r.latitud), Number(r.longitud)]}
            icon={iconoPin({
              emoji: r.tipo_icono,
              color: (ESTILO_SEVERIDAD[r.severidad_slug] || ESTILO_SEVERIDAD.moderada).color,
              seleccionado: r.id === seleccionadoId,
            })}
            title={`${r.tipo_nombre} · Nivel ${r.severidad_nombre} · ${r.estado_nombre}`}
            alt={`${r.tipo_nombre}, nivel ${r.severidad_nombre}, ${r.estado_nombre}`}
            keyboard
            zIndexOffset={r.id === seleccionadoId ? 1000 : 0}
            eventHandlers={{ click: () => onSeleccionar?.(r.id) }}
          />
        ))}

        {editable && pinEditable && !pinEditable.manual && precisionPin > 0 && (
          <Circle
            center={[pinEditable.lat, pinEditable.lng]}
            radius={precisionPin}
            pathOptions={{ color: '#880EBA', fillColor: '#BA7CEE', fillOpacity: 0.18, weight: 1.5 }}
          />
        )}

        {editable && pinEditable && (
          <Marker
            position={[pinEditable.lat, pinEditable.lng]}
            icon={iconoEdicion}
            draggable
            autoPan
            title="Arrastra para ajustar la ubicación"
            alt="Ubicación del reporte (arrastrable)"
            zIndexOffset={2000}
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng();
                onMoverPin({ lat, lng }, true);
              },
            }}
          />
        )}
      </MapContainer>

      {editable && (
        <p className="pointer-events-none absolute left-3 top-3 z-[500] max-w-[70%] rounded-xl bg-morado-800/90 px-3 py-1.5 text-xs font-medium text-white">
          Toca el mapa o arrastra el pin 📌 para ajustar la ubicación
        </p>
      )}

      {mostrarLeyenda && (
        <ul
          aria-label="Nivel de los reportes"
          className="absolute bottom-6 left-3 z-[500] space-y-1 rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-morado-900 shadow-tarjeta"
        >
          {Object.values(ESTILO_SEVERIDAD).map((s) => (
            <li key={s.etiqueta} className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white shadow" style={{ background: s.color }} aria-hidden />
              {s.etiqueta}
            </li>
          ))}
        </ul>
      )}

      {mostrarTarjeta && seleccionado && (
        <TarjetaUbicacion reporte={seleccionado} onCerrar={() => onSeleccionar?.(null)} acciones={accionesTarjeta} />
      )}
    </div>
  );
}
