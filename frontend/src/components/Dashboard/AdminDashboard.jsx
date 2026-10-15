import { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, CheckCheck, ClipboardList, Percent, Siren, CloudUpload, RefreshCw, MapPin, ArrowRight, Image as ImageIcon } from 'lucide-react';
import AnalyticsCharts from './AnalyticsCharts.jsx';
import { api } from '../../services/api.js';
import { ESTILO_ESTADO, ESTILO_SEVERIDAD } from '../../services/catalogos.js';

const FLUJO = ['pendiente', 'en_proceso', 'resuelto'];

/** Selector de estatus reutilizable (tabla y tarjeta del mapa). */
export function AccionesEstado({ reporte, onActualizado, notificar }) {
  const [guardando, setGuardando] = useState(false);
  const siguiente = FLUJO[FLUJO.indexOf(reporte.estado_slug) + 1];

  async function cambiar(estado) {
    if (estado === reporte.estado_slug) return;
    setGuardando(true);
    try {
      const { reporte: actualizado } = await api.actualizarEstado(reporte.id, estado);
      notificar?.({ tipo: 'exito', mensaje: `Reporte marcado como “${actualizado.estado_nombre}”.` });
      onActualizado?.(actualizado);
    } catch (err) {
      notificar?.({ tipo: 'error', mensaje: err.message });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`estado-${reporte.id}`}>Estatus</label>
      <select
        id={`estado-${reporte.id}`}
        value={reporte.estado_slug}
        disabled={guardando}
        onChange={(e) => cambiar(e.target.value)}
        className="campo min-h-[40px] py-1.5 text-sm"
      >
        {FLUJO.map((s) => <option key={s} value={s}>{ESTILO_ESTADO[s].etiqueta}</option>)}
      </select>
      {siguiente && (
        <button
          onClick={() => cambiar(siguiente)}
          disabled={guardando}
          className="btn min-h-[40px] shrink-0 bg-morado-800 px-3 text-xs text-white hover:bg-morado-700"
          title={`Avanzar a ${ESTILO_ESTADO[siguiente].etiqueta}`}
        >
          <ArrowRight size={16} aria-hidden /> <span className="hidden xl:inline">{ESTILO_ESTADO[siguiente].etiqueta}</span>
        </button>
      )}
    </div>
  );
}

function Kpi({ Icono, titulo, valor, detalle, acento }) {
  return (
    <div className="tarjeta flex items-center gap-3 p-4">
      <span className={`rounded-xl p-3 ${acento}`}><Icono size={24} aria-hidden /></span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-morado-500">{titulo}</p>
        <p className="text-2xl font-bold">{valor}</p>
        {detalle && <p className="text-xs text-morado-500">{detalle}</p>}
      </div>
    </div>
  );
}

