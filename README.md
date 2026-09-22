<div align="center">

# 📚 Feladify

**AI-alapú oktatási platform tanároknak, diákoknak és szülőknek**

Feladatsor-generálás, automatikus javítás, személyre szabott gyakorlás és valós idejű kommunikáció egy helyen — a magyar kerettantervre szabva (5–8. osztály).

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](#-licenc)

</div>

---

## 📖 Tartalomjegyzék

- [Mi ez a projekt?](#-mi-ez-a-projekt)
- [Főbb funkciók](#-főbb-funkciók)
- [Szerepkörök](#-szerepkörök)
- [Technológiai stack](#-technológiai-stack)
- [Projekt felépítése](#-projekt-felépítése)
- [Indítás lépésről lépésre](#-indítás-lépésről-lépésre)
- [Elérhető parancsok](#-elérhető-parancsok)
- [Admin panel](#-admin-panel)
- [Deployment](#-deployment)
- [Biztonság](#-biztonság)
- [Licenc](#-licenc)

---

## 🎯 Mi ez a projekt?

A **Feladify** egy teljes körű, AI-vel támogatott oktatási platform általános iskolák (5–8. évfolyam) számára. A tanárok másodpercek alatt generálhatnak kerettantervhez illeszkedő feladatsorokat, a diákok AI-korrepetálást és személyre szabott gyakorlási útvonalat kapnak, a szülők pedig valós idejű betekintést nyernek gyermekük fejlődésébe.

A rendszer négy különálló felületből áll: egy React SPA a tanárok/diákok/szülők számára, egy önálló admin panel az üzemeltetéshez, és egy Node.js/Express API, amely mindkettőt kiszolgálja.

## ✨ Főbb funkciók

### 🤖 Mesterséges intelligencia
- **Feladatsor-generálás** a kerettanterv alapján, testreszabható nehézségi szinttel, kérdéstípusokkal és témakörökkel
- **Automatikus javítás** — nyílt végű, rövid szöveges válaszok AI-alapú, szinonimákat és elgépeléseket is toleráló értékelése
- **AI korrepetálás (tutor chat)** minden szerepkörnek — szókratészi módszerű segítségnyújtás, ami nem árulja el azonnal a megoldást
- **Diagnosztikai tesztek** → személyre szabott fejlesztési útvonal (roadmap) → checkpoint-alapú gyakorlás, jelvényekkel (badge) és folyamatkövetéssel
- **Szülői AI-tanácsadó**, amely a gyermek eredményei alapján ad javaslatokat
- Több AI-szolgáltató (DeepSeek, Qwen) automatikus fallback-lánccal és részletes token/költség-követéssel

### 🏫 Oktatásszervezés
- Osztályok, tanárok és diákok kezelése, feladatsorok kiosztása osztályonként vagy diákonként
- Kerettanterv-szerkesztő (téma, tananyagegység szintű testreszabás tantárgyanként)
- Hirdetmények / osztályterem-fal, határidőkkel
- Valós idejű értesítések (SSE) — új feladat, javított dolgozat, hirdetmény, stb.
- Dokumentumkezelő (mappák, fájlfeltöltés, megosztási linkek) minden felhasználónak

### 📊 Elemzés és statisztika
- Részletes, tantárgyankénti és osztályonkénti statisztikák tanároknak
- Egyéni fejlődés-kimutatás diákoknak és szülőknek
- AI-költség és -használat dashboard adminoknak

## 👥 Szerepkörök

A platformon **négy szerepkör** létezik, mindegyik saját felülettel és jogosultságokkal.

### 🧑‍🏫 Tanár (`teacher`)
- Feladatsorok generálása AI-val vagy kézi összeállítása, kiosztása egy vagy több osztálynak/diáknak
- Beküldött dolgozatok automatikus (AI) és kézi javítása, pontszám felülbírálása, osztályzat véglegesítése
- Diákok reklamációinak (flag) elbírálása egy-egy kérdésnél
- Kerettanterv testreszabása saját tantárgyaira
- Hirdetmények közzététele osztályok felé
- AI tanár-asszisztenssel folytatott chat (pl. ötletelés, segítség)
- Osztályonkénti/tantárgyankénti statisztikák, dokumentumtár

### 🧑‍🎓 Diák (`student`)
- Elérhető dolgozatok kitöltése (automatikus mentés/piszkozat), határidőkkel
- Eredmények és visszajelzések megtekintése, kérdésenkénti AI-magyarázat kérése
- Reklamáció (flag) benyújtása egy értékelt kérdésre
- **Egyéni gyakorlás**: diagnosztikai teszt → személyre szabott roadmap → checkpoint gyakorlások, jelvényekkel
- AI tutor chat, korrepetálás és tippek kérése
- Saját statisztikák, célok, dokumentumtár

### 👨‍👩‍👧 Szülő (`parent`)
- Egy vagy több gyermek hozzárendelése (regisztrációkor, gyermek e-mail címe alapján)
- Gyermek(ek) eredményeinek, statisztikáinak és fejlődési útjának valós idejű követése
- Célok (`goals`) beállítása, értesítési preferenciák (pl. gyenge jegy vagy közelgő határidő esetén)
- AI-tanácsadóval való konzultáció a gyermek fejlődéséről
- Osztályterem/hirdetmények megtekintése

### 🛡️ Admin (`admin`)
- Önálló, vanilla JS admin panel (`/admin`), külön bejelentkezéssel
- Felhasználók (tanár/diák/szülő) kezelése: létrehozás, szerkesztés, törlés, keresés/szűrés
- Tartalomkezelés: feladatsorok, osztályok, hirdetmények áttekintése és törlése
- Rendszer-dashboard: regisztrációs és aktivitási statisztikák, szerepkör-megoszlás
- **AI-költségkövetés**: modellenkénti, hívó-függvényenkénti és felhasználónkénti token- és dollárköltség kimutatás
- Rendszerállapot (DB-kapcsolat, uptime, API-kulcsok maszkolt állapota)

> ⚠️ Az `admin` szerepkör **nem** igényelhető a nyilvános regisztrációs űrlapon — admin fiókot csak a [`npm run create-admin`](#-elérhető-parancsok) paranccsal vagy egy meglévő admin a panelen keresztül hozhat létre.

## 🛠 Technológiai stack

| Réteg | Technológiák |
|---|---|
| **Frontend** | React 18, React Router, Bootstrap 5, Chart.js, react-markdown, react-toastify |
| **Backend** | Node.js, Express, Mongoose (MongoDB) |
| **Hitelesítés** | JWT (`jsonwebtoken`), `bcryptjs` jelszóhasheléshez |
| **AI** | DeepSeek és Qwen (DashScope) API-k, OpenAI-kompatibilis kliensen keresztül |
| **Fájltárolás** | MongoDB GridFS (dokumentumkezelő modul) |
| **Valós idejű kommunikáció** | Server-Sent Events (SSE) |
| **Admin panel** | Önálló, függőség nélküli vanilla JS SPA |
| **Deployment** | Vercel (frontend és backend külön szolgáltatásként) |

## 📁 Projekt felépítése

```
feladify_1.0/
├── src/                    # React frontend (tanár / diák / szülő felület)
│   ├── api/                # Backend API hívások szerepkör/modul szerint
│   ├── components/         # Újrafelhasználható UI komponensek
│   ├── context/             # React context-ek (felhasználó, chat-ek)
│   ├── pages/               # Oldalak szerepkörönként (Teacher/Student/Parent/Admin)
│   └── utils/                # Segédfüggvények (pl. token kezelés)
│
├── backend/
│   ├── server.js            # Express app belépési pont
│   ├── routes/               # API végpontok (auth, assignments, student, parent, admin, ...)
│   ├── controllers/          # Vékonyabb, route-független logika (pl. dokumentumkezelés)
│   ├── middleware/            # JWT hitelesítés szerepkörönként, rate limiting
│   ├── models/                 # Mongoose sémák
│   ├── services/                # AI szolgáltatás-réteg, költségkövetés, realtime (SSE)
│   ├── data/                     # Kerettanterv JSON adatok tantárgyanként
│   ├── public/admin/              # Admin panel (statikus vanilla JS SPA)
│   └── scripts/                    # Egyszeri/karbantartási scriptek (admin létrehozás, DB-javítás...)
│
└── public/                  # React statikus assetek
```

## 🚀 Indítás lépésről lépésre

### Előfeltételek

- **Node.js** 18+ és npm
- **MongoDB** adatbázis (helyi telepítés vagy [MongoDB Atlas](https://www.mongodb.com/atlas))
- API kulcs a **[DeepSeek](https://platform.deepseek.com/)** és a **[Qwen / Alibaba DashScope](https://dashscope.console.aliyun.com/)** szolgáltatásokhoz (az AI funkciókhoz kötelező)

### 1. Repó klónozása és függőségek telepítése

```bash
git clone <repo-url>
cd feladify_1.0

# Frontend függőségek
npm install

# Backend függőségek
cd backend
npm install
cd ..
```

### 2. Környezeti változók beállítása

Hozz létre egy `.env` fájlt a `backend/` mappában — mintaként használd a `backend/.env.example` fájlt:

```bash
cp backend/.env.example backend/.env
```

Majd töltsd ki a szükséges értékeket:

| Változó | Kötelező | Leírás |
|---|---|---|
| `MONGO_URI` | ✅ | MongoDB kapcsolati string |
| `JWT_SECRET` | ✅ | Hosszú, véletlenszerű titkos kulcs a token aláíráshoz |
| `JWT_EXPIRES_IN` | – | Token élettartama (alapértelmezett: `12h`) |
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API kulcs (AI funkciókhoz) |
| `QWEN_API_KEY` | ✅ | Qwen / DashScope API kulcs (AI funkciókhoz) |
| `PORT` | – | Backend port (alapértelmezett: `5000`) |
| `ALLOWED_ORIGINS` | – | Vesszővel elválasztott CORS engedélyezési lista (üresen: minden origin engedélyezett) |
| `ADMIN_USERNAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | – | Az admin fiók létrehozó script paraméterei |

> A `backend/.env` fájlt **soha ne** commitold — a `.gitignore` már kizárja.

### 3. Backend indítása

```bash
cd backend
npm start
```

A szerver alapértelmezetten a `http://localhost:5000` címen indul el.

### 4. Frontend indítása

Új terminálban, a projekt gyökeréből:

```bash
npm start
```

A React fejlesztői szerver a `http://localhost:3000` címen indul, és a `package.json`-ban beállított proxy miatt automatikusan a helyi backendhez irányítja az API hívásokat.

### 5. Admin fiók létrehozása (opcionális)

```bash
cd backend
npm run create-admin
```

Ha nem adtál meg `ADMIN_PASSWORD` értéket a `.env`-ben, a script generál egyet és **egyszer** kiírja a konzolra — jegyezd fel! Az admin panel a `http://localhost:5000/admin` címen érhető el.

## 📜 Elérhető parancsok

**Frontend** (a gyökérkönyvtárból):

| Parancs | Leírás |
|---|---|
| `npm start` | Fejlesztői szerver indítása (`localhost:3000`) |
| `npm run build` | Production build készítése a `build/` mappába |
| `npm test` | Tesztek futtatása |

**Backend** (a `backend/` mappából):

| Parancs | Leírás |
|---|---|
| `npm start` | Express szerver indítása |
| `npm run create-admin` | Admin felhasználó létrehozása az adatbázisban |
| `npm run db:heal` | Karbantartási script: hibásan kódolt fájl-/mappanevek javítása |

## 🖥 Admin panel

Az admin felület egy önálló, keretrendszer nélküli vanilla JS SPA, amit a backend statikusan szolgál ki a `/admin` útvonalon (tehát külön build lépés nem kell hozzá). Bejelentkezés után elérhető:

- **Áttekintés** — regisztrációs és használati statisztikák
- **Felhasználók** — CRUD műveletek minden szerepkörön
- **Tartalmak** — feladatsorok, osztályok, hirdetmények kezelése
- **AI Költségek** — modell-, hívó- és felhasználó-szintű bontásban
- **Statisztikák** — grafikonok (Chart.js) a platform használatáról
- **Rendszer** — adatbázis-állapot, API-kulcsok (maszkolva), saját jelszó módosítása

## ☁️ Deployment

A projekt [Vercel](https://vercel.com/)-re van előkészítve, **két külön szolgáltatásként**:

- A gyökér `vercel.json` a React SPA-t szolgálja ki (kliensoldali route-ok visszaírása `index.html`-re)
- A `backend/vercel.json` a teljes Express appot szerverless függvényként futtatja

Éles környezetben mindenképp állítsd be az `ALLOWED_ORIGINS` változót a frontend pontos domain-jére, és győződj meg róla, hogy minden `.env` érték egyedi, production-szintű titok.

## 🔒 Biztonság

A backend a következő védelmi rétegeket tartalmazza:

- Szerepkör-alapú JWT hitelesítés (`teacher` / `student` / `parent` / `admin`), tulajdonjog-ellenőrzéssel minden erőforrás-hozzáférésnél
- `bcrypt` jelszóhashelés, minimális jelszóhossz-követelmény
- Rate limiting minden API végponton, szigorúbb korlátokkal a bejelentkezésen és az AI-hívásokat indító útvonalakon
- Bemenet-validáció és MIME-típus allowlist a fájlfeltöltésnél
- XSS elleni védelem (escapelés) az admin panelben
- Az AI-alapú javítás védve van a promptinjekció ellen (a diák válasza mindig adatként, nem utasításként kerül feldolgozásra)

## 📄 Licenc

ISC
