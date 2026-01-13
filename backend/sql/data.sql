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
    '$2b$10$ocoiqSyYkWyvqXoT6JGfteR31TWogFXqqJfVW4Jy.7JJOwXxVtz9i',
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
    '$2b$10$wd3YAAcbeF7gjGQrQaX/vuOieuZp8aJyjFR.Jmu.c1GU5bWzP939C',
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
    '$2b$10$OUou6IxryJnFGJGvbftOz.1hWLv7gmMtqS6PqTpmTQGP1Nia.uSvy',
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
    '$2b$10$0WTKoeHSi2rTv.7hZ6zzlOMv6UXpDjuOAf6bHbMNPyz9m7mzTKkS6',
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



-- paczka 


WITH
odb AS (
  SELECT klient_id
  FROM parcel_locker.Klient
  WHERE email = 'klient@test.pl'
  LIMIT 1
),
nad1 AS (
  INSERT INTO parcel_locker.Klient (imie, nazwisko, email, telefon)
  VALUES ('Sklep', 'Internetowy', 'sklep@test.pl', '111111111')
  ON CONFLICT (email) DO UPDATE SET imie = EXCLUDED.imie
  RETURNING klient_id
),
nad2 AS (
  INSERT INTO parcel_locker.Klient (imie, nazwisko, email, telefon)
  VALUES ('Alicja', 'Nadawca', 'nadawca2@test.pl', '222222222')
  ON CONFLICT (email) DO UPDATE SET imie = EXCLUDED.imie
  RETURNING klient_id
),

a_krk AS (
  SELECT automat_id, nazwa
  FROM parcel_locker.Automat
  WHERE nazwa = 'KRA-001'
  LIMIT 1
),
a_war AS (
  SELECT automat_id, nazwa
  FROM parcel_locker.Automat
  WHERE nazwa = 'WAR-001'
  LIMIT 1
),

sk_krk_m AS (
  SELECT s.skrytka_id
  FROM parcel_locker.Skrytka s
  JOIN parcel_locker.Rozmiar r ON r.rozmiar_id = s.rozmiar_id
  JOIN a_krk a ON a.automat_id = s.automat_id
  WHERE r.kod = 'M' AND s.status = 'WOLNA'
  ORDER BY s.skrytka_id
  LIMIT 1
),
sk_war_s AS (
  SELECT s.skrytka_id
  FROM parcel_locker.Skrytka s
  JOIN parcel_locker.Rozmiar r ON r.rozmiar_id = s.rozmiar_id
  JOIN a_war a ON a.automat_id = s.automat_id
  WHERE r.kod = 'S' AND s.status = 'WOLNA'
  ORDER BY s.skrytka_id
  LIMIT 1
),
sk_war_m AS (
  SELECT s.skrytka_id
  FROM parcel_locker.Skrytka s
  JOIN parcel_locker.Rozmiar r ON r.rozmiar_id = s.rozmiar_id
  JOIN a_war a ON a.automat_id = s.automat_id
  WHERE r.kod = 'M' AND s.status = 'WOLNA'
  ORDER BY s.skrytka_id
  LIMIT 1
),

p1 AS (
  INSERT INTO parcel_locker.Paczka (
    numer_tracking,
    szerokosc_cm, wysokosc_cm, glebokosc_cm,
    nadawca_id, odbiorca_id,
    skrytka_id,
    status,
    data_nadania, termin_odbioru, data_odbioru
  )
  VALUES (
    'TRK-SEED-0001',
    30, 15, 20,
    (SELECT klient_id FROM nad1),
    (SELECT klient_id FROM odb),
    (SELECT skrytka_id FROM sk_krk_m),
    'W_AUTOMACIE',
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    CURRENT_TIMESTAMP + INTERVAL '2 days',
    NULL
  )
  RETURNING paczka_id, skrytka_id
),
lock_p1 AS (
  UPDATE parcel_locker.Skrytka
  SET status = 'ZAJETA'
  WHERE skrytka_id = (SELECT skrytka_id FROM p1)
  RETURNING skrytka_id
),
ev_p1 AS (
  INSERT INTO parcel_locker.ZdarzeniePaczki (paczka_id, typ, opis)
  VALUES
    ((SELECT paczka_id FROM p1), 'UTWORZONA', 'Paczka utworzona w systemie'),
    ((SELECT paczka_id FROM p1), 'W_AUTOMACIE', 'Paczka umieszczona w automacie KRA-001')
  RETURNING zdarzenie_id
),

