/**
 * Análisis multimodal (visión + texto) con Gemma 4 vía @google/genai.
 * Cadena de resiliencia: Gemma 4 (Google) → Gemma 4 (Ollama) → heurística local.
 */
import { GoogleGenAI } from '@google/genai';
import { AI_CONFIG, construirPrompt, extraerJSON, normalizarAnalisis } from '../config/ai_models.js';
import { analizarConOllama, analizarHeuristico } from './localAiService.js';

let client = null;
function getClient() {
  if (!AI_CONFIG.google.apiKey) throw new Error('GEMINI_API_KEY no configurado');
  if (!client) client = new GoogleGenAI({ apiKey: AI_CONFIG.google.apiKey });
  return client;
}

function conTimeout(promesa, ms) {
  let timer;
  return Promise.race([
    promesa,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timeout de IA (${ms} ms)`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * @param {{buffer?: Buffer, mimeType?: string, descripcion?: string}} entrada
 */
export async function analizarConGemma({ buffer, mimeType = 'image/jpeg', descripcion = '' }) {
  const parts = [];
  if (buffer) parts.push({ inlineData: { mimeType, data: buffer.toString('base64') } });
  parts.push({ text: construirPrompt(descripcion) });

  const respuesta = await conTimeout(
    getClient().models.generateContent({
      model: AI_CONFIG.google.model,
      contents: [{ role: 'user', parts }],
      config: { temperature: 0.2, maxOutputTokens: 700 },
    }),
    AI_CONFIG.timeoutMs
  );

  return normalizarAnalisis(extraerJSON(respuesta.text), AI_CONFIG.google.model);
}

/**
 * Punto de entrada único para el resto del backend. Nunca lanza:
 * si todos los modelos fallan regresa el análisis heurístico.
 */
export async function analizarIncidente({ buffer, mimeType, descripcion, nombreArchivo, tipoSugerido }) {
  const cadena = {
    google: [analizarConGemma, analizarConOllama],
    ollama: [analizarConOllama, analizarConGemma],
    heuristic: [],
  }[AI_CONFIG.provider] || [analizarConGemma, analizarConOllama];

  const errores = [];
  for (const fn of cadena) {
    try {
      return await fn({ buffer, mimeType, descripcion });
    } catch (err) {
      errores.push(`${fn.name}: ${err.message}`);
    }
  }
  if (errores.length) console.warn('[IA] usando heurística local →', errores.join(' | '));
  return { ...analizarHeuristico({ descripcion, nombreArchivo, tipoSugerido }), errores };
}
