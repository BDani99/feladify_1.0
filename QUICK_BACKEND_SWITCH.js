/**
 * GYORS BACKEND VÁLTÁS
 * Másold be ezt a Developer Console-ba (F12)
 *
 * ============================================================
 */

// === JELENLEGI BACKEND MUTATÁSA ===
__apiConfig.getCurrent();

// === VÁLTÁS PRODUCTION-RA ===
__apiConfig.prod();
window.location.reload();

// === VÁLTÁS LOCAL-RA ===
__apiConfig.local();
window.location.reload();

// === HELP ===
__apiConfig.help();

/**
 * ============================================================
 *
 * KONFIGURÁCIÓS FÁJLOK:
 *
 * 📄 src/config/api.js
 *    - API endpoint konfiguráció
 *    - Lokál: http://localhost:3000
 *    - Prod: https://feladify-1-0backend.vercel.app
 *
 * 📄 src/config/fetchClient.js
 *    - Fetch wrapper, ami automatikusan hozzáadja az API_BASE-t
 *
 * 📄 src/components/ApiConfigHelper.js
 *    - Browser console helper
 *
 * 📖 API_CONFIG_GUIDE.md
 *    - Részletes útmutató
 *
 * ============================================================
 *
 * GYAKORI FELADATOK:
 *
 * 1. Prod backend tesztelése local frontend-ből:
 *    __apiConfig.prod()
 *    window.location.reload()
 *
 * 2. Local backend tesztelése:
 *    __apiConfig.local()
 *    window.location.reload()
 *
 * 3. Query param-mal (egyszer):
 *    http://localhost:3000?api=prod
 *
 * 4. API endpoint resetálása (automatikus detektálásra):
 *    localStorage.removeItem('API_ENDPOINT')
 *    window.location.reload()
 *
 * ============================================================
 */
