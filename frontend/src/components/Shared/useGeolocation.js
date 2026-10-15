import { useCallback, useEffect, useState } from 'react';

/** GPS de alta precisión con estado legible para la UI. */
export default function useGeolocation({ auto = true } = {}) {
  const [estado, setEstado] = useState({ cargando: false, coords: null, precision: null, error: null });

  const obtener = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setEstado((e) => ({ ...e, error: 'Tu dispositivo no tiene GPS disponible' }));
      return;
    }
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setEstado({
          cargando: false,
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          precision: Math.round(pos.coords.accuracy),
          error: null,
        }),
      (err) =>
        setEstado((e) => ({
          ...e,
          cargando: false,
          error:
            err.code === 1
              ? 'Permiso de ubicación denegado. Coloca el pin manualmente en el mapa.'
              : 'No se pudo obtener el GPS. Coloca el pin manualmente en el mapa.',
        })),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }, []);

  useEffect(() => {
    if (auto) obtener();
  }, [auto, obtener]);

  return { ...estado, obtener };
}
