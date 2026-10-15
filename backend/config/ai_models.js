/**
 * Configuración de modelos de IA y contrato de salida compartido.
 * Los IDs del catálogo DEBEN coincidir con database/schema.sql.
 */
export const AI_CONFIG = {
  provider: (process.env.AI_PROVIDER || 'google').toLowerCase(),
  timeoutMs: Number(process.env.AI_TIMEOUT_MS || 45000),
  minConfidenceAutofill: Number(process.env.AI_MIN_CONFIDENCE || 0.55),
  google: {
    apiKey: String(process.env.GEMINI_API_KEY || '').trim().split(/\s+/)[0] || undefined,
    // 26b-a4b (MoE) responde en ~3 s; 31b es más preciso pero ~25 s y suele saturarse
    model: process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it',
    // Gemma 4 "piensa" antes de responder; MINIMAL lo desactiva casi por completo (vacío = sin ajuste)
    thinkingLevel: process.env.GEMMA_THINKING ?? 'MINIMAL',
  },
  ollama: {
    url: process.env.OLLAMA_URL,
    model: process.env.OLLAMA_MODEL || 'gemma4',
  },
};

export const CATALOGO_TIPOS = [
  { id: 1, nombre: 'PET / Botellas', pistas: ['botella', 'pet', 'envase', 'refresco', 'agua'] },
  { id: 2, nombre: 'Redes / Pesca Fantasma', pistas: ['red', 'redes', 'pesca', 'anzuelo', 'cuerda', 'nylon', 'trampa'] },
  { id: 3, nombre: 'Bolsas / Empaques', pistas: ['bolsa', 'empaque', 'envoltura', 'unicel', 'popote', 'vaso'] },
  { id: 4, nombre: 'Microplásticos / Fragmentos', pistas: ['microplastico', 'fragmento', 'pedazos', 'pellet', 'particulas'] },
  { id: 5, nombre: 'Otros / Voluminosos', pistas: ['llanta', 'mueble', 'colchon', 'chatarra', 'escombro', 'refrigerador'] },
  { id: 6, nombre: 'Invasión / Tala en Manglares', pistas: ['manglar', 'mangle', 'tala', 'relleno', 'quema', 'arbol'] },
  { id: 7, nombre: 'Animal Herido o Muerto / Fauna en Riesgo', pistas: ['tortuga', 'delfin', 'manati', 'ave', 'pelicano', 'herido', 'muerto', 'varado', 'animal', 'pez'] },
  { id: 8, nombre: 'Residuos en Zona de Feria / Playa Norte', pistas: ['feria', 'playa norte', 'malecon', 'evento', 'puesto'] },
  { id: 9, nombre: 'Accidente / Derrame Ambiental', pistas: ['derrame', 'aceite', 'combustible', 'diesel', 'petroleo', 'quimico', 'mancha'] },
];

export const SEVERIDADES = { baja: 1, moderada: 2, critica: 3 };

export function construirPrompt(descripcion = '') {
  const catalogo = CATALOGO_TIPOS.map((t) => `${t.id} = ${t.nombre}`).join('\n');
  return `Eres un analista ambiental experto en la Laguna de Términos, manglares y Playa Norte de Ciudad del Carmen, Campeche, México.
Analiza la imagen (si existe) y el texto del ciudadano para clasificar un incidente ambiental.

CATÁLOGO tipo_desecho_id:
${catalogo}

SEVERIDAD:
- "baja": residuos aislados, sin riesgo inmediato.
- "moderada": acumulación visible o afectación a un área.
- "critica": fauna herida/en riesgo, derrame, tala/relleno activo de manglar o gran volumen.

Texto del ciudadano: "${String(descripcion).slice(0, 500) || 'sin texto'}"

Responde ÚNICAMENTE con un objeto JSON válido, sin markdown, con esta forma exacta:
{"es_incidente_ambiental": true, "tipo_desecho_id": 1, "severidad": "moderada", "confianza": 0.0, "resumen": "frase corta en español", "objetos_detectados": ["..."], "riesgo_fauna": false, "zona_probable": "playa|laguna|manglar|urbana|desconocida", "recomendacion": "acción sugerida para Servicios Públicos"}`;
}

/** Extrae el primer objeto JSON de una respuesta de texto de un LLM. */
export function extraerJSON(texto = '') {
  const limpio = String(texto).replace(/```(?:json)?/gi, '').trim();
  const inicio = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  if (inicio === -1 || fin <= inicio) throw new Error('La IA no devolvió JSON');
  return JSON.parse(limpio.slice(inicio, fin + 1));
}

/** Valida y normaliza cualquier salida de IA al contrato interno. */
export function normalizarAnalisis(raw = {}, modelo = 'desconocido') {
  const tipoId = Number(raw.tipo_desecho_id);
  const tipo = CATALOGO_TIPOS.find((t) => t.id === tipoId) || CATALOGO_TIPOS[4];
  const sevSlug = String(raw.severidad || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  const severidad = SEVERIDADES[sevSlug] ? sevSlug : 'moderada';
  let confianza = Number(raw.confianza);
  if (!Number.isFinite(confianza)) confianza = 0.5;
  if (confianza > 1) confianza = confianza / 100; // por si responde en %
  confianza = Math.min(1, Math.max(0, confianza));

  return {
    es_incidente_ambiental: raw.es_incidente_ambiental !== false,
    tipo_desecho_id: tipo.id,
    tipo_nombre: tipo.nombre,
    severidad,
    severidad_id: SEVERIDADES[severidad],
    confianza: Math.round(confianza * 1000) / 1000,
    resumen: String(raw.resumen || '').slice(0, 280),
    objetos_detectados: Array.isArray(raw.objetos_detectados)
      ? raw.objetos_detectados.slice(0, 10).map((o) => String(o).slice(0, 60))
      : [],
    riesgo_fauna: Boolean(raw.riesgo_fauna) || tipo.id === 7,
    zona_probable: String(raw.zona_probable || 'desconocida').slice(0, 40),
    recomendacion: String(raw.recomendacion || '').slice(0, 400),
    modelo,
    analizado_en: new Date().toISOString(),
  };
}
