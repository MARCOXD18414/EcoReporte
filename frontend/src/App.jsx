import { useCallback, useEffect, useState } from 'react';
import LoginUser from './components/Auth/LoginUser.jsx';
import LoginAdmin from './components/Auth/LoginAdmin.jsx';
import Navbar from './components/Shared/Navbar.jsx';
import Toast from './components/Shared/Toast.jsx';
import AutoFillFormWithCombos from './components/Reportes/AutoFillFormWithCombos.jsx';
import QuickAlert from './components/Reportes/QuickAlert.jsx';
import ReportesMapView from './components/Reportes/ReportesMapView.jsx';
import CommunityFeed from './components/Comunidad/CommunityFeed.jsx';
import AdminDashboard, { AccionesEstado } from './components/Dashboard/AdminDashboard.jsx';
import { api, getSesion, setSesion, cerrarSesion } from './services/api.js';
import { CATALOGOS_LOCALES } from './services/catalogos.js';
import { iniciarSincronizacion, EVENTO_SYNC } from './services/syncService.js';
import { contarPendientes } from './services/offlineStorage.js';

const VISTA_INICIAL = { ciudadano: 'reportar', admin: 'dashboard' };

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const [sesion, setSesionState] = useState(getSesion);
  const [portal, setPortal] = useState('ciudadano');
  const [vista, setVista] = useState(() => params.get('vista') || VISTA_INICIAL[getSesion()?.usuario?.rol] || 'reportar');
  const [catalogos, setCatalogos] = useState(CATALOGOS_LOCALES);
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const [pendientes, setPendientes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);
  const [toast, setToast] = useState(null);
  const [alertaAbierta, setAlertaAbierta] = useState(params.get('accion') === 'alerta');
  const [seleccionMapa, setSeleccionMapa] = useState(null);
  const [recargarMapa, setRecargarMapa] = useState(0);

  const notificar = useCallback((t) => setToast({ ...t, id: Date.now() }), []);
  const cerrarToast = useCallback(() => setToast(null), []);
  const refrescarPendientes = useCallback(() => contarPendientes().then(setPendientes), []);

  useEffect(() => {
    api.catalogos().then(setCatalogos);
  }, [enLinea]);

  useEffect(() => {
    const on = () => {
      setEnLinea(true);
      notificar({ tipo: 'exito', mensaje: 'Señal recuperada. Sincronizando reportes guardados…' });
    };
    const off = () => {
      setEnLinea(false);
      notificar({ tipo: 'offline', mensaje: 'Sin señal. Puedes seguir reportando: se guardará en tu teléfono.' });
    };
    const alSync = (e) => {
      const d = e.detail || {};
      if ('sincronizando' in d) setSincronizando(d.sincronizando);
      if (typeof d.pendientes === 'number') setPendientes(d.pendientes);
      if (d.enviados > 0) {
        notificar({ tipo: 'exito', mensaje: `✅ ${d.enviados} reporte(s) sin señal se enviaron y fueron analizados por Gemma.` });
        setRecargarMapa((n) => n + 1);
      }
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener(EVENTO_SYNC, alSync);
    refrescarPendientes();
    const detener = iniciarSincronizacion();
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener(EVENTO_SYNC, alSync);
      detener();
    };
  }, [notificar, refrescarPendientes]);

  function iniciarSesion(nueva) {
    setSesion(nueva);
    setSesionState(nueva);
    setVista(VISTA_INICIAL[nueva.usuario.rol]);
  }

  function salir() {
    cerrarSesion();
    setSesionState(null);
    setPortal('ciudadano');
  }

  function verEnMapa(id) {
    setSeleccionMapa(id);
    setVista('mapa');
    window.scrollTo({ top: 0 });
  }

  function alEnviar() {
    refrescarPendientes();
    setRecargarMapa((n) => n + 1);
  }

  if (!sesion) {
    return portal === 'admin' ? (
      <LoginAdmin onLogin={iniciarSesion} onVolver={() => setPortal('ciudadano')} />
    ) : (
      <LoginUser onLogin={iniciarSesion} onIrAdmin={() => setPortal('admin')} />
    );
  }

  const esAdmin = sesion.usuario.rol === 'admin';

  return (
    <div className="min-h-dvh pb-20 md:pb-6">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[5000] focus:rounded-lg focus:bg-white focus:p-2">
        Saltar al contenido
      </a>
      <Navbar
        usuario={sesion.usuario}
        vista={vista}
        onCambiarVista={(v) => {
          setVista(v);
          if (v !== 'mapa') setSeleccionMapa(null);
        }}
        enLinea={enLinea}
        pendientes={pendientes}
        sincronizando={sincronizando}
        onSalir={salir}
        onAlertaRapida={() => setAlertaAbierta(true)}
      />

      <main id="contenido">
        {vista === 'dashboard' && esAdmin && <AdminDashboard notificar={notificar} onVerEnMapa={verEnMapa} />}

        {vista === 'reportar' && !esAdmin && (
          <AutoFillFormWithCombos
            catalogos={catalogos}
            enLinea={enLinea}
            notificar={notificar}
            onEnviado={alEnviar}
            onAlertaRapida={() => setAlertaAbierta(true)}
          />
        )}

        {vista === 'mapa' && (
          <ReportesMapView
            catalogos={catalogos}
            seleccionInicial={seleccionMapa}
            recargarToken={recargarMapa}
            accionesTarjeta={
              esAdmin ? (r, recargar) => <AccionesEstado reporte={r} onActualizado={recargar} notificar={notificar} /> : undefined
            }
          />
        )}

        {vista === 'comunidad' && !esAdmin && (
          <CommunityFeed catalogos={catalogos} notificar={notificar} onVerEnMapa={verEnMapa} sesionLocal={!sesion.token} />
        )}
      </main>

      {!esAdmin && (
        <QuickAlert
          abierto={alertaAbierta}
          onCerrar={() => setAlertaAbierta(false)}
          catalogos={catalogos}
          notificar={notificar}
          onEnviado={alEnviar}
        />
      )}
      <Toast toast={toast} onCerrar={cerrarToast} />
    </div>
  );
}
