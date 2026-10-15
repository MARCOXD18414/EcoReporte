import { useEffect } from 'react';
import { CheckCircle2, CloudOff, AlertTriangle, Info, X } from 'lucide-react';

const ESTILOS = {
  exito: { Icono: CheckCircle2, clase: 'bg-turquesa-600' },
  offline: { Icono: CloudOff, clase: 'bg-morado-700' },
  error: { Icono: AlertTriangle, clase: 'bg-magenta-600' },
  info: { Icono: Info, clase: 'bg-morado-800' },
};

export default function Toast({ toast, onCerrar }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onCerrar, toast.duracion || 5000);
    return () => clearTimeout(t);
  }, [toast, onCerrar]);

  if (!toast) return null;
  const { Icono, clase } = ESTILOS[toast.tipo] || ESTILOS.info;

  return (
    <div
      role={toast.tipo === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className={`fixed inset-x-4 bottom-24 z-[2000] mx-auto flex max-w-md items-start gap-3 rounded-2xl p-4 text-white shadow-2xl md:bottom-6 ${clase}`}
    >
      <Icono size={22} aria-hidden className="mt-0.5 shrink-0" />
      <p className="flex-1 text-sm font-medium">{toast.mensaje}</p>
      <button onClick={onCerrar} aria-label="Cerrar aviso" className="rounded-lg p-1 hover:bg-white/20">
        <X size={18} aria-hidden />
      </button>
    </div>
  );
}
