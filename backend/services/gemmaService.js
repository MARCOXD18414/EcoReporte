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

  const { model, thinkingLevel } = AI_CONFIG.google;
  // Margen amplio: los tokens de "pensamiento" de Gemma 4 cuentan contra este límite
  const config = { temperature: 0.2, maxOutputTokens: 4096 };
  const generar = (cfg) =>
    conTimeout(getClient().models.generateContent({ model, contents: [{ role: 'user', parts }], config: cfg }), AI_CONFIG.timeoutMs);

  let respuesta;
  try {
    respuesta = await generar(thinkingLevel ? { ...config, thinkingConfig: { thinkingLevel } } : config);
  } catch (err) {
    // Algunos modelos no aceptan thinkingConfig: reintenta sin él
    if (!thinkingLevel || !/thinking/i.test(err.message)) throw err;
    respuesta = await generar(config);
  }

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
