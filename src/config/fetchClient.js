/**
 * Fetch Client Wrapper
 * Automatikusan hozzáadja a API_BASE URL-t az összes API híváshoz
 */

import { API_BASE } from './api';

/**
 * Wrapper a fetch körül, amely automatikusan hozzáadja az API_BASE-t
 *
 * Használat:
 *   // Lokális API URL-ek helyett:
 *   // fetch('api/auth/login', { ... })
 *
 *   // Most ezt használd:
 *   fetchClient('/api/auth/login', { ... })
 *   // vagy (relatív):
 *   fetchClient('api/auth/login', { ... })
 *
 *   // Output: https://feladify-1-0backend.vercel.app/api/auth/login
 */
export const fetchClient = (endpoint, options = {}) => {
  // Ha már teljes URL (http://... vagy https://...), ne módosítsd
  if (endpoint.startsWith('http')) {
    return fetch(endpoint, options);
  }

  // Ha a végpont nem kezdődik /-vel, add hozzá
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Kombinálj az API_BASE-vel
  const fullUrl = `${API_BASE}${path}`;

  console.debug(`[API] ${options.method || 'GET'} ${fullUrl}`);

  return fetch(fullUrl, options);
};

export default fetchClient;
