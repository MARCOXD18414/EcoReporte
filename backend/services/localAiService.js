/**
 * IA local / open-source.
 *  1) Ollama: Gemma 4 auto-hospedado (p. ej. Droplet de DigitalOcean).
 *  2) Heurística por palabras clave: siempre disponible, sin red ni GPU.
 */
import { AI_CONFIG, CATALOGO_TIPOS, construirPrompt, extraerJSON, normalizarAnalisis } from '../config/ai_models.js';

export async function analizarConOllama({ buffer, descripcion }) {
  const { url, model } = AI_CONFIG.ollama;
  if (!url) throw new Error('OLLAMA_URL no configurado');

  const resp = await fetch(`${url.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(AI_CONFIG.timeoutMs * 2),
    body: JSON.stringify({
      model,
      prompt: construirPrompt(descripcion),
      images: buffer ? [buffer.toString('base64')] : undefined,
      format: 'json',
      stream: false,
      options: { temperature: 0.2 },
    }),
  });
  if (!resp.ok) throw new Error(`Ollama respondió ${resp.status}`);
  const json = await resp.json();
  return normalizarAnalisis(extraerJSON(json.response), `ollama:${model}`);
}

const sinAcentos = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export function analizarHeuristico({ descripcion = '', nombreArchivo = '', tipoSugerido } = {}) {
  const texto = sinAcentos(`${descripcion} ${nombreArchivo}`);
  let mejor = null;
  let puntos = 0;
  for (const tipo of CATALOGO_TIPOS) {
    const p = tipo.pistas.filter((pista) => texto.includes(pista)).length;
    if (p > puntos) {
      mejor = tipo;
      puntos = p;
    }
  }
  const tipoId = mejor?.id || Number(tipoSugerido) || 5;
  const critico = /herid|muert|derrame|aceite|combustible|quema|tala|varad|enredad/.test(texto) || [7, 9].includes(tipoId);

  return normalizarAnalisis(
    {
      tipo_desecho_id: tipoId,
      severidad: critico ? 'critica' : puntos > 1 ? 'moderada' : 'baja',
      confianza: mejor ? Math.min(0.5, 0.3 + puntos * 0.1) : 0.2,
      resumen: mejor
        ? `Clasificación preliminar por texto: ${mejor.nombre}`
        : 'Clasificación preliminar sin IA; requiere validación humana',
      objetos_detectados: [],
      zona_probable: /playa|feria|malecon/.test(texto) ? 'playa' : /manglar|mangle/.test(texto) ? 'manglar' : /laguna/.test(texto) ? 'laguna' : 'desconocida',
      recomendacion: 'Validar en campo. Análisis generado sin modelo de visión.',
    },
    'heuristica-local'
  );
}
