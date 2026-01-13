-- =====================================================
-- SCHEMA
-- =====================================================

DROP SCHEMA IF EXISTS parcel_locker CASCADE;
CREATE SCHEMA parcel_locker;
SET search_path TO parcel_locker;

-- =====================================================
-- AUTOMAT
-- =====================================================

CREATE TABLE Automat (
    automat_id       SERIAL PRIMARY KEY,
    nazwa            TEXT NOT NULL,
    adres            TEXT NOT NULL,
    wspolrzedne_gps  TEXT,
    status           TEXT NOT NULL
        CHECK (status IN ('AKTYWNY','W_SERWISIE','NIEAKTYWNY')),

    liczba_wierszy   INT NOT NULL CHECK (liczba_wierszy > 0),
    liczba_kolumn    INT NOT NULL CHECK (liczba_kolumn > 0),

    ekran_w_kolumnie INT NOT NULL
);

-- =====================================================
-- ROZMIAR / TYP SKRYTKI
-- =====================================================

CREATE TABLE Rozmiar (
    rozmiar_id      SERIAL PRIMARY KEY,
    kod             CHAR(1) UNIQUE NOT NULL
        CHECK (kod IN ('S','M','L')),

    szerokosc_cm    INT NOT NULL CHECK (szerokosc_cm > 0),
    wysokosc_cm     INT NOT NULL CHECK (wysokosc_cm > 0),
    glebokosc_cm    INT NOT NULL CHECK (glebokosc_cm > 0)
);

-- =====================================================
-- SKRYTKA / ELEMENT KOLUMNY
-- =====================================================

CREATE TABLE Skrytka (
    skrytka_id  SERIAL PRIMARY KEY,

    automat_id  INT NOT NULL
        REFERENCES Automat(automat_id)
        ON DELETE CASCADE,

    rozmiar_id  INT NOT NULL
        REFERENCES Rozmiar(rozmiar_id),

    wiersz      INT NOT NULL,
    kolumna     INT NOT NULL,

    status      TEXT NOT NULL
        CHECK (status IN ('WOLNA','ZAJETA','USZKODZONA')),

    UNIQUE (automat_id, wiersz, kolumna)
);

-- =====================================================
-- KLIENT
-- =====================================================

