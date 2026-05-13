# 🔧 API Backend Config Guide

Ehhez a projekthez 2 backend elérhető:
- **Local**: `http://localhost:3000` (fejlesztés közben)
- **Production**: `https://feladify-1-0backend.vercel.app` (éles)

---

## 🚀 Gyors Váltás (Browser Console)

Nyiss meg egy **Developer Tools** (F12) konzolt és futtasd ezeket:

### Jelenlegi backend mutatása
```javascript
__apiConfig.getCurrent()
// Output:
// Backend mód: "local" (vagy "prod")
// URL: "http://localhost:3000"
```

### Váltás Prod-ra
```javascript
__apiConfig.prod()
window.location.reload()
```

### Váltás Local-ra
```javascript
__apiConfig.local()
window.location.reload()
```

### Help megjelenítése
```javascript
__apiConfig.help()
```

---

## 🌍 Automatikus Detektálás

Az alkalmazás **automatikusan** választ a backend között:

1. **Localhost-on** (http://localhost:3000 vagy http://127.0.0.1)
   → **Local** backend-et használ

2. **Éles szerveren** (pl. Vercel)
   → **Production** backend-et használ

3. **localStorage felülbírálása**
   ```javascript
   localStorage.setItem('API_ENDPOINT', 'prod')  // vagy 'local'
   window.location.reload()
   ```

4. **Query parameter** (egyszer használat)
   ```
   http://localhost:3000?api=prod
   http://feladify.vercel.app?api=local
   ```

---

## 📝 API Hívások Frissítése

### Option 1: `fetchClient` Wrapper Használata (Ajánlott)

Új API fájlok esetén használd a `fetchClient`-et:

```javascript
// src/api/Student/NewApi.js
import fetchClient from '../../config/fetchClient';

export const someApiCall = async () => {
  try {
    const response = await fetchClient('/api/student/data', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return await response.json();
  } catch (err) {
    console.error('API error:', err);
    throw err;
  }
};
```

### Option 2: Relatív URL-ek (Jelenlegi Módszer)

A meglévő API fájlok relatív URL-eket használnak (`api/auth/login`).  
Ez működik, mert a böngésző az aktuális origin-hez adja hozzá azokat.

**Probléma**: Ha másik doménről szeretnél hívni (pl. localhost → prod), nem működik.

**Megoldás**: Használd a `fetchClient`-et, vagy frissítsd az API hívásokat.

---

## 🔄 Meglévő API Fájlok Frissítése

Ha szeretnél egy meglévő API fájlt frissíteni:

**Előtte:**
```javascript
// src/api/Auth/LoginApi.js
export const login = async (email, password) => {
  const response = await fetch('api/auth/login', { ... });
  // ...
};
```

**Után:**
```javascript
import fetchClient from '../../config/fetchClient';

export const login = async (email, password) => {
  const response = await fetchClient('api/auth/login', { ... });
  // ...
};
```

---

## 🎯 Gyakorlati Scenario

### Scenario 1: Fejlesztés (Local Backend)
```bash
# Terminal 1: Backend futás
cd backend
npm start  # http://localhost:3000

# Terminal 2: Frontend futás
npm start  # http://localhost:3000 (vagy 3001)
```
✅ Automatikusan local backend-et használ.

### Scenario 2: Éles Backend Tesztelése (Local Frontend)
```javascript
// 1. Browser konzolon:
__apiConfig.prod()
window.location.reload()

// 2. Vagy egyszer használattal:
// http://localhost:3000?api=prod
```
✅ Local frontend, prod backend.

### Scenario 3: Prod Frontend & Backend
```
https://feladify.vercel.app/
```
✅ Automatikusan prod backend-et használ.

---

## 🔍 Debug Info

### Console logok
Ha DEBUG módban vagy, a console mutatja az API hívásokat:
```
[API] GET https://feladify-1-0backend.vercel.app/api/student/data
```

### Environment Check
```javascript
process.env.NODE_ENV  // "development" vagy "production"
API_BASE              // aktuális backend URL
```

---

## ⚠️ Tipikus Hibák

### Hiba: CORS error
**Oka**: Más doménről hívod az API-t (pl. localhost:3000 → prod backend)
**Megoldás**: 
- Használj `fetchClient`-et 
- Vagy backend-en engedélyezd a CORS-t

### Hiba: "Cannot find module config/fetchClient"
**Oka**: Az API fájlok az új `fetchClient`-et próbálják importálni, de az nem frissült
**Megoldás**: Csak az új API fájlokhoz használd a `fetchClient`-et. A régieket lehet relativURL-rel hagyni.

---

## 📚 Fájlok

- **`src/config/api.js`** - API endpoint konfiguráció
- **`src/config/fetchClient.js`** - Fetch wrapper
- **`src/components/ApiConfigHelper.js`** - Browser console helper

---

## 💡 Tippek

- 💾 Mentsd el az `__apiConfig.help()` parancsot a böngésző könyvjelzőbe ha gyakran kell váltani
- 🔗 Használd a query param módszert (`?api=prod`) ha másnak szeretnél linket küldeni teszteléshez
- 🧪 `localStorage.removeItem('API_ENDPOINT')` - Reset az automatikus detektálásra

---

**Kérdések?** Check a konzolon: `__apiConfig.help()`
