import { db, check } from '../config/supabase.js';

const FILTROS = ['todos', 'manglares', 'fauna', 'feria', 'residuos', 'emergencia'];

/** GET /api/comunidad/feed?filtro=manglares */
export async function getFeed(req, res) {
  const filtro = FILTROS.includes(req.query.filtro) ? req.query.filtro : 'todos';
  let q = db()
    .from('v_reportes_detalle')
    .select(
      'id, usuario_alias, tipo_nombre, tipo_icono, categoria_slug, categoria_nombre, severidad_slug, severidad_nombre, estado_slug, estado_nombre, latitud, longitud, imagen_url, descripcion_detallada, es_alerta_rapida, analisis_ia, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(60);
  if (filtro !== 'todos') q = q.eq('categoria_slug', filtro);
  res.json({ filtro, reportes: check(await q) });
}

/** GET /api/comunidad/brigadas */
export async function listarBrigadas(req, res) {
  const brigadas = check(
    await db()
      .from('v_brigadas_detalle')
      .select('*')
      .gte('fecha', new Date(Date.now() - 86_400_000).toISOString())
      .order('fecha')
  );

  let unidas = [];
  if (req.usuario?.sub) {
    unidas = check(await db().from('brigada_participantes').select('brigada_id').eq('usuario_id', req.usuario.sub)).map(
      (r) => r.brigada_id
    );
  }
  res.json({ brigadas: brigadas.map((b) => ({ ...b, unido: unidas.includes(b.id) })) });
}

/** POST /api/comunidad/brigadas */
export async function crearBrigada(req, res) {
  const { titulo, descripcion, categoria_id, lugar, latitud, longitud, fecha } = req.body;
  if (!titulo || String(titulo).trim().length < 4) return res.status(400).json({ error: 'El título necesita al menos 4 caracteres' });
  if (!lugar || !fecha || Number.isNaN(Date.parse(fecha))) return res.status(400).json({ error: 'Lugar y fecha son obligatorios' });

  const brigada = check(
    await db()
      .from('brigadas')
      .insert({
        titulo: String(titulo).trim().slice(0, 120),
        descripcion: String(descripcion || '').slice(0, 500) || null,
        categoria_id: Number(categoria_id) || 1,
        lugar: String(lugar).slice(0, 160),
        latitud: Number(latitud) || 18.6456,
        longitud: Number(longitud) || -91.8291,
        fecha,
        organizador_id: req.usuario.sub,
      })
      .select('id')
      .single(),
    400
  );
  await db().from('brigada_participantes').insert({ brigada_id: brigada.id, usuario_id: req.usuario.sub });
  res.status(201).json({ brigada: check(await db().from('v_brigadas_detalle').select('*').eq('id', brigada.id).single()) });
}

/** POST /api/comunidad/brigadas/:id/unirse */
export async function unirseBrigada(req, res) {
  const { error } = await db()
    .from('brigada_participantes')
    .upsert({ brigada_id: req.params.id, usuario_id: req.usuario.sub }, { onConflict: 'brigada_id,usuario_id', ignoreDuplicates: true });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
}
