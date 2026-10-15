import { useState } from 'react';
import { ArrowLeft, LogIn, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api.js';
import { Logo } from '../Shared/Navbar.jsx';

/** Portal de Servicios Públicos / Autoridades. */
export default function LoginAdmin({ onLogin, onVolver }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function entrar(e) {
    e.preventDefault();
    setCargando(true);
    setError('');
    try {
      onLogin(await api.loginAdmin(email.trim(), password));
    } catch (err) {
      setError(err.offline ? 'El panel administrativo requiere conexión a internet.' : err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-marino-900 px-5 py-10">
      <form onSubmit={entrar} className="tarjeta w-full max-w-md p-6 sm:p-8" aria-labelledby="titulo-admin">
        <div className="mb-6 flex items-center justify-between">
          <div className="rounded-xl bg-marino-800 px-3 py-2">
            <Logo />
          </div>
          <ShieldCheck size={32} className="text-naranja-500" aria-hidden />
        </div>
        <h1 id="titulo-admin" className="text-xl font-bold">Servicios Públicos / Autoridades</h1>
        <p className="mt-1 text-sm text-marino-600">Panel de atención de reportes ambientales.</p>

        <label htmlFor="email" className="etiqueta mt-5">Correo institucional</label>
        <input id="email" type="email" required autoComplete="username" className="campo" value={email} onChange={(e) => setEmail(e.target.value)} />

        <label htmlFor="password" className="etiqueta mt-4">Contraseña</label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          className="campo"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}

        <button type="submit" disabled={cargando} className="btn-marino mt-6 w-full">
          <LogIn size={18} aria-hidden /> {cargando ? 'Verificando…' : 'Entrar al panel'}
        </button>
        <button type="button" onClick={onVolver} className="btn mt-2 w-full text-marino-700 hover:bg-marino-50">
          <ArrowLeft size={18} aria-hidden /> Volver al portal ciudadano
        </button>
      </form>
    </main>
  );
}
