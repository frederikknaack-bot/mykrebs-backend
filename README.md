# 🏫 MyKrebs — Skoleintranet for Krebs Skole

MyKrebs er et moderne skoleintranet bygget som et skoleeksamensprojekt. Systemet erstatter forældede løsninger som Skoleintra med en hurtig, mobilvenlig webapp der virker på alle enheder.

## 🌐 Live Demo
- **Elev:** https://velvety-kitsune-f73520.netlify.app/mykrebs-elev.html
- **Personale:** https://velvety-kitsune-f73520.netlify.app/mykrebs-personale.html
- **Forældre:** https://velvety-kitsune-f73520.netlify.app/mykrebs-foraldre.html
- **Admin:** https://velvety-kitsune-f73520.netlify.app/mykrebslogin.html

## 🏗️ Arkitektur

| Lag | Teknologi |
|-----|-----------|
| Frontend | HTML, CSS, JavaScript (4 single-page apps) |
| Backend | Node.js + Express (Railway) |
| Database | PostgreSQL via Supabase |
| Hosting | Netlify (frontend) + Railway (backend) |

## ✅ Funktioner

### Uge 1-2 — Backend, login og godkendelsessystem
- **Elev:** Registrering, login, opslagstavle, ugeplan, lektier, klassechat, læsekontrakt, venner, kontakt lærere
- **Personale:** Login, godkend/afvis elever, ugeplan, lektier, fremmøde, klassechat med åbningstider, læsekontrakter
- **Forældre:** Login, tilknyt barn (3-trins godkendelse), se barnets lektier, fravær og ugeplan, kontakt lærere
- **Admin:** Dashboard med alle brugere, godkend/afvis konti, systemstatus

### Sikkerhed
- JWT-baseret autentifikation
- 3-trins forældre-barn tilknytning (forælder → lærer → elev)
- Bcrypt password hashing
- Supabase Row Level Security

## 🗄️ Database
PostgreSQL med følgende tabeller:
- `brugere` — elever, lærere og forældre
- `foraeldre_boern` — forældre-barn tilknytninger med godkendelsesstatus
- `lektier` — lektier per klasse
- `fravaer` — fremmøderegistrering
- `opslag` — opslagstavle opslag
- `ugeplan` — ugeplaner per klasse

## 🔒 API Endpoints

### Auth
- `POST /api/auth/login/elev` — elev login
- `POST /api/auth/login/laerer` — lærer login  
- `POST /api/auth/login/foraelder` — forælder login
- `POST /api/auth/registrer/elev` — opret elevkonto (kræver lærerens godkendelse)
- `POST /api/auth/godkend/elev` — lærer godkender elev
- `GET /api/auth/afventende/elever` — vis afventende elever
- `GET /api/auth/soeg/barn` — forælder søger efter barn
- `POST /api/auth/tilknyt/barn` — forælder sender tilknytningsanmodning
- `POST /api/auth/godkend/tilknytning` — lærer godkender tilknytning
- `POST /api/auth/bekraeft/foraelder` — elev bekræfter forælder
- `GET /api/auth/mine/boern` — forælder henter sine børn

## 🗓️ Udviklingsplan

| Uge | Status | Indhold |
|-----|--------|---------|
| 1-2 | ✅ Færdig | Backend, database, login, godkendelsesflow, forældre-barn tilknytning |
| 3 | 🔄 Kommende | PWA + responsivt design til computer |
| 4 | ⏳ Planlagt | Galleri (billeder fra ture) |
| 5 | ⏳ Planlagt | Elevjournal (kontaktbog) |
| 6 | ⏳ Planlagt | Face ID via WebAuthn |
| 7 | ⏳ Planlagt | Email-bekræftelse + design polish |
| 8 | ⏳ Planlagt | Privatlivspolitik + præsentation for rektor |
| 9 | ⏳ Planlagt | Rektors ændringer |

## 👨‍💻 Udvikler
Frederik Knaack — Krebs Skole, 2026