p2 AS (
  INSERT INTO parcel_locker.Paczka (
    numer_tracking,
    szerokosc_cm, wysokosc_cm, glebokosc_cm,
    nadawca_id, odbiorca_id,
    skrytka_id,
    status,
    data_nadania, termin_odbioru, data_odbioru
  )
  VALUES (
    'TRK-SEED-0002',
    10, 5, 15,
    (SELECT klient_id FROM nad2),
    (SELECT klient_id FROM odb),
    NULL,
    'W_DRODZE',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    NULL,
    NULL
  )
  RETURNING paczka_id
),
ev_p2 AS (
  INSERT INTO parcel_locker.ZdarzeniePaczki (paczka_id, typ, opis)
  VALUES
    ((SELECT paczka_id FROM p2), 'UTWORZONA', 'Paczka utworzona w systemie'),
    ((SELECT paczka_id FROM p2), 'WYJETA_Z_AUTOMATU', 'Podjęta przez kuriera z automatu KRA-001'),
    ((SELECT paczka_id FROM p2), 'W_DRODZE', 'Paczka w transporcie do WAR-001')
  RETURNING zdarzenie_id
),

p3 AS (
  INSERT INTO parcel_locker.Paczka (
    numer_tracking,
    szerokosc_cm, wysokosc_cm, glebokosc_cm,
    nadawca_id, odbiorca_id,
    skrytka_id,
    status,
    data_nadania, termin_odbioru, data_odbioru
  )
  VALUES (
    'TRK-SEED-0003',
    18, 7, 25,
    (SELECT klient_id FROM nad1),
    (SELECT klient_id FROM odb),
    NULL,
    'ODEBRANA',
    CURRENT_TIMESTAMP - INTERVAL '7 days',
    CURRENT_TIMESTAMP - INTERVAL '4 days',
    CURRENT_TIMESTAMP - INTERVAL '3 days'
  )
  RETURNING paczka_id
),
ev_p3 AS (
  INSERT INTO parcel_locker.ZdarzeniePaczki (paczka_id, typ, opis)
  VALUES
    ((SELECT paczka_id FROM p3), 'UTWORZONA', 'Paczka utworzona w systemie'),
    ((SELECT paczka_id FROM p3), 'ODEBRANA', 'Paczka odebrana przez klienta')
  RETURNING zdarzenie_id
),

p4 AS (
  INSERT INTO parcel_locker.Paczka (
    numer_tracking,
    szerokosc_cm, wysokosc_cm, glebokosc_cm,
    nadawca_id, odbiorca_id,
    skrytka_id,
    status,
    data_nadania, termin_odbioru, data_odbioru
  )
  VALUES (
    'TRK-SEED-0004',
    19, 8, 28,
    (SELECT klient_id FROM nad2),
    (SELECT klient_id FROM odb),
    (SELECT skrytka_id FROM sk_war_s),
    'PRZETERMINOWANA',
    CURRENT_TIMESTAMP - INTERVAL '10 days',
    CURRENT_TIMESTAMP - INTERVAL '6 days',
    NULL
  )
  RETURNING paczka_id, skrytka_id
),
lock_p4 AS (
  UPDATE parcel_locker.Skrytka
  SET status = 'ZAJETA'
  WHERE skrytka_id = (SELECT skrytka_id FROM p4)
  RETURNING skrytka_id
),
ev_p4 AS (
  INSERT INTO parcel_locker.ZdarzeniePaczki (paczka_id, typ, opis)
  VALUES
    ((SELECT paczka_id FROM p4), 'UTWORZONA', 'Paczka utworzona w systemie'),
    ((SELECT paczka_id FROM p4), 'W_AUTOMACIE', 'Paczka umieszczona w automacie WAR-001'),
    ((SELECT paczka_id FROM p4), 'PRZETERMINOWANA', 'Minął termin odbioru')
  RETURNING zdarzenie_id
),

p5 AS (
  INSERT INTO parcel_locker.Paczka (
    numer_tracking,
    szerokosc_cm, wysokosc_cm, glebokosc_cm,
    nadawca_id, odbiorca_id,
    skrytka_id,
    status,
    data_nadania, termin_odbioru, data_odbioru
  )
  VALUES (
    'TRK-SEED-0005',
    35, 18, 30,
    (SELECT klient_id FROM odb),
    (SELECT klient_id FROM nad1),
    NULL,
    'NADANA',
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    NULL,
    NULL
  )
  RETURNING paczka_id
),
ev_p5 AS (
  INSERT INTO parcel_locker.ZdarzeniePaczki (paczka_id, typ, opis)
  VALUES
    ((SELECT paczka_id FROM p5), 'UTWORZONA', 'Paczka utworzona przez klienta (do zatwierdzenia)')
  RETURNING zdarzenie_id
)

SELECT
  (SELECT paczka_id FROM p1) AS paczka_w_automacie,
  (SELECT paczka_id FROM p2) AS paczka_w_drodze,
  (SELECT paczka_id FROM p3) AS paczka_odebrana,
  (SELECT paczka_id FROM p4) AS paczka_przeterminowana,
  (SELECT paczka_id FROM p5) AS paczka_nadana_do_zatwierdzenia;
