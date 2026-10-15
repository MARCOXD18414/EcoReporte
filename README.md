# 🌱 EcoReporta Carmen — *Por un medio ambiente mejor* 💜

> EcoReporta Carmen: PWA para reportar incidentes ambientales en la Laguna de Términos, manglares y Playa Norte. Toma una foto y Gemma 4 clasifica el problema y llena el reporte. Funciona sin señal: guarda en el teléfono y sincroniza al volver la red. Mapa de pines por nivel, alerta rápida con GPS o pin y panel para autoridades con Supabase.

PWA híbrida para reportar incidentes ambientales en la **Laguna de Términos**, los **manglares** y **Playa Norte** de Ciudad del Carmen, Campeche. Toma una foto y **Gemma 4** clasifica el incidente y pre-selecciona los campos. **Sin señal**, el reporte se guarda en el teléfono y se envía (y analiza) en cuanto vuelve la red.

| Reto del Hackathon | Cómo lo cumple |
|---|---|
| **Best Use of Gemma** | Análisis multimodal (imagen + texto) con Gemma 4 vía `@google/genai` → JSON validado que autocompleta los combos de Tipo y Severidad y genera notificaciones para autoridades. |
| **Best Open-Source AI (DigitalOcean)** | PWA offline-first (Service Worker + IndexedDB). Inferencia diferida al reconectar. Cadena de respaldo: Gemma 4 en Google AI → Gemma 4 auto-hospedado con **Ollama en un Droplet** → heurística local. |
| **Hack for Humanity** | Protección de manglares, fauna marina (tortugas, manatíes, delfines) y Playa Norte. Acceso ciudadano sin contraseña, interfaz de “cero escritura” y Alerta Rápida de 1 toque. |

---

## 🗄️ Las 2 bases de datos gratuitas

1. **Supabase** (PostgreSQL + Storage, plan gratuito): fuente de verdad en la nube. El esquema está normalizado en **3FN** (`database/schema.sql`).
2. **IndexedDB** (dentro del navegador, gratis y sin servidor): cola offline de reportes, foto incluida como `Blob`.

### Modelo de datos (3FN)

```
roles ─┐                 categorias ──< tipos_desecho ─┐
       └──< usuarios >───────────────┐                  │
                 │                   │   severidades ───┤
                 │                   │   estados_reporte┤
                 └──────────────< reportes >────────────┘
                                    │  ├──< historial_estados
                                    │  └──< notificaciones_ia
       brigadas >──< brigada_participantes >── usuarios
```

* La categoría (Manglares, Fauna, Feria…) **no** se repite en `reportes`: se deriva de `tipos_desecho.categoria_id`, lo que evita dependencias transitivas.
* `client_uuid UNIQUE` hace la sincronización offline **idempotente**: reintentar nunca duplica reportes.
* Las vistas `v_reportes_detalle` y `v_brigadas_detalle` aplanan los JOINs para lectura sin romper la normalización.

---

## 📂 Estructura

```
ecoreporta-carmen/
├── backend/
│   ├── config/        supabase.js · ai_models.js (prompt + validación del JSON de IA)
│   ├── controllers/   reportesController · comunidadController · dashboardController · authController
│   ├── middleware/    auth.js (JWT, roles ciudadano/admin)
│   ├── routes/        reportesRoutes · dashboardRoutes · comunidadRoutes · authRoutes
│   ├── services/      gemmaService.js (Gemma 4) · localAiService.js (Ollama + heurística)
│   ├── .env.example
│   └── server.js
├── database/schema.sql
└── frontend/
    ├── index.html            ← Vite exige index.html en la raíz del frontend
    ├── public/  manifest.json · sw.js · icons/
    └── src/
        ├── components/
        │   ├── Auth/         LoginUser · LoginAdmin
        │   ├── Reportes/     CameraModal · AutoFillFormWithCombos · ComboSelectors
        │   │                 InteractivePinMap · ReportesMapView · QuickAlert
        │   ├── Dashboard/    AdminDashboard · AnalyticsCharts
        │   ├── Comunidad/    CommunityFeed
        │   └── Shared/       Navbar · Toast · useGeolocation
        ├── services/         api · catalogos · offlineStorage (IndexedDB) · syncService
        └── App.jsx
```

---

## 🚀 Puesta en marcha

### 1. Supabase
1. Crea un proyecto gratuito en <https://supabase.com>.
2. **SQL Editor → New query**: pega `database/schema.sql` completo y ejecútalo. Esto crea las tablas, las vistas, RLS, el bucket `reportes` y los datos semilla.
3. En **Project Settings → API** copia la `Project URL` y la `service_role key`.

> Admin demo: `admin@ecoreporta.mx` / `Carmen2026!` (cámbialo antes de publicar).

