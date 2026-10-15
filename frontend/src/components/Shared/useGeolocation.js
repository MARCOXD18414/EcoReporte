import { useCallback, useEffect, useRef, useState } from 'react';

const PRECISION_OBJETIVO = 10; // metros: al alcanzarla se deja de afinar
const TIEMPO_MAXIMO = 25000; // ms afinando como máximo

/**
 * GPS de alta precisión.
 * En lugar de una sola lectura (que en el celular suele venir de antenas/wifi con ±100 m o más),
 * escucha lecturas continuas con `watchPosition` y se queda con la MÁS precisa,
 * hasta llegar a ±10 m o a los 25 s.
 */
export default function useGeolocation({ auto = true } = {}) {
  const [estado, setEstado] = useState({ cargando: false, afinando: false, coords: null, precision: null, error: null });
  const watchRef = useRef(null);
  const timerRef = useRef(null);
  const mejorRef = useRef(Infinity);

  const detener = useCallback(() => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    clearTimeout(timerRef.current);
    watchRef.current = null;
    setEstado((e) => ({ ...e, cargando: false, afinando: false }));
  }, []);

  const obtener = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setEstado((e) => ({ ...e, error: 'Tu dispositivo no tiene GPS disponible. Coloca el pin en el mapa.' }));
      return;
    }
    detener();
    mejorRef.current = Infinity;
    setEstado({ cargando: true, afinando: false, coords: null, precision: null, error: null });

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const precision = Math.round(pos.coords.accuracy);
        if (precision >= mejorRef.current) return; // sólo mejoras
        mejorRef.current = precision;
        setEstado({
          cargando: false,
          afinando: precision > PRECISION_OBJETIVO,
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          precision,
          error: null,
        });
        if (precision <= PRECISION_OBJETIVO) detener();
      },
      (err) => {
        // Si ya tenemos una lectura buena, un error posterior no la borra
        if (mejorRef.current !== Infinity) return detener();
        detener();
        setEstado((e) => ({
          ...e,
          error:
            err.code === 1
              ? 'Permiso de ubicación denegado. Actívalo en el navegador o coloca el pin en el mapa.'
              : 'No se pudo obtener el GPS. Sal a cielo abierto o coloca el pin en el mapa.',
        }));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: TIEMPO_MAXIMO }
    );
    timerRef.current = setTimeout(detener, TIEMPO_MAXIMO);
  }, [detener]);

  useEffect(() => {
    if (auto) obtener();
    return detener;
  }, [auto, obtener, detener]);

  return { ...estado, obtener, detener };
}

/** Texto corto y legible del estado del GPS. */
export function textoGps(gps) {
  if (gps.cargando) return 'Buscando señal GPS…';
  if (gps.coords && gps.afinando) return `Mejorando precisión… ±${gps.precision} m`;
  if (gps.coords) return `GPS listo · precisión ±${gps.precision} m`;
  return gps.error || 'GPS sin activar';
}
