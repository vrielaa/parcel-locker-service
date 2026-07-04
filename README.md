# Parcel Locker Service

## Wersje Aplikacji

W repozytorium istnieją dwie wersje aplikacji:

- `main` - stabilna wersja 1.x oparta o frontend w `frontend/`,
- `feature/angular-v2` - rozwijana wersja 2.0 z frontendem migrowanym do Angulara.

Webowa aplikacja bazodanowa symulująca system obsługi automatów paczkowych. Projekt składa się z frontendu statycznego, backendu REST API oraz bazy PostgreSQL ze schematem `parcel_locker`.

## Spis Treści

- [Opis](#opis)
- [Stack Technologiczny](#stack-technologiczny)
- [Architektura](#architektura)
- [Funkcjonalności](#funkcjonalności)
- [Wymagania](#wymagania)
- [Uruchomienie Krok Po Kroku](#uruchomienie-krok-po-kroku)
- [Konfiguracja Lokalna](#konfiguracja-lokalna)
- [Baza Danych](#baza-danych)
- [Konta Testowe](#konta-testowe)
- [Uruchamianie](#uruchamianie)
- [API](#api)
- [Struktura Projektu](#struktura-projektu)
- [Deployment](#deployment)
- [Uwagi Po Analizie](#uwagi-po-analizie)

## Opis

Celem aplikacji jest odwzorowanie uproszczonego procesu logistycznego dla automatów paczkowych:

- klient zakłada konto, wybiera automat docelowy i nadaje paczkę,
- operator zatwierdza oczekujące paczki,
- kurier podejmuje paczki, przewozi je i umieszcza w odpowiednich skrytkach,
- klient śledzi swoje paczki, historię zdarzeń i może przedłużyć termin odbioru,
- administrator zarządza użytkownikami, automatami oraz uszkodzonymi skrytkami.

System ma role aplikacyjne, tokeny JWT, widoki dopasowane do roli użytkownika oraz logikę integralności danych wymuszaną także po stronie PostgreSQL.

## Stack Technologiczny

Frontend:

- HTML + JavaScript ES Modules
- Vite
- SCSS/Sass
- Firebase Hosting

Frontend 2.0 na gałęzi `feature/angular-v2`:

- Angular 22
- TypeScript
- Tailwind CSS 4 przez PostCSS
- globalne design tokens w `frontend-angular/src/styles.css`
- nowoczesne Signals API, Signal Forms, `input()` i `output()` dla komponentów
- RxJS tylko przy granicach frameworka lub IO, np. router i HTTP
- lokalne proxy `/api` do backendu Express

Backend:

- Node.js
- Express
- PostgreSQL przez `pg`
- JWT przez `jsonwebtoken`
- haszowanie haseł przez `bcrypt`
- `dotenv`, `cors`

Baza danych:

- PostgreSQL
- schemat `parcel_locker`
- funkcje PL/pgSQL
- triggery
- widoki SQL
- role bazodanowe w osobnym pliku `roles.sql`

## Architektura

```text
frontend/
  HTML + JS + SCSS
  API_BASE = /api
        |
        v
backend/
  Express REST API pod /api
        |
        v
PostgreSQL
  schema parcel_locker
  tabele, widoki, funkcje, triggery
```

W produkcji Firebase Hosting serwuje pliki z `frontend/dist`, a ścieżki `/api/**` są przepisywane do usługi Cloud Run `parcel-locker-service` w regionie `europe-central2`.

## Funkcjonalności

- rejestracja i logowanie klientów,
- logowanie użytkowników testowych dla ról `ADMIN`, `OPERATOR`, `KURIER`,
- wymuszona zmiana hasła dla kont tworzonych przez administratora,
- lista miast i automatów,
- podgląd układu skrytek w automacie,
- nadawanie paczki przez klienta,
- zatwierdzanie paczek przez operatora,
- podejmowanie paczek przez kuriera,
- wybór wolnej skrytki pasującej do wymiarów paczki,
- umieszczanie paczki w automacie,
- historia zdarzeń paczki,
- przedłużanie terminu odbioru,
- oznaczanie skrytek jako uszkodzone,
- obsługa uszkodzonych skrytek przez administratora,
- zarządzanie użytkownikami i automatami przez administratora,
- administracyjne czyszczenie i inicjalizacja schematu bazy.

## Wymagania

- Node.js 18+,
- Node.js 24.15.0 dla frontendu Angular 2.0 na Angularze 22 (`.nvmrc` i `.node-version` są w repo),
- npm,
- Docker Desktop z Docker Compose,
- opcjonalnie PostgreSQL 14+ przy uruchamianiu bez Dockera,
- opcjonalnie Firebase CLI do deploymentu hostingu.

## Uruchomienie Krok Po Kroku

Najprostszy lokalny start korzysta z Dockera dla PostgreSQL.

1. Sklonuj repozytorium i przejdź do katalogu projektu:

```bash
git clone <adres-repozytorium>
cd parcel-locker-service
```

Jeżeli masz już projekt lokalnie, wystarczy wejść do katalogu:

```bash
cd parcel-locker-service
```

2. Uruchom Docker Desktop.

Na macOS możesz użyć:

```bash
open -a Docker
```

Poczekaj, aż Docker Desktop będzie gotowy. Możesz to sprawdzić:

```bash
docker info
```

3. Zainstaluj zależności:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
npm --prefix frontend-angular install # tylko na gałęzi feature/angular-v2
```

4. Utwórz lokalne pliki konfiguracyjne:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Domyślne wartości są przygotowane pod lokalny start:

```text
Backend:   http://localhost:3000
Frontend:  http://localhost:5173/login.html
PostgreSQL: localhost:5433
DB user:   postgres
DB pass:   postgres
DB name:   parcel_locker
```

5. Uruchom projekt:

```bash
npm run dev
```

Ta komenda:

- uruchamia PostgreSQL przez `docker compose`,
- czeka aż baza będzie gotowa,
- inicjalizuje schemat i dane startowe, jeśli baza jest pusta,
- uruchamia backend,
- uruchamia frontend.

6. Otwórz aplikację:

```text
http://localhost:5173/login.html
```

7. Zaloguj się kontem testowym:

| Rola | Email | Hasło |
| --- | --- | --- |
| ADMIN | `admin@test.pl` | `admin123` |
| OPERATOR | `operator@test.pl` | `operator123` |
| KURIER | `kurier@test.pl` | `kurier123` |
| KURIER | `kurier2@test.pl` | `kurier123` |

Konto klienta możesz utworzyć przez formularz rejestracji.

8. Opcjonalnie otwórz dokumentację API:

```text
http://localhost:3000/api-docs
```

### Przydatne Komendy

```bash
npm run dev        # pełny lokalny start: DB + backend + frontend
npm run dev:app    # tylko backend + frontend, bez uruchamiania Dockera
npm run dev:angular # DB + backend + Angular 2.0 na gałęzi feature/angular-v2
npm run build:angular # build Angular 2.0
npm run db:up      # uruchomienie lokalnego Postgresa
npm run db:setup   # inicjalizacja DB tylko jeśli schema jeszcze nie istnieje
npm run db:init    # pełny reset schematu i danych startowych
npm run db:down    # zatrzymanie lokalnego Postgresa
```

### Typowe Problemy

Jeżeli widzisz `ECONNREFUSED 127.0.0.1:5433` albo `ECONNREFUSED ::1:5433`, PostgreSQL nie działa. Uruchom Docker Desktop i ponów:

```bash
npm run db:up
npm run dev
```

Jeżeli port `5433` jest zajęty, zmień mapowanie portu w `docker-compose.yml` oraz `DB_PORT` w `backend/.env`.

Jeżeli chcesz zacząć z czystą bazą:

```bash
npm run db:init
```

## Konfiguracja Lokalna

Zainstaluj zależności w katalogu głównym oraz w obu częściach aplikacji:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
npm --prefix frontend-angular install # tylko na gałęzi feature/angular-v2
```

Skopiuj przykładowe pliki env:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Domyślna konfiguracja zakłada lokalny backend na porcie `3000`, projektowy PostgreSQL na porcie `5433` i bazę `parcel_locker`. Jeżeli Twoja lokalna baza działa na innym porcie albo używa innego użytkownika lub hasła, zmień `DB_PORT`, `DB_USER` i `DB_PASS` w `backend/.env`.

Dla Google Cloud SQL backend obsługuje też zmienną:

```env
INSTANCE_CONNECTION_NAME=project:region:instance
```

Jeżeli `INSTANCE_CONNECTION_NAME` jest ustawione, backend użyje socketa `/cloudsql/<INSTANCE_CONNECTION_NAME>` zamiast `DB_HOST`.

## Baza Danych

Normalnie wystarczy uruchomić:

```bash
npm run dev
```

Ten skrypt podnosi lokalny PostgreSQL przez Docker Compose, czeka na gotowość bazy i inicjalizuje schemat tylko wtedy, gdy jeszcze go nie ma.

Jeżeli chcesz osobno podnieść lub zatrzymać bazę:

```bash
npm run db:up
npm run db:down
```

Jeżeli chcesz wymusić pełny reset schematu i danych:

```bash
npm run db:init
```

`db:init` uruchamia `schema.sql`, `functions.sql`, `data.sql` i `view.sql`. Uwaga: `schema.sql` usuwa i tworzy schemat `parcel_locker` od nowa, więc kasuje dane w tym schemacie.

Opcjonalnie dodaj role bazodanowe i uprawnienia:

```bash
psql -d parcel_locker -f backend/sql/roles.sql
```

Backend ma też endpointy administracyjne:

- `POST /api/db/init` - uruchamia `schema.sql`, `functions.sql`, `data.sql`, `view.sql`,
- `POST /api/db/clear` - usuwa schemat `parcel_locker`,
- `GET /api/db/test` - sprawdza połączenie z bazą.

Te endpointy wymagają zalogowanego użytkownika z rolą `ADMIN` albo `OPERATOR`.

## Konta Testowe

Seed w `backend/sql/data.sql` tworzy konta:

| Rola | Email | Hasło |
| --- | --- | --- |
| ADMIN | `admin@test.pl` | `admin123` |
| OPERATOR | `operator@test.pl` | `operator123` |
| KURIER | `kurier@test.pl` | `kurier123` |
| KURIER | `kurier2@test.pl` | `kurier123` |

Konto klienta można utworzyć przez formularz rejestracji.

## Uruchamianie

Backend bez automatycznego uruchamiania Dockera:

```bash
npm start --prefix backend
```

Domyślnie API działa na:

```text
http://localhost:3000
```

Frontend bez automatycznego uruchamiania Dockera:

```bash
npm run dev --prefix frontend
```

Domyślnie Vite otwiera:

```text
http://localhost:5173/login.html
```

Uruchom backend i frontend jedną komendą:

```bash
npm run dev
```

Lokalnie Vite proxy'uje `/api` do `VITE_API_PROXY_TARGET`, domyślnie `http://localhost:3000`. W produkcji ten sam prefiks `/api` obsługuje rewrite Firebase do Cloud Run.

## API

Wszystkie endpointy backendu są pod prefiksem `/api`.

Dokumentacja Swagger UI jest dostepna pod:

```text
http://localhost:3000/api-docs
```

Surowy OpenAPI JSON:

```text
http://localhost:3000/api/openapi.json
```

### Publiczne

- `GET /api/miasta` - lista miast z automatami,
- `GET /api/automaty?miasto=<miasto>` - automaty w mieście,
- `GET /api/automaty/:id` - szczegóły automatu i skrytek.

### Auth

- `POST /api/auth/register` - rejestracja klienta,
- `POST /api/auth/login` - logowanie,
- `GET /api/auth/me` - dane zalogowanego użytkownika,
- `POST /api/auth/change-password` - zmiana hasła.

Autoryzacja odbywa się nagłówkiem:

```http
Authorization: Bearer <token>
```

### Klient

- `POST /api/me/paczki` - nadanie paczki,
- `GET /api/me/paczki` - paczki zalogowanego klienta,
- `POST /api/paczki/:id/przedluzenia` - przedłużenie terminu odbioru,
- `GET /api/paczki/:id/zdarzenia` - historia paczki.

### Operator

- `GET /api/operator/paczki/pending` - paczki oczekujące na zatwierdzenie,
- `GET /api/operator/paczki/:id/skrytki` - dostępne skrytki dla paczki,
- `POST /api/operator/paczki/:id/approve` - zatwierdzenie paczki,
- `POST /api/paczki` - utworzenie paczki przez operatora,
- `PUT /api/automaty/:id/status` - zmiana statusu automatu,
- `PUT /api/skrytki/:id/status` - zmiana statusu skrytki.

### Kurier

- `GET /api/kurier/paczki/pool` - pula paczek do podjęcia,
- `GET /api/kurier/paczki` - paczki przypisane do kuriera,
- `POST /api/kurier/paczki/:id/podejmij` - rozpoczęcie transportu,
- `GET /api/kurier/paczki/:id/skrytki-docelowe` - wolne pasujące skrytki w automacie docelowym,
- `POST /api/kurier/paczki/:id/umiesc-w-automacie` - umieszczenie paczki w skrytce,
- `PUT /api/kurier/skrytki/:id/status` - oznaczenie skrytki jako uszkodzonej.

### Admin

- `GET /api/admin/users` - lista użytkowników,
- `POST /api/admin/users` - dodanie użytkownika,
- `DELETE /api/admin/users/:id` - usunięcie użytkownika,
- `GET /api/admin/clients/:id/paczki?mode=sent|received` - paczki klienta,
- `POST /api/admin/paczki/:id/simulate-pickup` - symulacja odbioru paczki,
- `POST /api/admin/automaty` - dodanie automatu,
- `DELETE /api/admin/automaty/:id` - usunięcie automatu,
- `GET /api/admin/automaty/locker-faulty` - automaty z uszkodzonymi skrytkami,
- `PUT /api/admin/automaty/:parcelLockerId/lockers/:lockerId/mark-repaired` - naprawa skrytki.

## Struktura Projektu

```text
.
├── backend/
│   ├── package.json
│   ├── sql/
│   │   ├── schema.sql
│   │   ├── functions.sql
│   │   ├── data.sql
│   │   ├── view.sql
│   │   ├── roles.sql
│   │   └── init.sql
│   └── src/
│       ├── server.js
│       ├── db.js
│       ├── databaseAdmin.js
│       ├── utils.js
│       ├── middleware/
│       └── routes/
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── app.html
│   ├── change-password.html
│   ├── src/
│   │   ├── api.js
│   │   ├── app.js
│   │   └── features/
│   └── sass/
├── frontend-angular/
│   ├── angular.json
│   ├── proxy.conf.json
│   ├── public/
│   └── src/
│       ├── app/
│       └── styles.css
├── locker-data/
│   ├── csv_by_city/
│   ├── csv_wojewodzkie/
│   └── *.py
├── firebase.json
└── package.json
```

Najważniejsze pliki:

- `backend/src/server.js` - start Expressa i podpięcie `/api`,
- `backend/src/db.js` - konfiguracja poola PostgreSQL i `search_path=parcel_locker,public`,
- `backend/src/routes/*.routes.js` - endpointy REST,
- `backend/sql/schema.sql` - tabele i relacje,
- `backend/sql/functions.sql` - funkcje i triggery,
- `backend/sql/data.sql` - dane startowe,
- `backend/sql/view.sql` - widoki dla frontendu,
- `frontend/src/api.js` - klient HTTP i obsługa JWT,
- `frontend/src/app.js` - inicjalizacja widoków zależnych od roli,
- `frontend/src/features/` - moduły funkcjonalne UI.
- `frontend-angular/src/app/core/api/` - konfiguracja API i klient HTTP dla Angulara 2.0,
- `frontend-angular/src/app/pages/` - trasy startowe pod migrację widoków do Angulara.

## Deployment

Build frontendu:

```bash
npm --prefix frontend run build
```

Build i deploy Firebase Hosting:

```bash
npm run firebase-deploy
```

Konfiguracja `firebase.json`:

- publikuje `frontend/dist`,
- przekierowuje `/` do `/login.html`,
- mapuje `/api/**` na Cloud Run service `parcel-locker-service` w regionie `europe-central2`.

## Uwagi Po Analizie

- Projekt jest rozdzielony na trzy warstwy: statyczny frontend, Express API i PostgreSQL.
- Uprawnienia aplikacyjne są sprawdzane przez JWT oraz middleware `requireRoles`.
- Baza nie jest tylko magazynem danych: triggery pilnują m.in. generowania układu skrytek, dopasowania paczki do skrytki, statusów i reguł biznesowych.
- `backend/sql/init.sql` wygląda jak monolityczny plik inicjalizacyjny, ale kod backendu używa osobno `schema.sql`, `functions.sql`, `data.sql` i `view.sql`.
- W repo jest dużo danych pomocniczych w `locker-data/`, w tym CSV z lokalizacjami automatów i skrypty do generowania insertów.
- Lokalny dev frontend/backend wymaga dopracowania proxy dla `/api`, jeśli aplikacja ma działać bez Firebase/Cloud Run rewrite.
