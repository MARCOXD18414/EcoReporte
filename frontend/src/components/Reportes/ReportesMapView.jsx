import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import InteractivePinMap from './InteractivePinMap.jsx';
import { api } from '../../services/api.js';
import { ESTILO_ESTADO } from '../../services/catalogos.js';

const FILTROS_ESTADO = [{ slug: '', nombre: 'Todos' }, ...Object.entries(ESTILO_ESTADO).map(([slug, e]) => ({ slug, nombre: e.etiqueta }))];

/** Vista de mapa completa: sólo pines (sin mapas de calor) + filtros por estado y categoría. */
export default function ReportesMapView({ catalogos, seleccionInicial, accionesTarjeta, recargarToken }) {
  const [reportes, setReportes] = useState([]);
  const [seleccionado, setSeleccionado] = useState(seleccionInicial || null);
  const [estado, setEstado] = useState('');
  const [categoria, setCategoria] = useState('');
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
          <p className="text-marino-600">{reportes.length} pines · toca uno para ver su detalle</p>
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

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar por estado">
        {FILTROS_ESTADO.map((f) => (
          <button
            key={f.slug}
            role="tab"
            aria-selected={estado === f.slug}
            onClick={() => setEstado(f.slug)}
            className={`chip ${estado === f.slug ? 'border-marino-800 bg-marino-800 text-white' : 'border-marino-200 bg-white text-marino-700'}`}
          >
            {f.slug && <span className="h-2.5 w-2.5 rounded-full" style={{ background: ESTILO_ESTADO[f.slug].color }} aria-hidden />}
            {f.nombre}
          </button>
        ))}
      </div>

      {error && <p role="status" className="mb-3 rounded-xl bg-naranja-50 p-3 text-sm text-naranja-800">{error}</p>}

      <InteractivePinMap
        className="h-[calc(100dvh-17rem)] min-h-[420px]"
        reportes={reportes}
        seleccionadoId={seleccionado}
        onSeleccionar={setSeleccionado}
        accionesTarjeta={accionesTarjeta && ((r) => accionesTarjeta(r, cargar))}
      />
    </div>
  );
}
