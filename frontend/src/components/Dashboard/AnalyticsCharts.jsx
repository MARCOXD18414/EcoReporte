import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import { ESTILO_ESTADO } from '../../services/catalogos.js';

const NOMBRES_ESTADO = { pendiente: 'Pendiente', en_proceso: 'En Proceso', resuelto: 'Resuelto' };

function Panel({ titulo, children, className = '' }) {
  return (
    <section className={`tarjeta p-4 ${className}`}>
      <h3 className="mb-3 font-bold">{titulo}</h3>
      <div className="h-64">{children}</div>
    </section>
  );
}

export default function AnalyticsCharts({ kpis }) {
  if (!kpis) return null;
  const estados = Object.entries(kpis.porEstado).map(([slug, valor]) => ({
    nombre: NOMBRES_ESTADO[slug] || slug,
    valor,
    color: ESTILO_ESTADO[slug]?.color || '#CEA3F3',
  }));
  const tipos = kpis.porTipo.map((t) => ({ ...t, corto: t.nombre.split(' / ')[0] }));
  const serie = kpis.serieDiaria.map((d) => ({ ...d, dia: d.fecha.slice(5) }));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel titulo="Reportes por tipo" className="lg:col-span-2">
        <ResponsiveContainer>
          <BarChart data={tipos} margin={{ left: -20, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1DEF8" />
            <XAxis dataKey="corto" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [v, 'Reportes']} labelFormatter={(_, p) => p?.[0]?.payload?.nombre} />
            <Bar dataKey="valor" fill="#D40A8C" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel titulo="Estatus de atención">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={estados} dataKey="valor" nameKey="nombre" innerRadius="55%" outerRadius="85%" paddingAngle={3}>
              {estados.map((e) => <Cell key={e.nombre} fill={e.color} />)}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      </Panel>

      <Panel titulo="Reportes de los últimos 14 días" className="lg:col-span-3">
        <ResponsiveContainer>
          <AreaChart data={serie} margin={{ left: -20, right: 8 }}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#880EBA" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#880EBA" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1DEF8" />
            <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [v, 'Reportes']} />
            <Area type="monotone" dataKey="reportes" stroke="#880EBA" strokeWidth={2} fill="url(#grad)" />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}
