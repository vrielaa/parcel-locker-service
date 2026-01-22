SET search_path TO parcel_locker;

--------------------------------------------------
-- 1. WYCZYŚĆ DANE (zależności)
--------------------------------------------------
TRUNCATE TABLE ZdarzeniePaczki RESTART IDENTITY CASCADE;
TRUNCATE TABLE Przedluzenie   RESTART IDENTITY CASCADE;
TRUNCATE TABLE Paczka         RESTART IDENTITY CASCADE;

TRUNCATE TABLE ObslugaAutomatu RESTART IDENTITY CASCADE;
TRUNCATE TABLE AppUser         RESTART IDENTITY CASCADE;

TRUNCATE TABLE Pracownik       RESTART IDENTITY CASCADE;
TRUNCATE TABLE Klient          RESTART IDENTITY CASCADE;

TRUNCATE TABLE Skrytka         RESTART IDENTITY CASCADE;
TRUNCATE TABLE Automat         RESTART IDENTITY CASCADE;
TRUNCATE TABLE Rozmiar         RESTART IDENTITY CASCADE;

--------------------------------------------------
-- 2. ROZMIARY
--------------------------------------------------
INSERT INTO Rozmiar (kod, szerokosc_cm, wysokosc_cm, glebokosc_cm)
VALUES
('S', 20,  8, 30),
('M', 40, 20, 40),
('L', 60, 40, 60);

--------------------------------------------------
-- 3. AUTOMATY
-- (skrytki wygenerują się automatycznie przez trigger AFTER INSERT)
--------------------------------------------------
INSERT INTO Automat
(nazwa, adres, wspolrzedne_gps, status, liczba_wierszy, liczba_kolumn)
VALUES
('KRA-001', 'ul. Aleja Mickiewicza 30, 30-059 Kraków', '50.0669,19.9127', 'AKTYWNY', 4, 6),
('WAR-001', 'ul. Marszałkowska 100, 00-001 Warszawa', '52.2297,21.0122', 'AKTYWNY', 6, 8);

--------------------------------------------------
-- 4. PRACOWNICY + APPUSER (ADMIN/OPERATOR/KURIER + KURIER2)
-- (bez klienta i bez paczek)
--------------------------------------------------
WITH
adm AS (
  INSERT INTO Pracownik (imie, nazwisko, email, telefon, rola)
  VALUES ('Test', 'Admin', 'admin@test.pl', '000000000', 'ADMIN')
  ON CONFLICT (email) DO UPDATE SET rola = EXCLUDED.rola
  RETURNING pracownik_id
),
opr AS (
  INSERT INTO Pracownik (imie, nazwisko, email, telefon, rola)
  VALUES ('Test', 'Operator', 'operator@test.pl', '000000001', 'OPERATOR')
  ON CONFLICT (email) DO UPDATE SET rola = EXCLUDED.rola
  RETURNING pracownik_id
),
kur1 AS (
  INSERT INTO Pracownik (imie, nazwisko, email, telefon, rola)
  VALUES ('Test', 'Kurier', 'kurier@test.pl', '000000002', 'KURIER')
  ON CONFLICT (email) DO UPDATE SET rola = EXCLUDED.rola
  RETURNING pracownik_id
),
kur2 AS (
  INSERT INTO Pracownik (imie, nazwisko, email, telefon, rola)
  VALUES ('Test', 'Kurier2', 'kurier2@test.pl', '000000004', 'KURIER')
  ON CONFLICT (email) DO UPDATE SET rola = EXCLUDED.rola
  RETURNING pracownik_id
),

u_admin AS (
  INSERT INTO AppUser (email, password_hash, rola, klient_id, pracownik_id, must_change_password)
  VALUES (
    'admin@test.pl',
    '$2b$10$wd3YAAcbeF7gjGQrQaX/vuOieuZp8aJyjFR.Jmu.c1GU5bWzP939C',
    'ADMIN',
    NULL,
    (SELECT pracownik_id FROM adm),
    FALSE
  )
  ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        rola = EXCLUDED.rola,
        klient_id = NULL,
        pracownik_id = EXCLUDED.pracownik_id,
        must_change_password = EXCLUDED.must_change_password
  RETURNING app_user_id
),

u_operator AS (
  INSERT INTO AppUser (email, password_hash, rola, klient_id, pracownik_id, must_change_password)
  VALUES (
    'operator@test.pl',
    '$2b$10$OUou6IxryJnFGJGvbftOz.1hWLv7gmMtqS6PqTpmTQGP1Nia.uSvy',
    'OPERATOR',
    NULL,
    (SELECT pracownik_id FROM opr),
    FALSE
  )
  ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        rola = EXCLUDED.rola,
        klient_id = NULL,
        pracownik_id = EXCLUDED.pracownik_id,
        must_change_password = EXCLUDED.must_change_password
  RETURNING app_user_id
),

u_kurier1 AS (
  INSERT INTO AppUser (email, password_hash, rola, klient_id, pracownik_id, must_change_password)
  VALUES (
    'kurier@test.pl',
    '$2b$10$0WTKoeHSi2rTv.7hZ6zzlOMv6UXpDjuOAf6bHbMNPyz9m7mzTKkS6',
    'KURIER',
    NULL,
    (SELECT pracownik_id FROM kur1),
    FALSE
  )
  ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        rola = EXCLUDED.rola,
        klient_id = NULL,
        pracownik_id = EXCLUDED.pracownik_id,
        must_change_password = EXCLUDED.must_change_password
  RETURNING app_user_id
),

u_kurier2 AS (
  INSERT INTO AppUser (email, password_hash, rola, klient_id, pracownik_id, must_change_password)
  VALUES (
    'kurier2@test.pl',
    '$2b$10$0WTKoeHSi2rTv.7hZ6zzlOMv6UXpDjuOAf6bHbMNPyz9m7mzTKkS6',
    'KURIER',
    NULL,
    (SELECT pracownik_id FROM kur2),
    FALSE
  )
  ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        rola = EXCLUDED.rola,
        klient_id = NULL,
        pracownik_id = EXCLUDED.pracownik_id,
        must_change_password = EXCLUDED.must_change_password
  RETURNING app_user_id
)

SELECT
  (SELECT pracownik_id FROM adm)  AS admin_pracownik_id,
  (SELECT pracownik_id FROM opr)  AS operator_pracownik_id,
  (SELECT pracownik_id FROM kur1) AS kurier1_pracownik_id,
  (SELECT pracownik_id FROM kur2) AS kurier2_pracownik_id,

  (SELECT app_user_id FROM u_admin)    AS appuser_admin_id,
  (SELECT app_user_id FROM u_operator) AS appuser_operator_id,
  (SELECT app_user_id FROM u_kurier1)  AS appuser_kurier1_id,
  (SELECT app_user_id FROM u_kurier2)  AS appuser_kurier2_id;
