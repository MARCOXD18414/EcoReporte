import crypto from 'node:crypto';
import { db, check, STORAGE_BUCKET } from '../config/supabase.js';
import { AI_CONFIG } from '../config/ai_models.js';
import { analizarIncidente } from '../services/gemmaService.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bool = (v) => v === true || v === 'true' || v === '1';

// ---------- Catálogos (caché en memoria 10 min) ----------
let cacheCatalogos = { data: null, ts: 0 };

export async function getCatalogos(_req, res) {
  if (cacheCatalogos.data && Date.now() - cacheCatalogos.ts < 600_000) return res.json(cacheCatalogos.data);
  const [tipos, severidades, estados, categorias] = await Promise.all([
    db().from('tipos_desecho').select('id, nombre, icono, categoria_id, descripcion').order('id'),
    db().from('severidades').select('id, slug, nombre, nivel').order('nivel'),
    db().from('estados_reporte').select('id, slug, nombre, orden').order('orden'),
    db().from('categorias').select('id, slug, nombre').order('id'),
  ]);
  const data = {
    tipos: check(tipos),
    severidades: check(severidades),
    estados: check(estados),
    categorias: check(categorias),
  };
  cacheCatalogos = { data, ts: Date.now() };
  res.json(data);
}

// ---------- IA: análisis para autocompletar (no guarda nada) ----------
export async function analizarImagen(req, res) {
  const descripcion = String(req.body.descripcion || '');
  if (!req.file && !descripcion) return res.status(400).json({ error: 'Envía una imagen o una descripción' });

  const analisis = await analizarIncidente({
    buffer: req.file?.buffer,
    mimeType: req.file?.mimetype,
    descripcion,
    nombreArchivo: req.file?.originalname,
  });
  res.json({ analisis, autocompletar: analisis.confianza >= AI_CONFIG.minConfidenceAutofill });
}

async function subirImagen(file) {
  const ext = (file.mimetype.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const fecha = new Date();
  const ruta = `${fecha.getFullYear()}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`;
  check(await db().storage.from(STORAGE_BUCKET).upload(ruta, file.buffer, { contentType: file.mimetype, upsert: false }));
  return db().storage.from(STORAGE_BUCKET).getPublicUrl(ruta).data.publicUrl;
}

async function crearNotificacion(reporte, analisis) {
  const critico = reporte.severidad_id === 3;
  if (!critico && !reporte.es_alerta_rapida && !analisis?.riesgo_fauna) return;
  const titulo = reporte.es_alerta_rapida
    ? `🚨 Alerta rápida: ${reporte.tipo_nombre}`
    : analisis?.riesgo_fauna
      ? `🐢 Fauna en riesgo: ${reporte.tipo_nombre}`
      : `⚠️ Incidente crítico: ${reporte.tipo_nombre}`;
  const mensaje = [
    analisis?.resumen,
    analisis?.recomendacion && `Recomendación Gemma: ${analisis.recomendacion}`,
    `Ubicación: ${Number(reporte.latitud).toFixed(5)}, ${Number(reporte.longitud).toFixed(5)}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const { error } = await db()
    .from('notificaciones_ia')
    .insert({ reporte_id: reporte.id, severidad_id: reporte.severidad_id, titulo, mensaje });
  if (error) console.warn('[notificaciones] no se pudo crear:', error.message);
}

// ---------- Crear reporte (en línea o sincronizado desde offline) ----------
export async function crearReporte(req, res) {
  const b = req.body;
  const latitud = Number(b.latitud);
  const longitud = Number(b.longitud);
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud) || Math.abs(latitud) > 90 || Math.abs(longitud) > 180) {
    return res.status(400).json({ error: 'Coordenadas GPS inválidas' });
  }

  const clientUuid = UUID_RE.test(b.client_uuid || '') ? b.client_uuid : crypto.randomUUID();

  // Idempotencia: un reporte offline puede reintentarse varias veces
  const { data: previo } = await db().from('reportes').select('id').eq('client_uuid', clientUuid).maybeSingle();
  if (previo) {
    const reporte = check(await db().from('v_reportes_detalle').select('*').eq('id', previo.id).single());
    return res.status(200).json({ reporte, duplicado: true });
  }

  const descripcion = String(b.descripcion_detallada || '').trim().slice(0, 1000) || null;

  let analisis = null;
  if (b.analisis_ia) {
    try {
      analisis = typeof b.analisis_ia === 'string' ? JSON.parse(b.analisis_ia) : b.analisis_ia;
    } catch {
      analisis = null;
    }
  }
  // Reportes capturados offline (o sin análisis previo) se infieren aquí al recuperar red
  if (!analisis && (req.file || descripcion)) {
    analisis = await analizarIncidente({
      buffer: req.file?.buffer,
      mimeType: req.file?.mimetype,
      descripcion,
      nombreArchivo: req.file?.originalname,
      tipoSugerido: b.tipo_desecho_id,
    });
  }

  const tipoId = Number(b.tipo_desecho_id) || analisis?.tipo_desecho_id || 5;
  const severidadId = Number(b.severidad_id) || analisis?.severidad_id || 2;

  const imagenUrl = req.file ? await subirImagen(req.file) : null;

  const insertado = check(
    await db()
      .from('reportes')
      .insert({
        usuario_id: req.usuario?.sub || null,
        tipo_desecho_id: tipoId,
        severidad_id: severidadId,
        latitud,
        longitud,
        ubicacion_ajustada: bool(b.ubicacion_ajustada),
        imagen_url: imagenUrl,
        descripcion_detallada: descripcion,
        es_alerta_rapida: bool(b.es_alerta_rapida),
        procesado_offline: bool(b.procesado_offline),
        confianza_ia: analisis ? analisis.confianza : null,
        analisis_ia: analisis,
        client_uuid: clientUuid,
        capturado_en: b.capturado_en && !Number.isNaN(Date.parse(b.capturado_en)) ? b.capturado_en : new Date().toISOString(),
      })
      .select('id')
      .single(),
    400
  );

  await db().from('historial_estados').insert({
    reporte_id: insertado.id,
    estado_id: 1,
    usuario_id: req.usuario?.sub || null,
    comentario: bool(b.procesado_offline) ? 'Reporte sincronizado desde modo offline' : 'Reporte creado',
  });

  const reporte = check(await db().from('v_reportes_detalle').select('*').eq('id', insertado.id).single());
  await crearNotificacion(reporte, analisis);

  res.status(201).json({ reporte });
}

// ---------- Lectura ----------
export async function listarReportes(req, res) {
  const { estado, categoria, tipo, limite = 300, desde } = req.query;
  let q = db()
    .from('v_reportes_detalle')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(Number(limite) || 300, 1000));
  if (estado) q = q.eq('estado_slug', estado);
  if (categoria) q = q.eq('categoria_slug', categoria);
  if (tipo) q = q.eq('tipo_desecho_id', Number(tipo));
  if (desde) q = q.gte('created_at', desde);
  res.json({ reportes: check(await q) });
}

export async function obtenerReporte(req, res) {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
  const reporte = check(await db().from('v_reportes_detalle').select('*').eq('id', req.params.id).single());
  const historial = check(
    await db()
      .from('historial_estados')
      .select('id, comentario, created_at, estados_reporte(slug, nombre)')
      .eq('reporte_id', req.params.id)
      .order('created_at')
  );
  res.json({ reporte, historial });
}