export default function AdminDashboard({ notificar, onVerEnMapa }) {
  const [kpis, setKpis] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [reportes, setReportes] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [k, n, r] = await Promise.all([api.kpis(), api.notificaciones(), api.reportesAdmin({ limite: 500 })]);
      setKpis(k);
      setNotifs(n.notificaciones);
      setReportes(r.reportes);
    } catch (err) {
      notificar({ tipo: 'error', mensaje: err.message });
    } finally {
      setCargando(false);
    }
  }, [notificar]);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 30_000);
    return () => clearInterval(t);
  }, [cargar]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return reportes.filter(
      (r) =>
        (!filtroEstado || r.estado_slug === filtroEstado) &&
        (!q || `${r.tipo_nombre} ${r.categoria_nombre} ${r.usuario_alias || ''} ${r.descripcion_detallada || ''}`.toLowerCase().includes(q))
    );
  }, [reportes, filtroEstado, busqueda]);

  async function leer(id) {
    try {
      await api.marcarLeida(id);
      setNotifs((ns) => ns.map((n) => (n.id === id ? { ...n, leida: true } : n)));
    } catch (err) {
      notificar({ tipo: 'error', mensaje: err.message });
    }
  }

  const alActualizar = (actualizado) => {
    setReportes((rs) => rs.map((r) => (r.id === actualizado.id ? actualizado : r)));
    api.kpis().then(setKpis).catch(() => {});
  };

  const noLeidas = notifs.filter((n) => !n.leida).length;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Panel de Servicios Públicos</h1>
          <p className="text-morado-600">Atención de reportes ambientales · Ciudad del Carmen</p>
        </div>
        <button onClick={cargar} className="btn-suave">
          <RefreshCw size={18} className={cargando ? 'animate-spin' : ''} aria-hidden /> Actualizar
        </button>
      </div>

      {kpis && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi Icono={ClipboardList} titulo="Total de reportes" valor={kpis.total} detalle={`${kpis.porEstado.pendiente} pendientes`} acento="bg-morado-100 text-morado-800" />
          <Kpi Icono={Percent} titulo="% Resueltos" valor={`${kpis.porcentajeResueltos}%`} detalle={`${kpis.porEstado.resuelto} resueltos`} acento="bg-turquesa-100 text-turquesa-700" />
          <Kpi Icono={Siren} titulo="Críticos abiertos" valor={kpis.criticos} detalle={`${kpis.alertasRapidas} alertas rápidas`} acento="bg-magenta-100 text-magenta-700" />
          <Kpi Icono={CloudUpload} titulo="Sincronizados offline" valor={kpis.sincronizadosOffline} detalle="capturados sin señal" acento="bg-magenta-100 text-magenta-700" />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AnalyticsCharts kpis={kpis} />
        </div>

        <section className="tarjeta flex max-h-[42rem] flex-col p-4" aria-labelledby="titulo-notifs">
          <h2 id="titulo-notifs" className="mb-3 flex items-center gap-2 font-bold">
            <BellRing size={20} className="text-magenta-500" aria-hidden /> Notificaciones de Gemma IA
            {noLeidas > 0 && <span className="rounded-full bg-magenta-600 px-2 py-0.5 text-xs text-white">{noLeidas}</span>}
          </h2>
          <ul className="-mr-2 flex-1 space-y-2 overflow-y-auto pr-2">
            {notifs.map((n) => (
              <li key={n.id} className={`rounded-xl border p-3 text-sm ${n.leida ? 'border-morado-100 bg-white opacity-70' : 'border-magenta-200 bg-magenta-50'}`}>
                <p className="font-bold">{n.titulo}</p>
                <p className="mt-1 text-morado-700">{n.mensaje}</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-morado-500">
                  <span>{new Date(n.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  <span className="flex gap-1">
                    <button onClick={() => onVerEnMapa(n.reporte_id)} className="rounded-lg px-2 py-1 font-semibold text-morado-700 hover:bg-white">
                      <MapPin size={14} className="inline" aria-hidden /> Mapa
                    </button>
                    {!n.leida && (
                      <button onClick={() => leer(n.id)} className="rounded-lg px-2 py-1 font-semibold text-turquesa-700 hover:bg-white">
                        <CheckCheck size={14} className="inline" aria-hidden /> Leída
                      </button>
                    )}
                  </span>
                </div>
              </li>
            ))}
            {!notifs.length && <li className="py-8 text-center text-sm text-morado-500">Sin notificaciones por ahora.</li>}
          </ul>
        </section>
      </div>

      <section className="tarjeta p-4" aria-labelledby="titulo-tabla">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="titulo-tabla" className="font-bold">Reportes ({filtrados.length})</h2>
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="buscar">Buscar</label>
            <input id="buscar" type="search" placeholder="Buscar…" className="campo min-h-[40px] w-44 py-1.5 text-sm" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            <label className="sr-only" htmlFor="f-estado">Filtrar estatus</label>
            <select id="f-estado" className="campo min-h-[40px] w-auto py-1.5 text-sm" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="">Todos los estatus</option>
              {FLUJO.map((s) => <option key={s} value={s}>{ESTILO_ESTADO[s].etiqueta}</option>)}
            </select>
          </div>
        </div>

        {/* Tabla en pantallas medianas+; tarjetas apiladas en móvil */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-morado-100 text-xs uppercase tracking-wide text-morado-500">
              <tr>
                <th scope="col" className="py-2 pr-3">Tipo</th>
                <th scope="col" className="py-2 pr-3">Severidad</th>
                <th scope="col" className="py-2 pr-3">IA</th>
                <th scope="col" className="py-2 pr-3">Fecha</th>
                <th scope="col" className="py-2 pr-3">Ubicación</th>
                <th scope="col" className="py-2">Estatus</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => (
                <tr key={r.id} className="border-b border-morado-50 align-middle hover:bg-morado-50/60">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl" aria-hidden>{r.tipo_icono}</span>
                      <div>
                        <p className="font-semibold">{r.tipo_nombre}</p>
                        <p className="text-xs text-morado-500">
                          {r.usuario_alias || 'Anónimo'}
                          {r.es_alerta_rapida && ' · 🚨 alerta'}
                          {r.procesado_offline && ' · 📴 offline'}
                          {r.imagen_url && <> · <a href={r.imagen_url} target="_blank" rel="noreferrer" className="underline"><ImageIcon size={12} className="inline" aria-hidden /> foto</a></>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${ESTILO_SEVERIDAD[r.severidad_slug]?.clase}`}>
                      {ESTILO_SEVERIDAD[r.severidad_slug]?.icono} {r.severidad_nombre}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-xs">{r.confianza_ia != null ? `${Math.round(r.confianza_ia * 100)}%` : '—'}</td>
                  <td className="py-2.5 pr-3 text-xs">{new Date(r.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="py-2.5 pr-3">
                    <button onClick={() => onVerEnMapa(r.id)} className="text-xs font-semibold text-morado-700 underline">
                      {Number(r.latitud).toFixed(4)}, {Number(r.longitud).toFixed(4)}
                    </button>
                  </td>
                  <td className="py-2.5">
                    <AccionesEstado reporte={r} onActualizado={alActualizar} notificar={notificar} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="space-y-3 md:hidden">
          {filtrados.map((r) => (
            <li key={r.id} className="rounded-xl border border-morado-100 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold"><span aria-hidden>{r.tipo_icono}</span> {r.tipo_nombre}</p>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold ${ESTILO_SEVERIDAD[r.severidad_slug]?.clase}`}>
                  {r.severidad_nombre}
                </span>
              </div>
              <p className="mt-1 text-xs text-morado-500">
                {new Date(r.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })} ·{' '}
                <button onClick={() => onVerEnMapa(r.id)} className="underline">ver en mapa</button>
              </p>
              <div className="mt-2"><AccionesEstado reporte={r} onActualizado={alActualizar} notificar={notificar} /></div>
            </li>
          ))}
        </ul>
        {!filtrados.length && <p className="py-8 text-center text-sm text-morado-500">No hay reportes con esos filtros.</p>}
      </section>
    </div>
  );
}
