/**
 * API Config Helper Component
 * A developer tools-ban elérhető helper a backend URL váltásához
 */

import { switchApiEndpoint, getCurrentEndpoint } from '../config/api';

export const initApiConfigHelper = () => {
  if (typeof window === 'undefined') return;

  // Globális API config helper az ablakban
  window.__apiConfig = {
    /**
     * Jelenlegi endpoint információi
     */
    getCurrent: () => {
      const current = getCurrentEndpoint();
      console.table({
        'Backend mód': current.name,
        'URL': current.url
      });
      return current;
    },

    /**
     * Váltás Local-ra
     */
    local: () => {
      switchApiEndpoint('local');
      console.log('⏳ Oldal frissítéshez: window.location.reload()');
    },

    /**
     * Váltás Production-ra
     */
    prod: () => {
      switchApiEndpoint('prod');
      console.log('⏳ Oldal frissítéshez: window.location.reload()');
    },

    /**
     * Help
     */
    help: () => {
      console.log(`
%c🔧 API Config Helper
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Éppen ezt használod:
`, 'color: #3b82f6; font-weight: bold; font-size: 14px');
      window.__apiConfig.getCurrent();

      console.log(`
%c Parancsok:
%c • __apiConfig.getCurrent()  - Jelenlegi backend mutatása
%c • __apiConfig.local()       - Váltás localhost:3000-ra
%c • __apiConfig.prod()        - Váltás production Vercel-re
%c • window.location.reload()  - Oldal frissítése

Példa:
%c > __apiConfig.prod()
%c > window.location.reload()
      `, 'color: #64748b; font-size: 12px', 'color: #f59e0b; font-family: monospace;', 'color: #f59e0b; font-family: monospace;', 'color: #f59e0b; font-family: monospace;', 'color: #f59e0b; font-family: monospace;', 'color: #10b981; font-weight: bold; font-size: 11px', 'color: #10b981; font-family: monospace; font-size: 11px');
    }
  };

  // Auto-show help on first load (dev csak)
  if (process.env.NODE_ENV === 'development') {
    console.log('%c💡 Fejlesztés: Használd a __apiConfig helper-t!\nírj: __apiConfig.help()', 'color: #8b5cf6; font-style: italic;');
  }
};

export default initApiConfigHelper;
