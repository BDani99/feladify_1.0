/**
 * API Backend Configuration
 * Erre az environment-alapú API URL-ek vannak beállítva
 *
 * Switching:
 * 1. localStorage: localStorage.setItem('API_ENDPOINT', 'local'); // vagy 'prod'
 * 2. Query parameter: ?api=prod vagy ?api=local
 * 3. Megváltoztatni az alábbiakat közvetlenül
 */

const ENDPOINTS = {
  local: 'http://localhost:3000',      // Local backend
  prod: 'https://feladify-1-0backend.vercel.app'  // Production backend
};

const getApiEndpoint = () => {
  // 1. Query parametercheck (pl. ?api=prod)
  const params = new URLSearchParams(window.location.search);
  const queryApi = params.get('api');
  if (queryApi && ENDPOINTS[queryApi]) {
    localStorage.setItem('API_ENDPOINT', queryApi);
    return ENDPOINTS[queryApi];
  }

  // 2. localStorage check
  const stored = localStorage.getItem('API_ENDPOINT');
  if (stored && ENDPOINTS[stored]) {
    return ENDPOINTS[stored];
  }

  // 3. Default: ha localhost:3000 vagy localhost, akkor local; egyébként prod
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return ENDPOINTS.local;
  }

  return ENDPOINTS.prod;
};

export const API_BASE = getApiEndpoint();

/**
 * Helper function: API endpoint váltása
 * Használat: switchApiEndpoint('prod') vagy switchApiEndpoint('local')
 */
export const switchApiEndpoint = (endpoint) => {
  if (!ENDPOINTS[endpoint]) {
    console.error(`Invalid endpoint: ${endpoint}. Use 'local' or 'prod'.`);
    return;
  }
  localStorage.setItem('API_ENDPOINT', endpoint);
  console.log(`API Endpoint switched to: ${endpoint} (${ENDPOINTS[endpoint]})`);
  console.log('Oldal frissítéshez: window.location.reload()');
};

/**
 * Helper: jelenlegi endpoint lekérdezése
 */
export const getCurrentEndpoint = () => {
  const current = localStorage.getItem('API_ENDPOINT') ||
    (window.location.hostname === 'localhost' ? 'local' : 'prod');
  return {
    name: current,
    url: ENDPOINTS[current]
  };
};

console.log(`%c[API Config] Using ${getCurrentEndpoint().name} backend: ${API_BASE}`, 'color: #10b981; font-weight: bold;');
