import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import InteractivePinMap from './InteractivePinMap.jsx';
import { api } from '../../services/api.js';
import { ESTILO_ESTADO, ESTILO_SEVERIDAD } from '../../services/catalogos.js';

const FILTROS_ESTADO = [{ slug: '', nombre: 'Todos' }, ...Object.entries(ESTILO_ESTADO).map(([slug, e]) => ({ slug, nombre: e.etiqueta }))];

/** Vista de mapa completa: sólo pines (sin mapas de calor) + filtros por estado y categoría. */
export default function ReportesMapView({ catalogos, seleccionInicial, accionesTarjeta, recargarToken }) {
  const [reportes, setReportes] = useState([]);
  const [seleccionado, setSeleccionado] = useState(seleccionInicial || null);
  const [estado, setEstado] = useState('');
  const [categoria, setCategoria] = useState('');
  const [nivel, setNivel] = useState(''); // '' | baja | moderada | critica
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const params = {};
      if (estado) params.estado = estado;
      if (categoria) params.categoria = categoria;
      const { reportes } = await api.listarReportes(params);
      setReportes(reportes);
    } catch (err) {
      setError(err.offline ? 'Sin señal: se muestran los últimos datos guardados.' : err.message);
    } finally {
      setCargando(false);
    }
  }, [estado, categoria]);

  const visibles = useMemo(() => (nivel ? reportes.filter((r) => r.severidad_slug === nivel) : reportes), [reportes, nivel]);
  const conteo = useMemo(
    () => reportes.reduce((acc, r) => ({ ...acc, [r.severidad_slug]: (acc[r.severidad_slug] || 0) + 1 }), {}),
    [reportes]
  );

  useEffect(() => {
    cargar();
  }, [cargar, recargarToken]);

  useEffect(() => {
    if (seleccionInicial) setSeleccionado(seleccionInicial);
  }, [seleccionInicial]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Mapa de reportes</h1>
          <p className="text-morado-600">{visibles.length} pines de reporte · el color indica el nivel · toca uno para ver su detalle</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="filtro-categoria">Categoría</label>
          <select id="filtro-categoria" className="campo w-auto" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas las categorías</option>
            {catalogos.categorias?.map((c) => (
              <option key={c.slug} value={c.slug}>{c.nombre}</option>
            ))}
          </select>
          <button onClick={cargar} className="btn-suave" aria-label="Actualizar mapa">
            <RefreshCw size={18} className={cargando ? 'animate-spin' : ''} aria-hidden />
          </button>
        </div>
      </div>

      <div className="mb-2 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar por nivel">
        <button
          role="tab"
          aria-selected={nivel === ''}
          onClick={() => setNivel('')}
          className={`chip ${nivel === '' ? 'border-morado-800 bg-morado-800 text-white' : 'border-morado-200 bg-white text-morado-700'}`}
        >
          Todos los niveles · {reportes.length}
        </button>
        {Object.entries(ESTILO_SEVERIDAD).map(([slug, s]) => (
          <button
            key={slug}
            role="tab"
            aria-selected={nivel === slug}
            onClick={() => setNivel(slug)}
            className={`chip ${nivel === slug ? s.clase : 'border-morado-200 bg-white text-morado-700'}`}
          >
            <span className="h-3 w-3 rounded-full border border-white shadow" style={{ background: s.color }} aria-hidden />
            {s.etiqueta} · {conteo[slug] || 0}
          </button>
        ))}
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar por estado">
        {FILTROS_ESTADO.map((f) => (
          <button
            key={f.slug}
            role="tab"
            aria-selected={estado === f.slug}
            onClick={() => setEstado(f.slug)}
            className={`chip ${estado === f.slug ? 'border-morado-800 bg-morado-800 text-white' : 'border-morado-200 bg-white text-morado-700'}`}
          >
            {f.slug && <span className="h-2.5 w-2.5 rounded-full" style={{ background: ESTILO_ESTADO[f.slug].color }} aria-hidden />}
            {f.nombre}
          </button>
        ))}
      </div>

      {error && <p role="status" className="mb-3 rounded-xl bg-magenta-50 p-3 text-sm text-magenta-800">{error}</p>}

      <InteractivePinMap
        className="h-[calc(100dvh-27rem)] min-h-[320px] md:h-[calc(100dvh-17rem)] md:min-h-[420px]"
        reportes={visibles}
        mostrarLeyenda
        seleccionadoId={seleccionado}
        onSeleccionar={setSeleccionado}
        accionesTarjeta={accionesTarjeta && ((r) => accionesTarjeta(r, cargar))}
      />
    </div>
  );
}
