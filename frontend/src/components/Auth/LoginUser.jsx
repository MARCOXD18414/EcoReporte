import { useState } from 'react';
import { ArrowRight, ShieldCheck, Waves, Trees, Fish } from 'lucide-react';
import { api } from '../../services/api.js';
import { Logo } from '../Shared/Navbar.jsx';

/** Portal Ciudadano: acceso sin contraseña (sólo alias opcional) para máxima inclusión. */
export default function LoginUser({ onLogin, onIrAdmin }) {
  const [alias, setAlias] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function entrar(e) {
    e?.preventDefault();
    setCargando(true);
    setError('');
    try {
      const sesion = await api.loginCiudadano(alias.trim());
      onLogin(sesion);
    } catch (err) {
      if (err.offline || err.status >= 500) {
        // Sin señal o servidor caído: sesión local; los reportes se sincronizan de forma anónima
        onLogin({ usuario: { id: null, alias: alias.trim() || 'Vecin@', rol: 'ciudadano' }, token: null, local: true });
      } else {
        setError(err.message);
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-gradient-to-br from-morado-900 via-morado-800 to-morado-700 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 px-5 py-10 lg:flex-row lg:gap-16">
        <section className="max-w-lg text-center lg:text-left">
          <div className="mb-6 flex justify-center lg:justify-start">
            <Logo />
          </div>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Cuidemos la <span className="text-magenta-400">Laguna de Términos</span> juntos
          </h1>
          <p className="mt-4 text-base text-morado-100 sm:text-lg">
            Toma una foto y la IA Gemma llena el reporte por ti. Sin señal en el manglar o la playa, se guarda y se envía solo
            cuando vuelva la red.
          </p>
          <ul className="mt-6 flex flex-wrap justify-center gap-2 text-sm lg:justify-start">
            <li className="chip border-morado-400 text-morado-100"><Waves size={16} aria-hidden /> Playa Norte</li>
            <li className="chip border-morado-400 text-morado-100"><Trees size={16} aria-hidden /> Manglares</li>
            <li className="chip border-morado-400 text-morado-100"><Fish size={16} aria-hidden /> Fauna marina</li>
          </ul>
        </section>

        <form onSubmit={entrar} className="tarjeta w-full max-w-md p-6 text-morado-900 sm:p-8" aria-labelledby="titulo-ciudadano">
          <h2 id="titulo-ciudadano" className="text-xl font-bold">Portal Ciudadano</h2>
          <p className="mt-1 text-sm text-morado-600">No necesitas contraseña. Tu nombre es opcional.</p>

          <label htmlFor="alias" className="etiqueta mt-5">¿Cómo te llamamos? (opcional)</label>
          <input
            id="alias"
            className="campo"
            value={alias}
            maxLength={40}
            autoComplete="nickname"
            placeholder="Ej. Mari de Playa Norte"
            onChange={(e) => setAlias(e.target.value)}
          />

          {error && <p role="alert" className="mt-3 text-sm font-medium text-magenta-600">{error}</p>}

          <button type="submit" disabled={cargando} className="btn-primario mt-5 w-full text-lg">
            {cargando ? 'Entrando…' : 'Entrar y reportar'} <ArrowRight size={20} aria-hidden />
          </button>

          <div className="my-5 h-px bg-morado-100" />

          <button type="button" onClick={onIrAdmin} className="btn-suave w-full">
            <ShieldCheck size={18} aria-hidden /> Soy de Servicios Públicos
          </button>
        </form>
      </div>
      <footer className="pb-6 text-center text-xs text-morado-300">Ciudad del Carmen, Campeche · Hack for Humanity</footer>
    </main>
  );
}
