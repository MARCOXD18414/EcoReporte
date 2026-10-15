import { useCallback, useEffect, useState } from 'react';
import { MapPin, CalendarDays, UsersRound, Plus, Loader2, Check } from 'lucide-react';
import { api } from '../../services/api.js';
import { ESTILO_ESTADO, ESTILO_SEVERIDAD, CENTRO_CARMEN } from '../../services/catalogos.js';
import useGeolocation from '../Shared/useGeolocation.js';

const FILTROS = [
  { id: 'todos', nombre: 'Todos', icono: '🌎' },
  { id: 'manglares', nombre: 'Manglares', icono: '🌳' },
  { id: 'fauna', nombre: 'Fauna', icono: '🐢' },
  { id: 'feria', nombre: 'Feria / Playa Norte', icono: '🎡' },
  { id: 'brigadas', nombre: 'Brigadas Ciudadanas', icono: '🤝' },
];

function haceCuanto(fecha) {
  const min = Math.round((Date.now() - new Date(fecha)) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.round(min / 60)} h`;
  return `hace ${Math.round(min / 1440)} d`;
}

function TarjetaReporte({ r, onVerEnMapa }) {
  const est = ESTILO_ESTADO[r.estado_slug] || ESTILO_ESTADO.pendiente;
  const sev = ESTILO_SEVERIDAD[r.severidad_slug] || ESTILO_SEVERIDAD.moderada;
  return (
    <article className="tarjeta flex flex-col overflow-hidden">
      {r.imagen_url ? (
        <img src={r.imagen_url} alt={`Foto: ${r.tipo_nombre}`} loading="lazy" className="h-44 w-full object-cover" />
      ) : (
        <div className="flex h-24 items-center justify-center bg-marino-50 text-5xl" aria-hidden>{r.tipo_icono}</div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${est.clase}`}>{r.estado_nombre}</span>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${sev.clase}`}>{sev.icono} {r.severidad_nombre}</span>
          {r.es_alerta_rapida && <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">Alerta</span>}
        </div>
        <h3 className="font-bold leading-snug"><span aria-hidden>{r.tipo_icono}</span> {r.tipo_nombre}</h3>
        {(r.analisis_ia?.resumen || r.descripcion_detallada) && (
          <p className="line-clamp-3 text-sm text-marino-700">{r.descripcion_detallada || r.analisis_ia.resumen}</p>
        )}
        <p className="mt-auto text-xs text-marino-500">
          {r.usuario_alias || 'Anónimo'} · {haceCuanto(r.created_at)}
        </p>
        <button onClick={() => onVerEnMapa(r.id)} className="btn-suave min-h-[40px] text-sm">
          <MapPin size={16} aria-hidden /> Ver en mapa
        </button>
      </div>
    </article>
  );
}

function FormBrigada({ catalogos, onCreada, notificar }) {
  const gps = useGeolocation({ auto: false });
  const [datos, setDatos] = useState({ titulo: '', lugar: '', fecha: '', categoria_id: 4, descripcion: '' });
  const [enviando, setEnviando] = useState(false);
  const set = (k) => (e) => setDatos((d) => ({ ...d, [k]: e.target.value }));

  async function crear(e) {
    e.preventDefault();
    setEnviando(true);
    try {
      const coords = gps.coords || { lat: CENTRO_CARMEN[0], lng: CENTRO_CARMEN[1] };
      await api.crearBrigada({ ...datos, fecha: new Date(datos.fecha).toISOString(), latitud: coords.lat, longitud: coords.lng });
      notificar({ tipo: 'exito', mensaje: '¡Brigada publicada! Invita a tus vecinos.' });
      onCreada();
    } catch (err) {
      notificar({ tipo: 'error', mensaje: err.status === 401 ? 'Necesitas conexión al iniciar sesión para crear brigadas.' : err.message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={crear} className="tarjeta grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
      <h3 className="font-bold sm:col-span-2">Organizar una brigada</h3>
      <div className="sm:col-span-2">
        <label htmlFor="b-titulo" className="etiqueta">Nombre de la brigada</label>
        <input id="b-titulo" required minLength={4} maxLength={120} className="campo" value={datos.titulo} onChange={set('titulo')} placeholder="Limpieza del malecón" />
      </div>
      <div>
        <label htmlFor="b-cat" className="etiqueta">Enfoque</label>
        <select id="b-cat" className="campo" value={datos.categoria_id} onChange={set('categoria_id')}>
          {catalogos.categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="b-fecha" className="etiqueta">Fecha y hora</label>
        <input id="b-fecha" type="datetime-local" required className="campo" value={datos.fecha} onChange={set('fecha')} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="b-lugar" className="etiqueta">Punto de reunión</label>
        <div className="flex gap-2">
          <input id="b-lugar" required className="campo" value={datos.lugar} onChange={set('lugar')} placeholder="Playa Norte, frente al malecón" />
          <button type="button" onClick={gps.obtener} className="btn-suave shrink-0 px-3" aria-label="Usar mi ubicación para la brigada">
            <MapPin size={18} className={gps.coords ? 'text-emerald-600' : ''} aria-hidden />
          </button>
        </div>
      </div>
      <button disabled={enviando} className="btn-primario sm:col-span-2">
        {enviando ? <Loader2 className="animate-spin" size={18} aria-hidden /> : <Plus size={18} aria-hidden />} Publicar brigada
      </button>
    </form>
  );
}

export default function CommunityFeed({ catalogos, notificar, onVerEnMapa, sesionLocal }) {
  const [filtro, setFiltro] = useState('todos');
  const [reportes, setReportes] = useState([]);
  const [brigadas, setBrigadas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [crear, setCrear] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      if (filtro === 'brigadas') setBrigadas((await api.brigadas()).brigadas);
      else setReportes((await api.feed(filtro)).reportes);
    } catch (err) {
      notificar({ tipo: err.offline ? 'offline' : 'error', mensaje: err.offline ? 'Sin señal: mostrando lo último guardado.' : err.message });
    } finally {
      setCargando(false);
    }
  }, [filtro, notificar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function unirse(id) {
    try {
      await api.unirseBrigada(id);
      notificar({ tipo: 'exito', mensaje: '¡Te uniste a la brigada! 💪' });
      cargar();
    } catch (err) {
      notificar({ tipo: 'error', mensaje: err.status === 401 ? 'Inicia sesión con conexión para unirte.' : err.message });
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5">
      <h1 className="text-2xl font-bold sm:text-3xl">Comunidad</h1>
      <p className="text-marino-600">Lo que tus vecinos están reportando y cuidando en Ciudad del Carmen.</p>

      <div className="my-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtros de comunidad">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filtro === f.id}
            onClick={() => setFiltro(f.id)}
            className={`chip ${filtro === f.id ? 'border-naranja-500 bg-naranja-500 text-white' : 'border-marino-200 bg-white text-marino-700'}`}
          >
            <span aria-hidden>{f.icono}</span> {f.nombre}
          </button>
        ))}
      </div>

      {cargando && <Loader2 className="mx-auto my-10 animate-spin text-naranja-500" size={36} aria-label="Cargando" />}

      {!cargando && filtro !== 'brigadas' && (
        reportes.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {reportes.map((r) => <TarjetaReporte key={r.id} r={r} onVerEnMapa={onVerEnMapa} />)}
          </div>
        ) : (
          <p className="tarjeta p-8 text-center text-marino-600">Aún no hay reportes en esta categoría. ¡Sé la primera persona en reportar! 🧡</p>
        )
      )}

      {!cargando && filtro === 'brigadas' && (
        <div className="space-y-4">
          {!sesionLocal && (
            crear ? (
              <FormBrigada catalogos={catalogos} notificar={notificar} onCreada={() => { setCrear(false); cargar(); }} />
            ) : (
              <button onClick={() => setCrear(true)} className="btn-primario"><Plus size={18} aria-hidden /> Organizar brigada</button>
            )
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {brigadas.map((b) => (
              <article key={b.id} className="tarjeta flex flex-col gap-2 p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-naranja-600">{b.categoria_nombre}</p>
                <h3 className="text-lg font-bold">{b.titulo}</h3>
                {b.descripcion && <p className="text-sm text-marino-700">{b.descripcion}</p>}
                <ul className="space-y-1 text-sm text-marino-700">
                  <li className="flex items-center gap-1.5"><CalendarDays size={16} aria-hidden /> {new Date(b.fecha).toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'short' })}</li>
                  <li className="flex items-center gap-1.5"><MapPin size={16} aria-hidden /> {b.lugar}</li>
                  <li className="flex items-center gap-1.5"><UsersRound size={16} aria-hidden /> {b.participantes} participantes · organiza {b.organizador_alias || 'la comunidad'}</li>
                </ul>
                {b.unido ? (
                  <p className="btn mt-2 bg-emerald-50 text-emerald-700"><Check size={18} aria-hidden /> Ya estás inscrito</p>
                ) : (
                  <button onClick={() => unirse(b.id)} disabled={sesionLocal} className="btn-marino mt-2">Unirme a la brigada</button>
                )}
              </article>
            ))}
            {!brigadas.length && <p className="tarjeta p-8 text-center text-marino-600 md:col-span-2">No hay brigadas próximas. ¡Organiza la primera!</p>}
          </div>
        </div>
      )}
    </div>
  );
}
