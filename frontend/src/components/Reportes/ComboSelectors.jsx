import { ESTILO_SEVERIDAD } from '../../services/catalogos.js';

/** Combo desplegable + botones con íconos sincronizados para el Tipo / Alerta. */
export function ComboTipo({ tipos, valor, onChange, sugeridoIA }) {
  return (
    <fieldset>
      <legend className="etiqueta">
        Tipo de problema {sugeridoIA && <span className="ml-1 rounded-full bg-naranja-100 px-2 py-0.5 text-xs text-naranja-700">✨ sugerido por Gemma</span>}
      </legend>
      <select
        aria-label="Tipo de problema"
        className="campo mb-3"
        value={valor || ''}
        onChange={(e) => onChange(Number(e.target.value) || null)}
      >
        <option value="">Selecciona el tipo…</option>
        {tipos.map((t) => (
          <option key={t.id} value={t.id}>
            {t.icono} {t.nombre}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9" role="radiogroup" aria-label="Tipo de problema con íconos">
        {tipos.map((t) => {
          const activo = t.id === valor;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => onChange(t.id)}
              title={t.nombre}
              className={`flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-xl border-2 p-2 text-center text-[11px] font-semibold leading-tight transition ${
                activo ? 'border-naranja-500 bg-naranja-50 text-naranja-800' : 'border-marino-100 bg-white text-marino-700 hover:border-marino-300'
              }`}
            >
              <span className="text-2xl" aria-hidden>{t.icono}</span>
              <span className="line-clamp-2">{t.nombre.split(' / ')[0]}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Combo desplegable + botones segmentados para la Severidad. */
export function ComboSeveridad({ severidades, valor, onChange, sugeridoIA }) {
  return (
    <fieldset>
      <legend className="etiqueta">
        Severidad {sugeridoIA && <span className="ml-1 rounded-full bg-naranja-100 px-2 py-0.5 text-xs text-naranja-700">✨ sugerido por Gemma</span>}
      </legend>
      <select aria-label="Severidad" className="campo mb-3" value={valor || ''} onChange={(e) => onChange(Number(e.target.value) || null)}>
        {severidades.map((s) => (
          <option key={s.id} value={s.id}>
            {ESTILO_SEVERIDAD[s.slug]?.icono} {s.nombre}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Severidad con íconos">
        {severidades.map((s) => {
          const estilo = ESTILO_SEVERIDAD[s.slug];
          const activo = s.id === valor;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => onChange(s.id)}
              className={`chip justify-center ${activo ? estilo.clase : 'border-marino-100 bg-white text-marino-600'}`}
            >
              <span aria-hidden>{estilo.icono}</span> {s.nombre}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