CREATE TABLE Klient (
    klient_id        SERIAL PRIMARY KEY,
    imie             TEXT NOT NULL,
    nazwisko         TEXT NOT NULL,

    email            TEXT UNIQUE NOT NULL,
    telefon          TEXT,

    data_utworzenia  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PRACOWNIK (ADMIN / KURIER / OPERATOR)
-- =====================================================

CREATE TABLE Pracownik (
    pracownik_id     SERIAL PRIMARY KEY,
    imie             TEXT NOT NULL,
    nazwisko         TEXT NOT NULL,

    email            TEXT UNIQUE NOT NULL,
    telefon          TEXT,

    rola             TEXT NOT NULL
        CHECK (rola IN ('ADMIN','KURIER','OPERATOR')),

    data_utworzenia  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- =====================================================
-- RELACJA N-M: KURIER <-> AUTOMAT (OBSŁUGA)
-- =====================================================
-- =====================================================
-- RELACJA N-M: KURIER <-> AUTOMAT (OBSŁUGA)
-- =====================================================

CREATE TABLE ObslugaAutomatu (
    kurier_id   INT NOT NULL
        REFERENCES Pracownik(pracownik_id)
        ON DELETE CASCADE,

    automat_id  INT NOT NULL
        REFERENCES Automat(automat_id)
        ON DELETE CASCADE,

    data_od     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_do     TIMESTAMP,

    PRIMARY KEY (kurier_id, automat_id),

    CHECK (data_do IS NULL OR data_do >= data_od)
);

-- =====================================================
-- PACZKA
-- =====================================================

CREATE TABLE Paczka (
    paczka_id       SERIAL PRIMARY KEY,
    numer_tracking  TEXT UNIQUE NOT NULL,

    szerokosc_cm    INT NOT NULL CHECK (szerokosc_cm > 0),
    wysokosc_cm     INT NOT NULL CHECK (wysokosc_cm > 0),
    glebokosc_cm    INT NOT NULL CHECK (glebokosc_cm > 0),

    nadawca_id      INT NOT NULL
        REFERENCES Klient(klient_id),

    odbiorca_id     INT NOT NULL
        REFERENCES Klient(klient_id),

    skrytka_id      INT
        REFERENCES Skrytka(skrytka_id)
        ON DELETE SET NULL,

    status          TEXT NOT NULL DEFAULT 'DO_ZATWIERDZENIA'
        CHECK (status IN ('DO_ZATWIERDZENIA','NADANA','W_DRODZE','W_AUTOMACIE','ODEBRANA','PRZETERMINOWANA','ANULOWANA')),

    data_nadania    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    termin_odbioru  TIMESTAMP,
    data_odbioru    TIMESTAMP,

    CHECK (data_odbioru IS NULL OR data_odbioru >= data_nadania),
    CHECK (termin_odbioru IS NULL OR termin_odbioru >= data_nadania)
);

-- =====================================================
-- PRZEDŁUŻENIE TERMINU ODBIORU PACZKI
-- =====================================================

CREATE TABLE Przedluzenie (
    przedluzenie_id   SERIAL PRIMARY KEY,

    paczka_id         INT NOT NULL
        REFERENCES Paczka(paczka_id)
        ON DELETE CASCADE,

    klient_id         INT NOT NULL
        REFERENCES Klient(klient_id),

    ile_godzin        INT NOT NULL CHECK (ile_godzin > 0),
    data_przedluzenia TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- ZDARZENIA / HISTORIA PACZKI
-- =====================================================

CREATE TABLE ZdarzeniePaczki (
    zdarzenie_id  SERIAL PRIMARY KEY,
    paczka_id     INT NOT NULL
        REFERENCES Paczka(paczka_id)
        ON DELETE CASCADE,
        
    typ           TEXT NOT NULL 
        CHECK (typ IN ('UTWORZONA','W_AUTOMACIE','PRZEDLUZONA','ODEBRANA','ANULOWANA','PRZETERMINOWANA')),

    czas          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    opis          TEXT
);


-- =====================================================
-- APP USER (LOGOWANIE DO APLIKACJI)
-- =====================================================

CREATE TABLE AppUser (
    app_user_id     SERIAL PRIMARY KEY,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,

    rola            TEXT NOT NULL
        CHECK (rola IN ('ADMIN','KURIER','KLIENT','OPERATOR')),

    klient_id       INT
        REFERENCES Klient(klient_id)
        ON DELETE CASCADE,

    pracownik_id    INT
        REFERENCES Pracownik(pracownik_id)
        ON DELETE CASCADE,


    must_change_password BOOLEAN 
        NOT NULL DEFAULT TRUE,

    CHECK (
        (rola = 'KLIENT' AND klient_id IS NOT NULL AND pracownik_id IS NULL) OR
        (rola IN ('ADMIN','KURIER','OPERATOR') AND pracownik_id IS NOT NULL AND klient_id IS NULL)
    )
);
SET search_path TO parcel_locker;

-- =====================================================
-- FUNKCJA: USUWANIE CAŁEGO SCHEMATU
-- =====================================================

CREATE OR REPLACE FUNCTION public.drop_parcel_locker_schema()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE 'DROP SCHEMA IF EXISTS parcel_locker CASCADE';
END;
$$;


-- =====================================================
-- FUNKCJA: WYODRĘBNIENIE MIASTA Z ADRESU
-- =====================================================

CREATE OR REPLACE FUNCTION parcel_locker.extract_city_from_address(adres TEXT)
RETURNS TEXT    
LANGUAGE sql
AS $$
    SELECT regexp_replace(
        adres,
        '.*,\s*\d{2}-\d{3}\s+',
        ''
    )
$$;

CREATE OR REPLACE FUNCTION parcel_locker.get_all_cities_with_automat()
RETURNS TABLE (miasto text)
LANGUAGE sql
AS $$
  SELECT DISTINCT parcel_locker.extract_city_from_address(adres) AS miasto
  FROM parcel_locker.Automat
  ORDER BY miasto
$$;

-- =====================================================
-- TRIGGER: CZY PACZKA MIEŚCI SIĘ W SKRYTCE
-- =====================================================

CREATE OR REPLACE FUNCTION parcel_locker.check_if_package_fits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    s_w INT;
    s_h INT;
    s_d INT;
BEGIN
    SELECT r.szerokosc_cm, r.wysokosc_cm, r.glebokosc_cm
    INTO s_w, s_h, s_d
    FROM Skrytka s
    JOIN Rozmiar r ON r.rozmiar_id = s.rozmiar_id
    WHERE s.skrytka_id = NEW.skrytka_id
      AND s.status = 'WOLNA';

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Skrytka nie istnieje lub nie jest wolna';
    END IF;

    IF NEW.szerokosc_cm > s_w
       OR NEW.wysokosc_cm  > s_h
       OR NEW.glebokosc_cm > s_d THEN
        RAISE EXCEPTION
            'Paczka nie mieści się w skrytce';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_package_fits
BEFORE INSERT OR UPDATE OF skrytka_id, szerokosc_cm, wysokosc_cm, glebokosc_cm
ON Paczka
FOR EACH ROW
WHEN (NEW.skrytka_id IS NOT NULL)
EXECUTE FUNCTION parcel_locker.check_if_package_fits();

-- =====================================================
-- TRIGGER: ZAKAZ NACHODZENIA SKRYTEK
-- =====================================================

CREATE OR REPLACE FUNCTION parcel_locker.set_ekran_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.liczba_kolumn % 2 = 1 THEN
        NEW.ekran_w_kolumnie := (NEW.liczba_kolumn + 1) / 2;
    ELSE
        NEW.ekran_w_kolumnie := (NEW.liczba_kolumn / 2) + 1;
    END IF;

    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_set_ekran_column
BEFORE INSERT ON Automat
FOR EACH ROW
EXECUTE FUNCTION parcel_locker.set_ekran_column();



CREATE OR REPLACE FUNCTION parcel_locker.generate_automat_layout(
    p_automat_id INT
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    rows INT;
    cols INT;

    middle_rows INT;
    m_per_col INT;
    s_per_col INT;

    col INT;
    row INT;

    col_screen INT;

    rS INT;
    rM INT;
    rL INT;
BEGIN
    --------------------------------------------------
    -- 1. POBIERZ WYMIARY AUTOMATU
    --------------------------------------------------
    SELECT liczba_wierszy, liczba_kolumn
    INTO rows, cols
    FROM Automat
    WHERE automat_id = p_automat_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Automat % nie istnieje', p_automat_id;
    END IF;

    --------------------------------------------------
    -- 2. WALIDACJA KONSTRUKCYJNA
    --------------------------------------------------
    middle_rows := rows - 2;

    IF middle_rows <= 0 OR middle_rows % 2 != 0 THEN
        RAISE EXCEPTION
            'Nieprawidłowa liczba wierszy (%). (wiersze - 2) musi być parzyste',
            rows;
    END IF;

    m_per_col := middle_rows / 2;
    s_per_col := middle_rows;

    --------------------------------------------------
    -- 3. ROZMIARY
    --------------------------------------------------
    SELECT rozmiar_id INTO rS FROM Rozmiar WHERE kod = 'S';
    SELECT rozmiar_id INTO rM FROM Rozmiar WHERE kod = 'M';
    SELECT rozmiar_id INTO rL FROM Rozmiar WHERE kod = 'L';

    IF rS IS NULL OR rM IS NULL OR rL IS NULL THEN
        RAISE EXCEPTION 'Brakuje rozmiarów S/M/L w tabeli Rozmiar';
    END IF;

    --------------------------------------------------
    -- 4. KOLUMNA Z EKRANEM
    --------------------------------------------------
    IF cols % 2 = 1 THEN
        col_screen := (cols + 1) / 2;
    ELSE
        col_screen := cols - 1;
    END IF;

    --------------------------------------------------
    -- 5. CZYŚCIMY STARE SKRYTKI
    --------------------------------------------------
    DELETE FROM Skrytka
    WHERE automat_id = p_automat_id;

    --------------------------------------------------
    -- 6. GENEROWANIE KOLUMN
    --------------------------------------------------
    FOR col IN 1..cols LOOP

        -- ======================
        -- GÓRA (L)
        -- ======================
        INSERT INTO Skrytka
        (automat_id, rozmiar_id, wiersz, kolumna, status)
        VALUES
        (p_automat_id, rL, 1, col, 'WOLNA');

        -- ======================
        -- ŚRODEK
        -- ======================
        IF col = col_screen THEN
            -- ekran → nic nie wstawiamy
            NULL;

        ELSIF col = 1 OR col = cols THEN
            -- BOCZNE KOLUMNY → M
            row := 2;
            FOR i IN 1..m_per_col LOOP
                INSERT INTO Skrytka
                (automat_id, rozmiar_id, wiersz, kolumna, status)
                VALUES
                (p_automat_id, rM, row, col, 'WOLNA');

                row := row + 2;
            END LOOP;

        ELSE
            -- ŚRODEK → S
            row := 2;
            FOR i IN 1..s_per_col LOOP
                INSERT INTO Skrytka
                (automat_id, rozmiar_id, wiersz, kolumna, status)
                VALUES
                (p_automat_id, rS, row, col, 'WOLNA');

                row := row + 1;
            END LOOP;
        END IF;

        -- ======================
        -- DÓŁ (L)
        -- ======================
        INSERT INTO Skrytka
        (automat_id, rozmiar_id, wiersz, kolumna, status)
        VALUES
        (p_automat_id, rL, rows, col, 'WOLNA');

    END LOOP;

    --------------------------------------------------
    -- 7. SUKCES
    --------------------------------------------------
    RETURN
        'Automat ' || p_automat_id ||
        ' wygenerowany: L góra/dół, M boki, S środek, ekran w kolumnie ' ||
        col_screen;
END;
$$;




CREATE OR REPLACE FUNCTION parcel_locker.trg_generate_layout_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM parcel_locker.generate_automat_layout(NEW.automat_id);
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_generate_automat_layout
AFTER INSERT ON Automat
FOR EACH ROW
EXECUTE FUNCTION parcel_locker.trg_generate_layout_fn();


-- =====================================================
-- Funkcja: jakie kolumny moze insetorwać klient
-- =====================================================

CREATE OR REPLACE FUNCTION parcel_locker.enforce_client_package_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user = 'parcel_klient' THEN
    IF NEW.skrytka_id IS NOT NULL THEN
      RAISE EXCEPTION 'Klient nie może ustawiać skrytka_id';
    END IF;

    IF NEW.status IS NOT NULL AND NEW.status NOT IN ('DO_ZATWIERDZENIA', 'NADANA') THEN
      RAISE EXCEPTION 'Klient nie może ustawiać statusu %', NEW.status;
    END IF;

    IF NEW.termin_odbioru IS NOT NULL OR NEW.data_odbioru IS NOT NULL THEN
      RAISE EXCEPTION 'Klient nie może ustawiać termin_odbioru/data_odbioru';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- =====================================================
-- Trigger: enforce_client_package_rules
-- =====================================================

DROP TRIGGER IF EXISTS trg_enforce_client_package_rules ON parcel_locker.Paczka;

CREATE TRIGGER trg_enforce_client_package_rules
BEFORE INSERT OR UPDATE ON parcel_locker.Paczka
FOR EACH ROW
EXECUTE FUNCTION parcel_locker.enforce_client_package_rules();
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


SET search_path TO parcel_locker;

WITH
odb AS (
  SELECT klient_id
  FROM Klient
  WHERE email = 'klient@test.pl'
  LIMIT 1
),
nad1 AS (
  INSERT INTO Klient (imie, nazwisko, email, telefon)
  VALUES ('Sklep', 'Internetowy', 'sklep@test.pl', '111111111')
  ON CONFLICT (email) DO UPDATE SET imie = EXCLUDED.imie
  RETURNING klient_id
),
nad2 AS (
  INSERT INTO Klient (imie, nazwisko, email, telefon)
  VALUES ('Alicja', 'Nadawca', 'nadawca2@test.pl', '222222222')
  ON CONFLICT (email) DO UPDATE SET imie = EXCLUDED.imie
  RETURNING klient_id
),

sk_m1 AS (
  SELECT s.skrytka_id
  FROM Skrytka s
  JOIN Rozmiar r ON r.rozmiar_id = s.rozmiar_id
  JOIN Automat a ON a.automat_id = s.automat_id
  WHERE a.nazwa = 'KRA-001' AND r.kod = 'M' AND s.status = 'WOLNA'
  ORDER BY s.skrytka_id
  LIMIT 1
),
sk_s1 AS (
  SELECT s.skrytka_id
  FROM Skrytka s
  JOIN Rozmiar r ON r.rozmiar_id = s.rozmiar_id
  JOIN Automat a ON a.automat_id = s.automat_id
  WHERE a.nazwa = 'WAR-001' AND r.kod = 'S' AND s.status = 'WOLNA'
  ORDER BY s.skrytka_id
  LIMIT 1
),

p1 AS (
  INSERT INTO Paczka (
    numer_tracking,
    szerokosc_cm, wysokosc_cm, glebokosc_cm,
    nadawca_id, odbiorca_id,
    skrytka_id,
    status,
    data_nadania, termin_odbioru, data_odbioru
  )
  VALUES (
    'TRK-0001',
    30, 15, 20,
    (SELECT klient_id FROM nad1),
    (SELECT klient_id FROM odb),
    (SELECT skrytka_id FROM sk_m1),
    'W_AUTOMACIE',
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    CURRENT_TIMESTAMP + INTERVAL '2 days',
    NULL
  )
  RETURNING paczka_id, skrytka_id
),
lock_p1 AS (
  UPDATE Skrytka
  SET status = 'ZAJETA'
  WHERE skrytka_id = (SELECT skrytka_id FROM p1)
  RETURNING skrytka_id
),
ev_p1 AS (
  INSERT INTO ZdarzeniePaczki (paczka_id, typ, opis)
  VALUES
    ((SELECT paczka_id FROM p1), 'UTWORZONA', 'Paczka utworzona w systemie'),
    ((SELECT paczka_id FROM p1), 'W_AUTOMACIE', 'Paczka umieszczona w automacie')
  RETURNING zdarzenie_id
),

p2 AS (
  INSERT INTO Paczka (
    numer_tracking,
    szerokosc_cm, wysokosc_cm, glebokosc_cm,
    nadawca_id, odbiorca_id,
    skrytka_id,
    status,
    data_nadania, termin_odbioru, data_odbioru
  )
  VALUES (
    'TRK-0002',
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
  INSERT INTO ZdarzeniePaczki (paczka_id, typ, opis)
  VALUES
    ((SELECT paczka_id FROM p2), 'UTWORZONA', 'Paczka utworzona w systemie')
  RETURNING zdarzenie_id
),

p3 AS (
  INSERT INTO Paczka (
    numer_tracking,
    szerokosc_cm, wysokosc_cm, glebokosc_cm,
    nadawca_id, odbiorca_id,
    skrytka_id,
    status,
    data_nadania, termin_odbioru, data_odbioru
  )
  VALUES (
    'TRK-0003',
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
  INSERT INTO ZdarzeniePaczki (paczka_id, typ, opis)
  VALUES
    ((SELECT paczka_id FROM p3), 'UTWORZONA', 'Paczka utworzona w systemie'),
    ((SELECT paczka_id FROM p3), 'ODEBRANA', 'Paczka odebrana przez klienta')
  RETURNING zdarzenie_id
),

p4 AS (
  INSERT INTO Paczka (
    numer_tracking,
    szerokosc_cm, wysokosc_cm, glebokosc_cm,
    nadawca_id, odbiorca_id,
    skrytka_id,
    status,
    data_nadania, termin_odbioru, data_odbioru
  )
  VALUES (
    'TRK-0004',
    19, 8, 28,
    (SELECT klient_id FROM nad2),
    (SELECT klient_id FROM odb),
    (SELECT skrytka_id FROM sk_s1),
    'PRZETERMINOWANA',
    CURRENT_TIMESTAMP - INTERVAL '10 days',
    CURRENT_TIMESTAMP - INTERVAL '6 days',
    NULL
  )
  RETURNING paczka_id, skrytka_id
),
lock_p4 AS (
  UPDATE Skrytka
  SET status = 'ZAJETA'
  WHERE skrytka_id = (SELECT skrytka_id FROM p4)
  RETURNING skrytka_id
),
ev_p4 AS (
  INSERT INTO ZdarzeniePaczki (paczka_id, typ, opis)
  VALUES
    ((SELECT paczka_id FROM p4), 'UTWORZONA', 'Paczka utworzona w systemie'),
    ((SELECT paczka_id FROM p4), 'PRZETERMINOWANA', 'Minął termin odbioru')
  RETURNING zdarzenie_id
)

SELECT
  (SELECT paczka_id FROM p1) AS paczka_w_automacie,
  (SELECT paczka_id FROM p2) AS paczka_w_drodze,
  (SELECT paczka_id FROM p3) AS paczka_odebrana,
  (SELECT paczka_id FROM p4) AS paczka_przeterminowana;
set search_path to parcel_locker;
-- =====================================================
-- ROLES / PERMISSIONS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parcel_admin') THEN
    CREATE ROLE parcel_admin LOGIN PASSWORD 'ParcelAdmin2026!';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parcel_operator') THEN
    CREATE ROLE parcel_operator LOGIN PASSWORD 'ParcelOperator2026!';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parcel_kurier') THEN
    CREATE ROLE parcel_kurier LOGIN PASSWORD 'ParcelKurier2026!';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parcel_klient') THEN
    CREATE ROLE parcel_klient LOGIN PASSWORD 'ParcelKlient2026!';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parcel_report') THEN
    CREATE ROLE parcel_report LOGIN PASSWORD 'ParcelReport2026!';
  END IF;
END
$$;

-- schema access
GRANT USAGE ON SCHEMA parcel_locker TO parcel_operator, parcel_kurier, parcel_klient, parcel_report;
GRANT USAGE, CREATE ON SCHEMA parcel_locker TO parcel_admin;

-- admin: full
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA parcel_locker TO parcel_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA parcel_locker TO parcel_admin;

-- operator: zarządzanie strukturą operacyjną + podgląd/edycja paczek
GRANT SELECT, INSERT, UPDATE ON parcel_locker.Automat         TO parcel_operator;
GRANT SELECT, INSERT, UPDATE ON parcel_locker.Skrytka         TO parcel_operator;
GRANT SELECT, INSERT, UPDATE ON parcel_locker.Rozmiar         TO parcel_operator;

GRANT SELECT, INSERT, UPDATE ON parcel_locker.Pracownik       TO parcel_operator;
GRANT SELECT, INSERT, UPDATE ON parcel_locker.ObslugaAutomatu TO parcel_operator;

GRANT SELECT, INSERT, UPDATE ON parcel_locker.Klient          TO parcel_operator;
GRANT SELECT, INSERT, UPDATE ON parcel_locker.Paczka          TO parcel_operator;
GRANT SELECT, INSERT, UPDATE ON parcel_locker.Przedluzenie    TO parcel_operator;
GRANT SELECT, INSERT, UPDATE ON parcel_locker.ZdarzeniePaczki TO parcel_operator;

-- kurier: podgląd automatów/skrytek/rozmiarów + obsługa paczek + własne przypisania
GRANT SELECT ON parcel_locker.Automat, parcel_locker.Skrytka, parcel_locker.Rozmiar TO parcel_kurier;
GRANT SELECT ON parcel_locker.Klient TO parcel_kurier;

GRANT SELECT, INSERT, UPDATE ON parcel_locker.Paczka          TO parcel_kurier;
GRANT SELECT, INSERT         ON parcel_locker.ZdarzeniePaczki TO parcel_kurier;

GRANT SELECT ON parcel_locker.ObslugaAutomatu TO parcel_kurier;

-- klient: podgląd swoich danych i operacje związane z paczkami (przegląd, przedłużenie, tworzenie)
-- docelowo "tylko swoje" robi się przez RLS, ale do projektu wystarczy warstwa uprawnień + endpointy.
GRANT SELECT, UPDATE ON parcel_locker.Klient       TO parcel_klient;
GRANT SELECT        ON parcel_locker.Paczka        TO parcel_klient;
GRANT SELECT, INSERT ON parcel_locker.Przedluzenie TO parcel_klient;
GRANT SELECT        ON parcel_locker.ZdarzeniePaczki TO parcel_klient;

GRANT INSERT (numer_tracking, szerokosc_cm, wysokosc_cm, glebokosc_cm, nadawca_id, odbiorca_id)
ON parcel_locker.Paczka
TO parcel_klient;

GRANT INSERT ON parcel_locker.ZdarzeniePaczki TO parcel_klient;

-- report: read-only na wszystko (albo tylko na widoki, jeśli wolisz)
GRANT SELECT ON ALL TABLES IN SCHEMA parcel_locker TO parcel_report;

-- sequences: dla ról robiących INSERT do tabel z SERIAL
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA parcel_locker TO parcel_operator, parcel_kurier, parcel_klient;

-- default privileges (dla nowych tabel w przyszłości)
ALTER DEFAULT PRIVILEGES IN SCHEMA parcel_locker
GRANT SELECT, INSERT, UPDATE ON TABLES TO parcel_operator;

ALTER DEFAULT PRIVILEGES IN SCHEMA parcel_locker
GRANT SELECT, INSERT, UPDATE ON TABLES TO parcel_kurier;

ALTER DEFAULT PRIVILEGES IN SCHEMA parcel_locker
GRANT SELECT ON TABLES TO parcel_report;

ALTER DEFAULT PRIVILEGES IN SCHEMA parcel_locker
GRANT SELECT, INSERT ON TABLES TO parcel_klient;

-- znajdz wszystkie automaty w danym mieście
-- wykorzystuje funkcję extract_city_from_address do wyodrębnienia miasta z adresu
-- sa pomoca SELECT AS 
SET search_path TO parcel_locker;
SELECT * FROM Automat
WHERE parcel_locker.extract_city_from_address(adres) = 'Kraków';
set search_path to parcel_locker;
-- VIEW z automatami + miasto
CREATE OR REPLACE VIEW automaty_in_city AS
SELECT
    automat_id,
    nazwa,
    adres,
    wspolrzedne_gps,
    status,
    extract_city_from_address(adres) AS miasto
FROM Automat;



-- VIEW do renderowania automatu (frontend)
CREATE OR REPLACE VIEW automat_view AS
SELECT
    a.automat_id,
    a.liczba_wierszy,
    a.liczba_kolumn,

    s.skrytka_id,
    s.wiersz,
    s.kolumna,
    s.status,

    r.kod           AS rozmiar,
    r.szerokosc_cm,
    r.wysokosc_cm,
    r.glebokosc_cm

FROM Automat a
LEFT JOIN Skrytka s
       ON s.automat_id = a.automat_id
LEFT JOIN Rozmiar r
       ON r.rozmiar_id = s.rozmiar_id
ORDER BY
    a.automat_id,
    s.wiersz,
    s.kolumna;
