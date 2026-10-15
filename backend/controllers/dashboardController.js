import { db, check } from '../config/supabase.js';

const ESTADOS = { pendiente: 1, en_proceso: 2, resuelto: 3 };

/** GET /api/dashboard/kpis */
export async function getKpis(_req, res) {
  const filas = check(
    await db()
      .from('v_reportes_detalle')
      .select('estado_slug, tipo_nombre, tipo_icono, categoria_nombre, severidad_slug, es_alerta_rapida, procesado_offline, created_at')
      .limit(5000)
  );

  const total = filas.length;
  const contar = (key) =>
    Object.entries(
      filas.reduce((acc, f) => {
        acc[f[key]] = (acc[f[key]] || 0) + 1;
        return acc;
      }, {})
    ).map(([nombre, valor]) => ({ nombre, valor }));

  const porEstado = { pendiente: 0, en_proceso: 0, resuelto: 0 };
  filas.forEach((f) => (porEstado[f.estado_slug] = (porEstado[f.estado_slug] || 0) + 1));

  // Serie de los últimos 14 días
  const hoy = new Date();
  const serie = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() - (13 - i));
    return { fecha: d.toISOString().slice(0, 10), reportes: 0 };
  });
  const idx = Object.fromEntries(serie.map((s, i) => [s.fecha, i]));
  filas.forEach((f) => {
    const k = f.created_at.slice(0, 10);
    if (k in idx) serie[idx[k]].reportes++;
  });

  res.json({
    total,
    porEstado,
    porcentajeResueltos: total ? Math.round((porEstado.resuelto / total) * 1000) / 10 : 0,
    criticos: filas.filter((f) => f.severidad_slug === 'critica' && f.estado_slug !== 'resuelto').length,
    alertasRapidas: filas.filter((f) => f.es_alerta_rapida).length,
    sincronizadosOffline: filas.filter((f) => f.procesado_offline).length,
    porTipo: contar('tipo_nombre').sort((a, b) => b.valor - a.valor),
    porCategoria: contar('categoria_nombre'),
    serieDiaria: serie,
  });
}

/** GET /api/dashboard/notificaciones?solo_no_leidas=true */
export async function getNotificaciones(req, res) {
  let q = db()
    .from('notificaciones_ia')
    .select('id, reporte_id, titulo, mensaje, leida, created_at, severidades(slug, nombre)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (req.query.solo_no_leidas === 'true') q = q.eq('leida', false);
  res.json({ notificaciones: check(await q) });
}

/** PATCH /api/dashboard/notificaciones/:id/leida */
export async function marcarNotificacionLeida(req, res) {
  const data = check(
    await db().from('notificaciones_ia').update({ leida: true }).eq('id', Number(req.params.id)).select('id, leida').single()
  );
  res.json({ notificacion: data });
}

/** PATCH /api/dashboard/reportes/:id/estado  { estado: 'en_proceso' | 2, comentario? } */
export async function actualizarEstado(req, res) {
  const estadoId = ESTADOS[req.body.estado] || Number(req.body.estado);
  if (![1, 2, 3].includes(estadoId)) return res.status(400).json({ error: 'Estado inválido' });

  check(await db().from('reportes').update({ estado_id: estadoId }).eq('id', req.params.id).select('id').single());
  await db().from('historial_estados').insert({
    reporte_id: req.params.id,
    estado_id: estadoId,
    usuario_id: req.usuario.sub,
    comentario: String(req.body.comentario || '').slice(0, 300) || `Actualizado por ${req.usuario.alias}`,
  });
  const reporte = check(await db().from('v_reportes_detalle').select('*').eq('id', req.params.id).single());
  res.json({ reporte });
}
