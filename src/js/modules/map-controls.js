'use strict';

const MIN_ZOOM = 12;
const MAX_ZOOM = 19;

export function initMapControls() {
  const container = document.querySelector('[data-map-container]');
  if (!container) return;

  const map = container.querySelector('[data-map-source]');
  const status = container.querySelector('[data-map-status]');
  const directions = container.querySelector('[data-map-directions]');
  const destination = `${container.dataset.destinationLat},${container.dataset.destinationLng}`;
  let zoom = Number(container.dataset.mapZoom) || 17;

  const setStatus = (message, error = false) => {
    status.textContent = message;
    status.classList.toggle('is-error', error);
  };

  const setMapSource = (source) => {
    container.classList.remove('is-loaded');
    map.addEventListener('load', () => container.classList.add('is-loaded'), { once: true });
    map.src = source;
  };

  const updateZoom = (change) => {
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + change));
    container.dataset.mapZoom = String(zoom);
    const source = new URL(map.getAttribute('src') || map.dataset.mapSource);
    if (source.hostname.includes('openstreetmap.org')) {
      const latitude = Number(container.dataset.destinationLat);
      const longitude = Number(container.dataset.destinationLng);
      const span = 0.02 * (2 ** (17 - zoom));
      source.searchParams.set('bbox', `${longitude - span / 2},${latitude - span / 2},${longitude + span / 2},${latitude + span / 2}`);
    } else {
      source.searchParams.set('z', String(zoom));
    }
    setMapSource(source.toString());
    setStatus(`Nivel de acercamiento: ${zoom}.`);
  };

  container.querySelector('[data-map-zoom-in]')?.addEventListener('click', () => updateZoom(1));
  container.querySelector('[data-map-zoom-out]')?.addEventListener('click', () => updateZoom(-1));

  container.querySelector('[data-map-location]')?.addEventListener('click', () => {
    if (!navigator.geolocation) {
      setStatus('Este navegador no permite obtener tu ubicación.', true);
      return;
    }
    setStatus('Solicitando permiso para consultar tu ubicación…');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const origin = `${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`;
      const route = new URL('https://www.google.com/maps/dir/');
      route.searchParams.set('api', '1');
      route.searchParams.set('origin', origin);
      route.searchParams.set('destination', destination);
      route.searchParams.set('travelmode', 'driving');
      directions.href = route.toString();

      const embeddedRoute = new URL('https://maps.google.com/maps');
      embeddedRoute.searchParams.set('saddr', origin);
      embeddedRoute.searchParams.set('daddr', destination);
      embeddedRoute.searchParams.set('hl', 'es');
      embeddedRoute.searchParams.set('z', String(zoom));
      embeddedRoute.searchParams.set('output', 'embed');
      setMapSource(embeddedRoute.toString());
      setStatus('Ubicación autorizada. El mapa muestra la ruta hacia la dirección indicada.');
    }, (error) => {
      const denied = error.code === error.PERMISSION_DENIED;
      setStatus(denied ? 'No se concedió permiso de ubicación. Puedes usar “Cómo llegar”.' : 'No fue posible obtener tu ubicación actual.', true);
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  });
}