### 2. Backend
```bash
cd backend
cp .env.example .env      # llena SUPABASE_*, GEMINI_API_KEY y JWT_SECRET
npm install
npm run dev               # http://localhost:4000/api/health
```
Obtén la clave de Gemma en <https://aistudio.google.com/apikey>. Revisa en AI Studio el **ID exacto del modelo Gemma 4** disponible y ajusta `GEMMA_MODEL`.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev               # http://localhost:5173 (proxy /api → :4000)
```

### 4. Probar la PWA y el modo offline
El Service Worker sólo se registra en el build de producción, para no interferir con la recarga en caliente de Vite.
```bash
cd frontend && npm run build && npm run preview   # http://localhost:4173
```
En DevTools → **Network → Offline**: crea un reporte, verás el contador amarillo ☁️. Vuelve a **Online** y el reporte se sincroniza solo; Gemma lo analiza en el backend y queda marcado `procesado_offline = true`.

### 5. Publicar en internet (Render, gratis): un solo servicio
El backend compila y sirve la PWA en la misma URL. Las claves viven como variables privadas del servidor, **nunca en GitHub**.

1. Entra a <https://render.com> con tu cuenta de GitHub.
2. **New → Blueprint** y elige este repositorio. Render lee `render.yaml`.
3. Pega los 3 valores secretos que pide: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `GEMINI_API_KEY`.
4. **Apply**. En unos 3 minutos tendrás `https://ecoreporte.onrender.com` (o similar) con HTTPS, lista para instalar como PWA.

> El plan gratuito se duerme tras 15 min sin uso; la primera visita tarda unos 50 s en despertar.

Equivalente manual en cualquier servidor (DigitalOcean App Platform, Droplet, etc.):
```bash
npm run build   # instala y compila frontend + backend
npm start       # sirve API y PWA en $PORT
```
Opcional, IA 100 % open-source en un Droplet con GPU/CPU:
```bash
ollama pull gemma4 && ollama serve
# en backend/.env:  AI_PROVIDER=ollama  OLLAMA_URL=http://IP:11434
```

---

## 🔌 API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado de Supabase e IA |
| POST | `/api/auth/ciudadano` | `{alias?}` → sesión sin contraseña |
| POST | `/api/auth/admin` | `{email, password}` |
| GET | `/api/reportes/catalogos` | Tipos, severidades, estados, categorías |
| POST | `/api/reportes/analizar` | multipart `imagen` (+`descripcion`) → análisis de Gemma para autocompletar |
| POST | `/api/reportes` | multipart: `imagen?`, `tipo_desecho_id`, `severidad_id`, `latitud`, `longitud`, `descripcion_detallada?`, `es_alerta_rapida`, `procesado_offline`, `client_uuid`, `analisis_ia?` |
| GET | `/api/reportes?estado=&categoria=` | Pines del mapa |
| GET | `/api/comunidad/feed?filtro=manglares\|fauna\|feria` | Feed comunitario |
| GET/POST | `/api/comunidad/brigadas` · `/:id/unirse` | Brigadas ciudadanas |
| GET | `/api/dashboard/kpis` · `/notificaciones` · `/reportes` | Panel admin (JWT admin) |
| PATCH | `/api/dashboard/reportes/:id/estado` | `{estado: 'en_proceso'}` |

---

## ♿ Accesibilidad y usabilidad
* **Cero escritura**: foto → combos pre-seleccionados por Gemma con la etiqueta “✨ sugerido por Gemma”. El texto libre está oculto tras “Agregar una especificación (opcional)”.
* Cada combo existe como `<select>` nativo (compatible con lectores de pantalla) **y** como botones grandes con íconos (`role="radio"`).
* **Alerta Rápida**: 1 toque = envío con GPS, sin foto. También es un *shortcut* de la PWA instalada.
* Áreas táctiles de 48 px o más, foco visible naranja, enlace “Saltar al contenido”, regiones `aria-live`, `prefers-reduced-motion` y navegación inferior en móvil.
* **Mapa de pines exclusivamente** (Leaflet + OpenStreetMap, sin mapas de calor): el color indica el estatus y el emoji el tipo. Al seleccionar un pin aparece la tarjeta “Ubicación seleccionada”. Al reportar, el pin 📌 se arrastra o se recoloca tocando el mapa.

## 🎨 Paleta “Por un medio ambiente mejor”
Morado principal `#880EBA` · Morado oscuro `#6F04A2` · Magenta `#D40A8C` · Amarillo `#ECE524` · Turquesa `#10DEAD` · Turquesa claro `#4BE6C1` · Lila `#BA7CEE` · Lila claro `#CEA3F3` · Morado tinta `#3B0A57` · Blanco rosado `#F9EEF9` (escalas en `frontend/tailwind.config.js`).

Niveles en el mapa: 🟢 Baja = turquesa · 🟡 Moderada = amarillo · 🔴 Crítica = magenta.
