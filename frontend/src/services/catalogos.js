/** Copia local de los catálogos (idéntica a database/schema.sql) para trabajar sin señal. */
export const CATALOGOS_LOCALES = {
  tipos: [
    { id: 1, nombre: 'PET / Botellas', icono: '🧴', categoria_id: 1 },
    { id: 2, nombre: 'Redes / Pesca Fantasma', icono: '🎣', categoria_id: 3 },
    { id: 3, nombre: 'Bolsas / Empaques', icono: '🛍️', categoria_id: 1 },
    { id: 4, nombre: 'Microplásticos / Fragmentos', icono: '🔬', categoria_id: 1 },
    { id: 5, nombre: 'Otros / Voluminosos', icono: '📦', categoria_id: 1 },
    { id: 6, nombre: 'Invasión / Tala en Manglares', icono: '🌳', categoria_id: 2 },
    { id: 7, nombre: 'Animal Herido o Muerto / Fauna en Riesgo', icono: '🐢', categoria_id: 3 },
    { id: 8, nombre: 'Residuos en Zona de Feria / Playa Norte', icono: '🎡', categoria_id: 4 },
    { id: 9, nombre: 'Accidente / Derrame Ambiental', icono: '⚠️', categoria_id: 5 },
  ],
  severidades: [
    { id: 1, slug: 'baja', nombre: 'Baja', nivel: 1 },
    { id: 2, slug: 'moderada', nombre: 'Moderada', nivel: 2 },
    { id: 3, slug: 'critica', nombre: 'Crítica', nivel: 3 },
  ],
  estados: [
    { id: 1, slug: 'pendiente', nombre: 'Pendiente', orden: 1 },
    { id: 2, slug: 'en_proceso', nombre: 'En Proceso', orden: 2 },
    { id: 3, slug: 'resuelto', nombre: 'Resuelto', orden: 3 },
  ],
  categorias: [
    { id: 1, slug: 'residuos', nombre: 'Residuos Sólidos' },
    { id: 2, slug: 'manglares', nombre: 'Manglares' },
    { id: 3, slug: 'fauna', nombre: 'Fauna Silvestre y Marina' },
    { id: 4, slug: 'feria', nombre: 'Feria / Playa Norte' },
    { id: 5, slug: 'emergencia', nombre: 'Emergencia Ambiental' },
  ],
};

/** Tipos destacados para la Alerta Rápida (botones grandes de 1 toque). */
export const TIPOS_ALERTA_RAPIDA = [1, 2, 6, 7, 8, 9];

export const ESTILO_SEVERIDAD = {
  baja: { icono: '🟢', clase: 'border-turquesa-500 bg-turquesa-50 text-turquesa-800', color: '#10DEAD', etiqueta: 'Baja' },
  moderada: { icono: '🟡', clase: 'border-amarillo-400 bg-amarillo-50 text-amarillo-800', color: '#ECE524', etiqueta: 'Moderada' },
  critica: { icono: '🔴', clase: 'border-magenta-500 bg-magenta-50 text-magenta-700', color: '#D40A8C', etiqueta: 'Crítica' },
};

export const ESTILO_ESTADO = {
  pendiente: { color: '#BA7CEE', clase: 'bg-morado-100 text-morado-800', etiqueta: 'Pendiente' },
  en_proceso: { color: '#ECE524', clase: 'bg-amarillo-100 text-amarillo-800', etiqueta: 'En Proceso' },
  resuelto: { color: '#10DEAD', clase: 'bg-turquesa-100 text-turquesa-800', etiqueta: 'Resuelto' },
};

/** Centro de Ciudad del Carmen, Campeche */
export const CENTRO_CARMEN = [18.6456, -91.8291];
