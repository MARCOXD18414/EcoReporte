import { Camera, Map, Users, LayoutDashboard, LogOut, Wifi, WifiOff, CloudUpload, Siren } from 'lucide-react';

const VISTAS = {
  ciudadano: [
    { id: 'reportar', etiqueta: 'Reportar', Icono: Camera },
    { id: 'mapa', etiqueta: 'Mapa', Icono: Map },
    { id: 'comunidad', etiqueta: 'Comunidad', Icono: Users },
  ],
  admin: [
    { id: 'dashboard', etiqueta: 'Panel', Icono: LayoutDashboard },
    { id: 'mapa', etiqueta: 'Mapa', Icono: Map },
  ],
};

export function Logo({ claro = true }) {
  return (
    <div className="flex items-center gap-2">
      <img src="/icons/icon.svg" alt="" className="h-9 w-9" />
      <div className="leading-tight">
        <p className={`text-lg font-bold ${claro ? 'text-white' : 'text-marino-900'}`}>
          Eco<span className="text-naranja-400">Reporta</span>
        </p>
        <p className={`text-[11px] font-medium ${claro ? 'text-marino-200' : 'text-marino-500'}`}>Amor x Carmen 🧡</p>
      </div>
    </div>
  );
}

export default function Navbar({ usuario, vista, onCambiarVista, enLinea, pendientes, sincronizando, onSalir, onAlertaRapida }) {
  const items = VISTAS[usuario.rol] || VISTAS.ciudadano;

  return (
    <>
      <header className="sticky top-0 z-[1000] bg-marino-800 text-white shadow-lg" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
          <Logo />

          <nav aria-label="Secciones" className="hidden md:block">
            <ul className="flex gap-1">
              {items.map(({ id, etiqueta, Icono }) => (
                <li key={id}>
                  <button
                    onClick={() => onCambiarVista(id)}
                    aria-current={vista === id ? 'page' : undefined}
                    className={`btn px-4 ${vista === id ? 'bg-naranja-500 text-white' : 'text-marino-100 hover:bg-marino-700'}`}
                  >
                    <Icono size={18} aria-hidden /> {etiqueta}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <span
              role="status"
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                enLinea ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/25 text-red-100'
              }`}
            >
              {enLinea ? <Wifi size={14} aria-hidden /> : <WifiOff size={14} aria-hidden />}
              <span className="hidden whitespace-nowrap xl:inline">{enLinea ? 'En línea' : 'Sin señal'}</span>
            </span>
            {pendientes > 0 && (
              <span
                className="flex items-center gap-1 rounded-full bg-naranja-500 px-2.5 py-1 text-xs font-bold"
                title="Reportes guardados sin señal que se enviarán automáticamente"
              >
                <CloudUpload size={14} aria-hidden className={sincronizando ? 'animate-bounce' : ''} />
                {pendientes}
                <span className="sr-only"> reportes pendientes de sincronizar</span>
              </span>
            )}
            {usuario.rol === 'ciudadano' && (
              <button onClick={onAlertaRapida} className="btn hidden bg-red-600 px-3 text-white hover:bg-red-700 sm:inline-flex">
                <Siren size={18} aria-hidden /> <span className="whitespace-nowrap">Alerta</span>
                <span className="hidden whitespace-nowrap lg:inline">rápida</span>
              </button>
            )}
            <button onClick={onSalir} className="btn px-3 text-marino-100 hover:bg-marino-700" aria-label="Cerrar sesión">
              <LogOut size={18} aria-hidden />
              <span className="hidden lg:inline">{usuario.alias}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navegación inferior en móviles */}
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-[1000] border-t border-marino-700 bg-marino-800 md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="flex">
          {items.map(({ id, etiqueta, Icono }) => (
            <li key={id} className="flex-1">
              <button
                onClick={() => onCambiarVista(id)}
                aria-current={vista === id ? 'page' : undefined}
                className={`flex w-full flex-col items-center gap-0.5 py-2.5 text-xs font-semibold ${
                  vista === id ? 'text-naranja-400' : 'text-marino-200'
                }`}
              >
                <Icono size={22} aria-hidden />
                {etiqueta}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
