SET search_path TO parcel_locker;

--------------------------------------------------
-- 1. WYCZYŚĆ DANE
--------------------------------------------------
TRUNCATE TABLE ZdarzeniePaczki RESTART IDENTITY CASCADE;
TRUNCATE TABLE Przedluzenie   RESTART IDENTITY CASCADE;
TRUNCATE TABLE Paczka         RESTART IDENTITY CASCADE;

TRUNCATE TABLE ObslugaAutomatu RESTART IDENTITY CASCADE;
TRUNCATE TABLE Pracownik       RESTART IDENTITY CASCADE;
TRUNCATE TABLE Klient          RESTART IDENTITY CASCADE;

TRUNCATE TABLE Skrytka RESTART IDENTITY CASCADE;
TRUNCATE TABLE Automat RESTART IDENTITY CASCADE;
TRUNCATE TABLE Rozmiar RESTART IDENTITY CASCADE;


--------------------------------------------------
-- 2. ROZMIARY (TYLKO FIZYCZNE – BEZ SPAN_X / SPAN_Y)
--------------------------------------------------
INSERT INTO Rozmiar
(kod, szerokosc_cm, wysokosc_cm, glebokosc_cm)
VALUES
('S', 20,  8, 30),
('M', 40, 20, 40),
('L', 60, 40, 60);


--------------------------------------------------
-- 3. AUTOMATY
--------------------------------------------------
INSERT INTO Automat
(nazwa, adres, wspolrzedne_gps, status, liczba_wierszy, liczba_kolumn)
VALUES
-- KRAKÓW
('KRA-001', 'ul. Aleja Mickiewicza 30, 30-059 Kraków', '50.0669,19.9127', 'AKTYWNY', 4, 6),

-- WARSZAWA
('WAR-001', 'ul. Marszałkowska 100, 00-001 Warszawa', '52.2297,21.0122', 'AKTYWNY', 6, 8);




SET search_path TO parcel_locker;

WITH
-- 1) KLIENT
kli AS (
  INSERT INTO Klient (imie, nazwisko, email, telefon)
  VALUES ('Test', 'Klient', 'klient@test.pl', '000000003')
  ON CONFLICT (email) DO UPDATE
    SET imie = EXCLUDED.imie
  RETURNING klient_id
),

-- 2) PRACOWNICY
adm AS (
  INSERT INTO Pracownik (imie, nazwisko, email, telefon, rola)
  VALUES ('Test', 'Admin', 'admin@test.pl', '000000000', 'ADMIN')
  ON CONFLICT (email) DO UPDATE
    SET rola = EXCLUDED.rola
  RETURNING pracownik_id
),
opr AS (
  INSERT INTO Pracownik (imie, nazwisko, email, telefon, rola)
  VALUES ('Test', 'Operator', 'operator@test.pl', '000000001', 'OPERATOR')
  ON CONFLICT (email) DO UPDATE
    SET rola = EXCLUDED.rola
  RETURNING pracownik_id
),
kur AS (
  INSERT INTO Pracownik (imie, nazwisko, email, telefon, rola)
  VALUES ('Test', 'Kurier', 'kurier@test.pl', '000000002', 'KURIER')
  ON CONFLICT (email) DO UPDATE
    SET rola = EXCLUDED.rola
  RETURNING pracownik_id
),

-- 3) APPUSER: KLIENT
u_klient AS (
  INSERT INTO AppUser (email, password_hash, rola, klient_id, pracownik_id, must_change_password)
  VALUES (
    'klient@test.pl',
    '$2b$10$93KvjylWV8l9SewI4uet5.1FuaUqeW9.bv.We634ZAtZJibf4K.e2',
    'KLIENT',
    (SELECT klient_id FROM kli),
    NULL,
    TRUE
  )
  ON CONFLICT (email) DO UPDATE
    SET
      password_hash = EXCLUDED.password_hash,
      rola = EXCLUDED.rola,
      klient_id = EXCLUDED.klient_id,
      pracownik_id = EXCLUDED.pracownik_id,
      must_change_password = EXCLUDED.must_change_password
  RETURNING app_user_id
),

-- 4) APPUSER: ADMIN
u_admin AS (
  INSERT INTO AppUser (email, password_hash, rola, klient_id, pracownik_id, must_change_password)
  VALUES (
    'admin@test.pl',
    '$2b$10$QmfEJCkZQAlOgUdkp5XfuO7lhJ9x89RZu5tV6xCVFGTDlYSTeJQUS',
    'ADMIN',
    NULL,
    (SELECT pracownik_id FROM adm),
    FALSE
  )
  ON CONFLICT (email) DO UPDATE
    SET
      password_hash = EXCLUDED.password_hash,
      rola = EXCLUDED.rola,
      klient_id = EXCLUDED.klient_id,
      pracownik_id = EXCLUDED.pracownik_id,
      must_change_password = EXCLUDED.must_change_password
  RETURNING app_user_id
),

-- 5) APPUSER: OPERATOR
u_operator AS (
  INSERT INTO AppUser (email, password_hash, rola, klient_id, pracownik_id, must_change_password)
  VALUES (
    'operator@test.pl',
    '$2b$10$QpSymrcIfv6jtHHGg./zL.0htJIBZKayu9Xq9YGYJCuJwNTzagyxa',
    'OPERATOR',
    NULL,
    (SELECT pracownik_id FROM opr),
    FALSE
  )
  ON CONFLICT (email) DO UPDATE
    SET
      password_hash = EXCLUDED.password_hash,
      rola = EXCLUDED.rola,
      klient_id = EXCLUDED.klient_id,
      pracownik_id = EXCLUDED.pracownik_id,
      must_change_password = EXCLUDED.must_change_password
  RETURNING app_user_id
),

-- 6) APPUSER: KURIER
u_kurier AS (
  INSERT INTO AppUser (email, password_hash, rola, klient_id, pracownik_id, must_change_password)
  VALUES (
    'kurier@test.pl',
    '$2b$10$eDAaICQ/8L/BSaaEwEM1AupcOJVC4HCVA3Pau65bSlbaGXYpxAoFa',
    'KURIER',
    NULL,
    (SELECT pracownik_id FROM kur),
    FALSE
  )
  ON CONFLICT (email) DO UPDATE
    SET
      password_hash = EXCLUDED.password_hash,
      rola = EXCLUDED.rola,
      klient_id = EXCLUDED.klient_id,
      pracownik_id = EXCLUDED.pracownik_id,
      must_change_password = EXCLUDED.must_change_password
  RETURNING app_user_id
)

SELECT
  (SELECT klient_id FROM kli) AS klient_id,
  (SELECT pracownik_id FROM adm) AS admin_pracownik_id,
  (SELECT pracownik_id FROM opr) AS operator_pracownik_id,
  (SELECT pracownik_id FROM kur) AS kurier_pracownik_id,

  (SELECT app_user_id FROM u_klient)   AS appuser_klient_id,
  (SELECT app_user_id FROM u_admin)    AS appuser_admin_id,
  (SELECT app_user_id FROM u_operator) AS appuser_operator_id,
  (SELECT app_user_id FROM u_kurier)   AS appuser_kurier_id;
