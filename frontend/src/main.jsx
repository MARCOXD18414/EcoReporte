import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// En desarrollo el SW interfiere con el HMR de Vite: se activa en build/preview
// (o con VITE_ENABLE_SW=true para probar offline en dev).
if ('serviceWorker' in navigator && (import.meta.env.PROD || import.meta.env.VITE_ENABLE_SW === 'true')) {
  // Al publicar una versión nueva, el SW nuevo toma el control y la página se recarga una vez
  // (evita que alguien se quede con una versión vieja guardada para modo offline).
  const habiaControlador = Boolean(navigator.serviceWorker.controller);
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!habiaControlador || recargando) return;
    recargando = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => reg.update())
      .catch((err) => console.warn('[SW] registro fallido', err));
  });
}
