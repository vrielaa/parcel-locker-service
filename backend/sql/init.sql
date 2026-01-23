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

    docelowy_automat_id INT NOT NULL
        REFERENCES Automat(automat_id),

    skrytka_id      INT
        REFERENCES Skrytka(skrytka_id)
        ON DELETE SET NULL,

    kurier_id       INT
        REFERENCES Pracownik(pracownik_id)
        ON DELETE SET NULL,

    status          TEXT NOT NULL DEFAULT 'CZEKA_NA_ZATWIERDZENIE'
        CHECK (status IN ('CZEKA_NA_ZATWIERDZENIE','NADANA','W_DRODZE','W_AUTOMACIE','ODEBRANA','PRZETERMINOWANA','ANULOWANA')),

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
        CHECK (typ IN (  'UTWORZONA', 'NADANA','WYJETA_Z_AUTOMATU','W_DRODZE','W_AUTOMACIE','PRZEDLUZONA','ODEBRANA','ANULOWANA','PRZETERMINOWANA')),

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
  SELECT NULLIF(btrim(
    CASE
      WHEN adres ~ ',\s*[^,]+$' THEN regexp_replace(adres, '.*,\s*', '')
      ELSE NULL
    END
  ), '')
$$;


CREATE OR REPLACE FUNCTION parcel_locker.get_all_cities_with_automat()
RETURNS TABLE (miasto text)
LANGUAGE sql
AS $$
  SELECT DISTINCT parcel_locker.extract_city_from_address(adres) AS miasto
  FROM parcel_locker.Automat
  WHERE parcel_locker.extract_city_from_address(adres) IS NOT NULL
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
  FROM parcel_locker.skrytka s
  JOIN parcel_locker.rozmiar r ON r.rozmiar_id = s.rozmiar_id
  WHERE s.skrytka_id = NEW.skrytka_id
    AND s.status = 'WOLNA';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skrytka nie istnieje lub nie jest wolna';
  END IF;

  IF NEW.szerokosc_cm > s_w
     OR NEW.wysokosc_cm > s_h
     OR NEW.glebokosc_cm > s_d THEN
    RAISE EXCEPTION 'Paczka nie mieści się w skrytce';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_package_fits ON parcel_locker.paczka;

CREATE TRIGGER trg_check_package_fits
BEFORE INSERT OR UPDATE OF skrytka_id, szerokosc_cm, wysokosc_cm, glebokosc_cm
ON parcel_locker.paczka
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
            NULL;

        ELSIF col = 1 OR col = cols THEN
            row := 2;
            FOR i IN 1..m_per_col LOOP
                INSERT INTO Skrytka
                (automat_id, rozmiar_id, wiersz, kolumna, status)
                VALUES
                (p_automat_id, rM, row, col, 'WOLNA');

                row := row + 2;
            END LOOP;

        ELSE
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

    IF NEW.kurier_id IS NOT NULL THEN
      RAISE EXCEPTION 'Klient nie może ustawiać kurier_id';
    END IF;

    IF NEW.status IS NOT NULL AND NEW.status NOT IN ('CZEKA_NA_ZATWIERDZENIE', 'NADANA') THEN
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


-- =====================================================
-- Trigger: zamykanie obsługi automatu po zakończeniu dostawy
-- =====================================================

CREATE OR REPLACE FUNCTION parcel_locker.trg_close_oa_when_done()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.kurier_id IS NOT NULL
     AND NEW.docelowy_automat_id IS NOT NULL
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status IN ('ODEBRANA', 'PRZETERMINOWANA', 'ANULOWANA')
  THEN
    UPDATE parcel_locker.obslugaautomatu oa
    SET data_do = CURRENT_TIMESTAMP
    WHERE oa.kurier_id = NEW.kurier_id
      AND oa.automat_id = NEW.docelowy_automat_id
      AND oa.data_do IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM parcel_locker.paczka p
        WHERE p.kurier_id = NEW.kurier_id
          AND p.docelowy_automat_id = NEW.docelowy_automat_id
          AND p.status IN ('W_DRODZE', 'W_AUTOMACIE')
      );
  END IF;

  RETURN NEW;
END;
$$;
    
--====================================================
-- Trigger: trg_close_oa_when_done
-- =====================================================

DROP TRIGGER IF EXISTS trg_close_oa_when_done ON parcel_locker.paczka;

CREATE TRIGGER trg_close_oa_when_done
AFTER UPDATE OF status ON parcel_locker.paczka
FOR EACH ROW
EXECUTE FUNCTION parcel_locker.trg_close_oa_when_done();


-- =====================================================
-- Trigger: zapobieganie usunięciu ostatniego admina
-- =====================================================



CREATE OR REPLACE FUNCTION parcel_locker.trg_prevent_last_admin_delete_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF UPPER(COALESCE(OLD.rola, '')) = 'ADMIN' THEN
    IF (SELECT COUNT(*) FROM parcel_locker.appuser WHERE UPPER(rola) = 'ADMIN') <= 1 THEN
      RAISE EXCEPTION 'Nie można usunąć ostatniego admina.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_admin_delete ON parcel_locker.appuser;

CREATE TRIGGER trg_prevent_last_admin_delete
BEFORE DELETE ON parcel_locker.appuser
FOR EACH ROW
EXECUTE FUNCTION parcel_locker.trg_prevent_last_admin_delete_fn();
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
('BYD01A', 'Przy markecie Czerwona Torebka, Bydgoszcz', '53.1131863,17.9843245', 'AKTYWNY', 4, 13),
('BYD01N', 'Stacja paliw BP, Bydgoszcz', '53.1199864,18.0510992', 'AKTYWNY', 6, 5),
('BYD22A', 'Przy markecie POLOmarket, Bydgoszcz', '53.1521491,18.1218058', 'AKTYWNY', 12, 9),
('BYD14A', 'Przy markecie Netto, Bydgoszcz', '53.1173477,17.9568115', 'AKTYWNY', 14, 11),
('BYD19A', 'Przy biurowcu Foton, Bydgoszcz', '53.1178445,17.9804186', 'AKTYWNY', 4, 8),
('BYD37N', 'Przy wjeździe na parking sklepu Aldi, Bydgoszcz', '53.1258922,18.0456242', 'AKTYWNY', 8, 6),
('BYD31M', 'Na parkingu LIDL, Bydgoszcz', '53.1189971,17.9794699', 'AKTYWNY', 14, 9),
('BYD04N', 'Przy markecie Biedronka, Bydgoszcz', '53.1575306,18.1623272', 'AKTYWNY', 10, 6),
('BYD16A', 'Przy markecie Kaufland, Bydgoszcz', '53.107519,18.0394028', 'AKTYWNY', 10, 13),
('BYD05A', 'Przy sklepie ACTION, Bydgoszcz', '53.1587992,18.1578649', 'AKTYWNY', 16, 8),
('BYD10N', 'Przy Centrum Handlowym Balaton, Bydgoszcz', '53.1260054,18.0535595', 'AKTYWNY', 16, 6),
('BYD43N', 'Przy Auto-Reno-Lak, Bydgoszcz', '53.1026011,18.0572176', 'AKTYWNY', 14, 10),
('BYD45A', 'Przy sklepie Lewiatan, Bydgoszcz', '53.1146773,18.0225719', 'AKTYWNY', 8, 9),
('BYD36N', 'Na parkingu przy sklepie Aldi, Bydgoszcz', '53.1643775,18.1613078', 'AKTYWNY', 14, 6),
('BYD04M', 'Przy sklepie Biedronka, Bydgoszcz', '53.1369703,17.9574864', 'AKTYWNY', 6, 14),
('BYD01M', 'Parking NOT wjazd od str. Św. Floriana, Bydgoszcz', '53.1220873,18.0111848', 'AKTYWNY', 16, 10),
('BYD41M', 'Market Dino, Bydgoszcz', '53.1332948,17.9165829', 'AKTYWNY', 6, 6),
('BYD57M', 'Na posesji prywatnej, Bydgoszcz', '53.147345,17.9716354', 'AKTYWNY', 12, 13),
('BYD21N', 'Przy kinie Adria, Bydgoszcz', '53.119095,18.0115211', 'AKTYWNY', 12, 7),
('BYD83M', 'Posesja prywatna, Bydgoszcz', '53.1205929,17.9939846', 'AKTYWNY', 6, 13),
('BYD35M', 'Na parkingu Rozłogi 1A, Bydgoszcz', '53.1037632,18.0275451', 'AKTYWNY', 16, 14),
('BYD72M', 'Przy posesji, Bydgoszcz', '53.127955,17.9812928', 'AKTYWNY', 10, 5),
('BYD13M', 'Po prawej stronie od wejścia do salonu kosmetycznego Styl, Bydgoszcz', '53.1562873,18.1503534', 'AKTYWNY', 6, 5),
('BYD38A', 'Za stacją Amic Energy, Bydgoszcz', '53.1471602,18.1302545', 'AKTYWNY', 4, 9),
('BYD80M', 'Przy obiekcie handlowym, Bydgoszcz', '53.1264202,17.952525', 'AKTYWNY', 6, 12),
('BYD39N', 'Przy prywatnej posesji, Bydgoszcz', '53.1356387,17.926641', 'AKTYWNY', 10, 14),
('BYD07A', 'Przy cukierni, Bydgoszcz', '53.1502521,18.1554273', 'AKTYWNY', 8, 13),
('BYD60M', 'na działce, Bydgoszcz', '53.1430865,18.0297087', 'AKTYWNY', 8, 8),
('BYD78M', 'Przy cukierni, Bydgoszcz', '53.1492068,18.135741', 'AKTYWNY', 4, 10),
('BYD20N', 'Przy sklepie rybnym Lin, Bydgoszcz', '53.1331672,17.9228903', 'AKTYWNY', 10, 11),
('BYD71M', 'Mechanik samochodowy, Bydgoszcz', '53.133525,18.001416', 'AKTYWNY', 12, 6),
('BYD01H', 'W lokalu, Bydgoszcz', '53.11807,17.99292', 'AKTYWNY', 6, 9),
('BYD20M', 'Na parkingu sklepu Lidl, Bydgoszcz', '53.1155575,18.013488', 'AKTYWNY', 4, 5),
('BYD36M', 'Na parkingu MaDO, Bydgoszcz', '53.1254721,18.0380046', 'AKTYWNY', 6, 8),
('BYD34N', 'Na prywatnej posesji Boczna 2 Bydgoszcz, Bydgoszcz', '53.1286304,18.057043', 'AKTYWNY', 6, 5),
('BYD33A', 'Przy serwisie RTV, Bydgoszcz', '53.1306756,17.9480547', 'AKTYWNY', 12, 13),
('BYD09M', 'na stacji Circle K, Bydgoszcz', '53.1137997,17.9974159', 'AKTYWNY', 14, 11),
('BYD66M', 'Przed sklepem, Bydgoszcz', '53.1360536,17.9450773', 'AKTYWNY', 12, 11),
('BYD26M', 'Na parkingu sklepu Stokrotka, Bydgoszcz', '53.1606458,18.1730455', 'AKTYWNY', 8, 7),
('BYD30M', 'Od strony Lipowej 2, Bydgoszcz', '53.1299925,17.9992284', 'AKTYWNY', 12, 7),
('BYD44M', 'Obok budynku, Bydgoszcz', '53.1355147,18.0033013', 'AKTYWNY', 14, 7),
('BYD36A', 'Po lewej stronie od wejścia do Elita Moda, Bydgoszcz', '53.131854,17.9413767', 'AKTYWNY', 16, 12),
('BYD14N', 'Parking Klubu Sportowego Chemik, Bydgoszcz', '53.102078,18.0320503', 'AKTYWNY', 4, 5),
('BYD37A', 'Przy sklepie Żabka, Bydgoszcz', '53.1353247,18.0320743', 'AKTYWNY', 4, 7),
('BYD43M', 'Przy parkingu między blokami 61 i 63, Bydgoszcz', '53.1682252,18.1735387', 'AKTYWNY', 6, 11),
('BYD54M', 'Za sklepem ODIDO na kostce brukowej, Bydgoszcz', '53.1617334,17.9193164', 'AKTYWNY', 8, 11),
('BYD50M', 'Od ulicy Siedleckiej, Bydgoszcz', '53.1514205,17.9616247', 'AKTYWNY', 8, 11),
('BYD31N', 'Na parkingu przy biurowcu, Bydgoszcz', '53.1335036,17.993753', 'AKTYWNY', 12, 12),
('BYD15M', 'Przy sklepie motoryzacyjnym Mottom, Bydgoszcz', '53.1325354,18.0056916', 'AKTYWNY', 12, 5),
('BYD19N', 'Przy Osova Fitness, Bydgoszcz', '53.1507916,17.9191003', 'AKTYWNY', 4, 13),
('BYD81M', 'Przy sklepie Lidl, Bydgoszcz', '53.1081009,18.0471065', 'AKTYWNY', 16, 12),
('BYD49M', 'Na parkingu sklepu Twój Market, Bydgoszcz', '53.1657348,18.1611286', 'AKTYWNY', 14, 13),
('BYD33M', 'Wzdłuż ulicy Koszarowej, Bydgoszcz', '53.1205129,17.9705141', 'AKTYWNY', 6, 11),
('BYD41A', 'Na parkingu sklepu Lidl, Bydgoszcz', '53.1362803,18.0064164', 'AKTYWNY', 12, 14),
('BYD62M', 'Obok myjni, Bydgoszcz', '53.1210529,18.0472576', 'AKTYWNY', 6, 11),
('BYD63M', 'Przy lodziarni, Bydgoszcz', '53.1123959,17.9788595', 'AKTYWNY', 6, 7),
('BYD18M', 'Przy sklepie Lidl, wjazd od ulicy Samotnej, Bydgoszcz', '53.1538629,18.1682486', 'AKTYWNY', 6, 10),
('BYD42M', 'Na przeciwko sklepu BSS, Bydgoszcz', '53.1319026,18.0415426', 'AKTYWNY', 8, 5),
('BYD06M', 'Przy Żabce, Bydgoszcz', '53.1636682,18.1759118', 'AKTYWNY', 10, 9),
('BYD75M', 'Przy sklepie, Bydgoszcz', '53.1957891,17.9690167', 'AKTYWNY', 14, 8),
('BYD26A', 'Przy sklepie z sejfami, Bydgoszcz', '53.1241866,18.0728771', 'AKTYWNY', 10, 14),
('BYD56M', 'na placu, Bydgoszcz', '53.1670905,17.9712854', 'AKTYWNY', 10, 13),
('BYD42A', 'Przy wejściu do sklepu, Bydgoszcz', '53.0957654,18.1084446', 'AKTYWNY', 10, 9),
('BYD05M', 'Parking Markan, Bydgoszcz', '53.1283328,18.0417391', 'AKTYWNY', 6, 14),
('BYD61M', 'Na ścianie sklepu, Bydgoszcz', '53.1037333,18.0572707', 'AKTYWNY', 16, 11),
('BYD69M', 'Przy garażach, Bydgoszcz', '53.1577702,18.1797922', 'AKTYWNY', 10, 7),
('BYD15A', 'Przy sklepie Bims Plus, Bydgoszcz', '53.1279529,17.9647277', 'AKTYWNY', 10, 7),
('BYD73M', 'przed biurowcem, Bydgoszcz', '53.113909,18.0010439', 'AKTYWNY', 4, 6),
('BYD17N', 'Przy sklepie Pepco, Bydgoszcz', '53.1490947,17.9198749', 'AKTYWNY', 10, 10),
('BYD27N', 'Przy sklepie, Bydgoszcz', '53.1711093,17.968642', 'AKTYWNY', 16, 14),
('BYD12M', 'Na parkingu sklepu Lidl, Bydgoszcz', '53.1488649,17.9131301', 'AKTYWNY', 4, 9),
('BYD38N', 'Na parkingu, po prawej stronie od wejścia do marketu Aldi, Bydgoszcz', '53.104888,18.03192', 'AKTYWNY', 12, 13),
('BYD82M', 'Market Netto, Bydgoszcz', '53.1130933,17.9916308', 'AKTYWNY', 12, 12),
('BYD47M', 'Na rogu ulic, Bydgoszcz', '53.1140567,17.9759653', 'AKTYWNY', 16, 7),
('BYD44A', 'Przy szpitalu uniwersyteckim, Bydgoszcz', '53.1150232,18.0253216', 'AKTYWNY', 12, 5),
('BYD02H', 'W budynku, Bydgoszcz', '53.1102445,18.0456799', 'AKTYWNY', 10, 5),
('BYD88M', 'Przy parkingu, Bydgoszcz', '53.1282582,18.0541231', 'AKTYWNY', 4, 11),
('BYD97M', 'Przy sklepie RABAT, Bydgoszcz', '53.1573449,18.1583227', 'AKTYWNY', 8, 5),
('BYD110M', 'Przy sklepie monopolowym, Bydgoszcz', '53.1219586,17.9755007', 'AKTYWNY', 8, 7),
('BYD109M', 'od ulicy Halibutowej, Bydgoszcz', '53.1607559,17.9079206', 'AKTYWNY', 4, 8),
('BYD96M', 'Posesja prywatna, Bydgoszcz', '53.1479147,17.9614261', 'AKTYWNY', 14, 8),
('BYD02HP', 'w sklepie Duży Ben, Bydgoszcz', '53.1328654,17.9279552', 'AKTYWNY', 6, 12),
('BYD04H', 'W lokalu, Bydgoszcz', '53.1297546,17.9230459', 'AKTYWNY', 8, 6),
('BYD101M', 'Posesja prywatna, Bydgoszcz', '53.1254743,17.9808774', 'AKTYWNY', 8, 6),
('BYD103M', 'Posesja prywatna, Bydgoszcz', '53.1223505,17.9694474', 'AKTYWNY', 4, 6),
('BYD106M', 'Posesja prywatna, Bydgoszcz', '53.1156948,17.9744664', 'AKTYWNY', 16, 14),
('BYD117M', 'SM Komunalni, Bydgoszcz', '53.1162067,17.9803491', 'AKTYWNY', 6, 6),
('BYD116M', 'Posesja prywatna, Bydgoszcz', '53.1134123,17.9809352', 'AKTYWNY', 16, 7),
('BYD122M', 'Obok pasażu usługowego, Bydgoszcz', '53.1084914,17.9772445', 'AKTYWNY', 12, 13),
('BYD100M', 'Obok sklepu spożywczego, Bydgoszcz', '53.1085876,18.0021668', 'AKTYWNY', 4, 13),
('BYD102M', 'Za sklepem spożywczym, Bydgoszcz', '53.1233576,17.9926692', 'AKTYWNY', 4, 13),
('BYD86M', 'Za sklepem ogrodniczym, Bydgoszcz', '53.162239,18.0563785', 'AKTYWNY', 10, 10),
('BYD02APP', 'Za pawilonem, Bydgoszcz', '53.1071245,18.0225715', 'AKTYWNY', 12, 7),
('BYD115M', 'Market Dino, Bydgoszcz', '53.1017299,18.0182117', 'AKTYWNY', 10, 12),
('BYD111M', 'Sklep spożywczo - monopolowy, Bydgoszcz', '53.1005736,18.0260007', 'AKTYWNY', 16, 8),
('BYD89M', 'Stacja Circle K, Bydgoszcz', '53.1067384,18.0455871', 'AKTYWNY', 4, 5),
('BYD03G', 'Stacja Moya, Bydgoszcz', '53.0850716,18.0715591', 'AKTYWNY', 12, 5),
('BYD142M', 'Market Netto, Bydgoszcz', '53.114191,18.0172552', 'AKTYWNY', 12, 14),
('BYD94M', 'Posesja prywatna, Bydgoszcz', '53.1124341,18.0194418', 'AKTYWNY', 8, 9),
('BYD112M', 'Posesja prywatna, Bydgoszcz', '53.1335445,18.0246929', 'AKTYWNY', 12, 6),
('BYD104M', 'Przy parkingu hotelu, Bydgoszcz', '53.124246,18.0103792', 'AKTYWNY', 10, 10),
('BYD135M', 'Przy bloku, Bydgoszcz', '53.1506814,18.1244639', 'AKTYWNY', 10, 14),
('BYD137M', 'Obok studia fryzur, Bydgoszcz', '53.1536203,18.1393655', 'AKTYWNY', 6, 13),
('BYD127M', 'Przy garażach, Bydgoszcz', '53.1528093,18.1467246', 'AKTYWNY', 10, 14),
('BYD126M', 'Obok sklepu spożywczego, Bydgoszcz', '53.1464728,18.151623', 'AKTYWNY', 16, 14),
('BYD113M', 'Posesja prywatna, Bydgoszcz', '53.1483715,18.160028', 'AKTYWNY', 6, 14),
('BYD90M', 'Przy sklepie spożywczym, Bydgoszcz', '53.1631323,18.1562098', 'AKTYWNY', 14, 9),
('BYD133M', 'Obok bloku, Bydgoszcz', '53.1610956,18.1622305', 'AKTYWNY', 12, 9),
('BYD108M', 'Przy lodziarni, Bydgoszcz', '53.1623056,18.162778', 'AKTYWNY', 4, 9),
('BYD125M', 'Przy bloku, Bydgoszcz', '53.1694746,18.1642334', 'AKTYWNY', 16, 9),
('BYD119M', 'Przed pasażem, Bydgoszcz', '53.1658951,18.1747119', 'AKTYWNY', 14, 7),
('BYD118M', 'Obok pasażu, Bydgoszcz', '53.1580203,18.1710921', 'AKTYWNY', 10, 14),
('BYD129M', 'Przed blokiem, Bydgoszcz', '53.1580476,18.1746994', 'AKTYWNY', 16, 7),
('BYD120M', 'SM Komunalni, Bydgoszcz', '53.1555564,18.1797788', 'AKTYWNY', 12, 12),
('BYD92M', 'Przychodnia Weterynaryjna FamilyVet, Bydgoszcz', '53.1554815,18.1634366', 'AKTYWNY', 4, 7),
('BYD157M', 'Pomiędzy blokami mieszkaniowymi, Bydgoszcz', '53.170269,18.1623951', 'AKTYWNY', 4, 6),
('GDA42N', 'Przy wyjściu z przystanku SKM Politechnika, obok sklepu Żabka, Gdańsk', '54.373948,18.6263241', 'AKTYWNY', 14, 13),
('GDA03L', 'Przy markecie Intermarche, Gdańsk', '54.4234037,18.5648732', 'AKTYWNY', 4, 12),
('GDA23A', 'Przy sklepie Fresh Market, Gdańsk', '54.3305734,18.5567769', 'AKTYWNY', 6, 14),
('GDA02L', 'Stacja paliw MOL, Gdańsk', '54.3459027,18.5354577', 'AKTYWNY', 10, 13),
('GDA11B', 'Przy biurowcu Intel, Gdańsk', '54.3806593,18.4838632', 'AKTYWNY', 4, 5),
('GDA10N', 'Przy Centrum Handlowym Manhattan, Gdańsk', '54.3767796,18.6073945', 'AKTYWNY', 14, 8),
('GDA11N', 'Przy serwisie rowerów, Gdańsk', '54.3504845,18.560655', 'AKTYWNY', 16, 6),
('GDA05F', 'Przy Aptece, Gdańsk', '54.4028704,18.6099644', 'AKTYWNY', 8, 13),
('GDA06A', 'Przy markecie Gulden, Gdańsk', '54.420992,18.5715616', 'AKTYWNY', 4, 6),
('GDA15N', 'Przy sali okolicznościowej Jasieńska Kawka, Gdańsk', '54.341265,18.5579559', 'AKTYWNY', 14, 10),
('GDA25N', 'Przy IX komisariacie policji, Gdańsk', '54.4287795,18.4683612', 'AKTYWNY', 8, 9),
('GDA24A', 'Przy sklepie Freshmarket, Gdańsk', '54.352704,18.5128797', 'AKTYWNY', 12, 6),
('GDA43A', 'Na parkingu hostelu, przy wejściu do baru Filip, Gdańsk', '54.3595699,18.6475328', 'AKTYWNY', 10, 11),
('GDA39A', 'Przy sklepie Żabka, Gdańsk', '54.3338906,18.5421436', 'AKTYWNY', 8, 6),
('GDA220M', 'przy stacji BP, Gdańsk', '54.3580427,18.5838042', 'AKTYWNY', 4, 11),
('GDA43N', 'Przy Stacji Kontroli Pojazdów Europak, Gdańsk', '54.426358,18.4590281', 'AKTYWNY', 4, 7),
('GDA18B', 'Przy markecie Biedronka, Gdańsk', '54.3380733,18.625553', 'AKTYWNY', 12, 12),
('GDA37M', 'Miejsca parkingowe przy budynku Lidla, w pobliżu strefy dostaw, Gdańsk', '54.3003861,18.6078338', 'AKTYWNY', 4, 5),
('GDA48N', 'Przy wejściu do budynku przy ulicy Orfeusza 2, od strony parkingu, Gdańsk', '54.4223789,18.4807099', 'AKTYWNY', 10, 6),
('GDA02G', 'Przy salonie fryzjerskim Studio Retro, Gdańsk', '54.3805229,18.5877313', 'AKTYWNY', 16, 8),
('GDA12A', 'Przy sklepie Oliwka, Gdańsk', '54.3844896,18.5816291', 'AKTYWNY', 4, 9),
('GDA51N', 'Przy sklepie internetowym Printexpress.pl, Gdańsk', '54.378335,18.5744463', 'AKTYWNY', 14, 12),
('GDA06M', 'Przy Centrum Oświetlenia Koma, Gdańsk', '54.412274,18.5694877', 'AKTYWNY', 16, 5),
('GDA66M', 'trawnik przed wejściem, Gdańsk', '54.356131,18.652215', 'AKTYWNY', 6, 12),
('GDA92M', 'Przy stacji PKM, Gdańsk', '54.3916815,18.5783329', 'AKTYWNY', 6, 6),
('GDA125M', 'Przy sklepie Aldi, Gdańsk', '54.4165155,18.4774658', 'AKTYWNY', 10, 14),
('GDA117M', 'obiekt mieszkalny, Gdańsk', '54.3187869,18.5850479', 'AKTYWNY', 10, 7),
('GDA99M', 'posesja prywatna, Gdańsk', '54.3134664,18.5856734', 'AKTYWNY', 8, 6),
('GDA52M', 'Przy Skwerze Morena, Gdańsk', '54.3580831,18.5875666', 'AKTYWNY', 16, 14),
('GDA28N', 'Przy pizzerii Włoszczyzna, Gdańsk', '54.3624973,18.5965346', 'AKTYWNY', 6, 7),
('GDA55M', 'Parking przy pasażu handlowym za pętlą tramwajową, Gdańsk', '54.3215577,18.6051165', 'AKTYWNY', 4, 8),
('GDA143M', 'Przy Contact Service Zakład Elektroniczny, Gdańsk', '54.3717382,18.5985988', 'AKTYWNY', 10, 12),
('GDA119M', 'przy Biedronce, Gdańsk', '54.3254497,18.5492497', 'AKTYWNY', 6, 9),
('GDA43M', 'parking Fitness Good Luck, Gdańsk', '54.3395732,18.5559734', 'AKTYWNY', 16, 12),
('GDA96M', 'przy Żabce, Gdańsk', '54.3384722,18.564276', 'AKTYWNY', 4, 13),
('GDA24M', 'Przy Minidelikatesach Motyl, Gdańsk', '54.4152366,18.4473249', 'AKTYWNY', 4, 7),
('GDA02N', 'Stacja paliw BP, Gdańsk', '54.3240213,18.5483137', 'AKTYWNY', 12, 5),
('GDA20N', 'Przy stacji kontroli pojazdów, Gdańsk', '54.3423192,18.5090355', 'AKTYWNY', 6, 8),
('GDA106M', 'przy sklepie, Gdańsk', '54.3851989,18.4861451', 'AKTYWNY', 14, 5),
('GDA18N', 'Stacja paliw AMIC ENERGY, Gdańsk', '54.3758735,18.5210415', 'AKTYWNY', 12, 9),
('GDA23M', 'Na parkingu sklepu Lidl, Gdańsk', '54.3359727,18.5968986', 'AKTYWNY', 4, 12),
('GDA34A', 'Przy wejściu do apteki, Gdańsk', '54.3892454,18.5690302', 'AKTYWNY', 10, 13),
('GDA90M', 'przy Groszku, Gdańsk', '54.385618,18.5710847', 'AKTYWNY', 6, 11),
('GDA06B', 'Przy sklepie ABO Elwart, Gdańsk', '54.3751837,18.5630824', 'AKTYWNY', 8, 8),
('GDA98M', 'przy stacji PKM, Gdańsk', '54.3648896,18.5730551', 'AKTYWNY', 8, 7),
('GDA102M', 'posesja prywatna, Gdańsk', '54.3612711,18.570987', 'AKTYWNY', 14, 14),
('GDA65M', 'przy chodniku obok LOT, Gdańsk', '54.3506547,18.646877', 'AKTYWNY', 10, 12),
('GDA05M', 'Za budynkiem Stacji Kontroli Pojazdów, Gdańsk', '54.34932,18.60781', 'AKTYWNY', 16, 12),
('GDA42M', 'na parkingu Lidla, Gdańsk', '54.3456598,18.6005317', 'AKTYWNY', 10, 13),
('GDA69M', 'przy pawilonie ROBYG, Gdańsk', '54.350746,18.5858547', 'AKTYWNY', 4, 7),
('GDA124M', 'Przy budynku usługowym, Gdańsk', '54.44151,18.45276', 'AKTYWNY', 8, 12),
('GDA28M', 'parking Oktan, Gdańsk', '54.4304547,18.4826338', 'AKTYWNY', 4, 14),
('GDA139M', 'przy sklepie spożywczym Marcin, Gdańsk', '54.4277354,18.4663261', 'AKTYWNY', 12, 6),
('GDA144M', 'przy sklepie spożywczym Lewiatan, Gdańsk', '54.4283088,18.4785036', 'AKTYWNY', 10, 6),
('GDA39M', 'Przy agencji celnej Depo, Gdańsk', '54.4035886,18.6601658', 'AKTYWNY', 16, 12),
('GDA41M', 'parking Lidla, Gdańsk', '54.4026906,18.6340058', 'AKTYWNY', 4, 14),
('GDA74M', 'przy Carrefourze, Gdańsk', '54.4057765,18.6037604', 'AKTYWNY', 16, 11),
('GDA16M', 'Przy Centrum Biurowym Arkońska, Gdańsk', '54.4046278,18.5777749', 'AKTYWNY', 16, 5),
('GDA30N', 'Przy galerii Zielony Kamyk, Gdańsk', '54.41254,18.58651', 'AKTYWNY', 6, 12),
('GDA63N', 'przy Żabce, Gdańsk', '54.4184412,18.5925651', 'AKTYWNY', 8, 6),
('GDA31N', 'Przy pawilonie handlowym, Gdańsk', '54.4207272,18.5836564', 'AKTYWNY', 16, 12),
('GDA29M', 'parking Lidla, Gdańsk', '54.3777099,18.6161527', 'AKTYWNY', 10, 12),
('GDA37N', 'Przy sklepie Lidl, Gdańsk', '54.3778178,18.6325757', 'AKTYWNY', 12, 11),
('GDA464', 'Stacja paliw Circle K, Gdańsk', '54.3785434,18.6339809', 'AKTYWNY', 6, 11),
('GDA51M', 'przy markecie Merkus, Gdańsk', '54.3790112,18.6321908', 'AKTYWNY', 16, 5),
('GDA07M', 'Po prawej stronie wejścia do Solarium Silver, Gdańsk', '54.3941518,18.5987533', 'AKTYWNY', 6, 12),
('GDA118M', 'przy sklepie Odido, Gdańsk', '54.3183389,18.6286224', 'AKTYWNY', 12, 14),
('GDA31A', 'Przy parkingu Hotelu Zatoka, Gdańsk', '54.3209548,18.6310805', 'AKTYWNY', 16, 9),
('GDA79M', 'posesja prywatna, Gdańsk', '54.3268158,18.637458', 'AKTYWNY', 14, 11),
('GDA135M', 'Przy budynku usługowym, Gdańsk', '54.3276846,18.6320732', 'AKTYWNY', 16, 9),
('GDA27M', 'Przy delikatesach, Gdańsk', '54.3431421,18.6423179', 'AKTYWNY', 16, 13),
('GDA09L', 'Przy sklepie GIGA, Gdańsk', '54.3407166,18.618942', 'AKTYWNY', 14, 5),
('GDA77M', 'przy klubie Mrs. Sporty, Gdańsk', '54.3418781,18.6255778', 'AKTYWNY', 16, 11),
('GDA50M', 'przy markecie Merkus, Gdańsk', '54.3414817,18.6300387', 'AKTYWNY', 6, 6),
('GDA49M', 'przy hurtowni "Tukan", Gdańsk', '54.3383672,18.6285315', 'AKTYWNY', 14, 6),
('GDA54M', 'przy pasażu Activ Invest, Gdańsk', '54.3334905,18.61586', 'AKTYWNY', 6, 11),
('GDA29A', 'Przy sklepie Towaroteka, Gdańsk', '54.3279682,18.6150145', 'AKTYWNY', 10, 10),
('GDA08L', 'Stacja paliw Shell, Gdańsk', '54.3264855,18.6101899', 'AKTYWNY', 8, 8),
('GDA18A', 'Przy sklepie BIEDRONKA, Gdańsk', '54.3282758,18.6116079', 'AKTYWNY', 4, 7),
('GDA114M', 'przy stacji Moya express, Gdańsk', '54.3505395,18.7111642', 'AKTYWNY', 10, 5),
('GDA25M', 'przy parkingu Lidla, Gdańsk', '54.3320546,18.6370125', 'AKTYWNY', 4, 5),
('GDA39N', 'Przy Autoserwisie, Gdańsk', '54.3344344,18.6357933', 'AKTYWNY', 10, 5),
('GDA133M', 'Za budynkiem stacji, Gdańsk', '54.3407385,18.6417277', 'AKTYWNY', 4, 13),
('GDA137M', 'Przy sklepie, Gdańsk', '54.3340762,18.6555845', 'AKTYWNY', 4, 12),
('GDA120M', 'Przy Siedzibie LPP, Gdańsk', '54.3418525,18.6609753', 'AKTYWNY', 6, 11),
('GDA63M', 'przy automyjni, Gdańsk', '54.3480193,18.6832382', 'AKTYWNY', 8, 8),
('GDA55N', 'Przy sklepie Żabka, Gdańsk', '54.3573964,18.6847739', 'AKTYWNY', 14, 6),
('GDA151M', 'Przy budynku produkcyjnym, Gdańsk', '54.42613,18.48012', 'AKTYWNY', 16, 5),
('GDA150M', 'Parking przy sklepie, Gdańsk', '54.3548732,18.4927919', 'AKTYWNY', 12, 7),
('GDA161M', 'posesja prywatna, Gdańsk', '54.3785333,18.602299', 'AKTYWNY', 10, 12),
('GDA185M', 'Przy ścianie marketu Livio, Gdańsk', '54.3795086,18.582712', 'AKTYWNY', 4, 12),
('GDA184M', 'Na szczycie falowca, Gdańsk', '54.4078403,18.590564', 'AKTYWNY', 4, 14),
('GDA152M', 'Na ścianie frontowej pawilonu, Gdańsk', '54.4185789,18.5804162', 'AKTYWNY', 16, 5),
('GDA167M', 'przy Aptece, Gdańsk', '54.3997956,18.6606849', 'AKTYWNY', 12, 6),
('GDA149M', 'Przy sklepie Lewiatan, Gdańsk', '54.3433659,18.6099516', 'AKTYWNY', 12, 7),
('GDA01SAPP', 'Parking samochodowy, Gdańsk', '54.4021593,18.5809431', 'AKTYWNY', 8, 12),
('GDA38N', 'Na parkingu za sklepami Biedronka / Pepco, Gdańsk', '54.3252925,18.6171716', 'AKTYWNY', 8, 14),
('GDA179M', 'Przy budynku mieszkalnym, Gdańsk', '54.3304881,18.5928114', 'AKTYWNY', 8, 13),
('GDA05H', 'w Lokalu, Gdańsk', '54.4090817,18.5866429', 'AKTYWNY', 8, 10),
('GDA158M', 'Przy Kiosku, Gdańsk', '54.361785,18.5951136', 'AKTYWNY', 8, 10),
('GDA160M', 'Przy budynku mieszkalnym, Gdańsk', '54.3664774,18.6282665', 'AKTYWNY', 12, 8),
('GDA157M', 'przy sklepie Biedronka od ul. Miłosza, Gdańsk', '54.3485303,18.5901539', 'AKTYWNY', 4, 12),
('GDA10APP', 'Na parkingu centrum, Gdańsk', '54.3509791,18.5551573', 'AKTYWNY', 12, 7),
('GDA65N', 'Przy sklepie, Gdańsk', '54.4067727,18.6387416', 'AKTYWNY', 14, 6),
('GDA07APP', 'Na parkingu Aldi, Gdańsk', '54.3518027,18.4995436', 'AKTYWNY', 10, 9),
('GDA197M', 'przy serwisie opon, Gdańsk', '54.4383762,18.4605932', 'AKTYWNY', 8, 12),
('GDA196M', 'Przy sklepie, Gdańsk', '54.3262274,18.6188536', 'AKTYWNY', 12, 12),
('GDA172M', 'Przy Pizzerii Krokodyl, Gdańsk', '54.4013139,18.6085405', 'AKTYWNY', 8, 8),
('GDA194M', 'Przy sklepie rowerowym, Gdańsk', '54.3966071,18.5906188', 'AKTYWNY', 12, 13),
('GDA02SAPP', 'Przy parkingu, Gdańsk', '54.3320651,18.565085', 'AKTYWNY', 4, 14),
('GDA04IM', 'przy galerii Manhattan, Gdańsk', '54.3774621,18.607942', 'AKTYWNY', 12, 10),
('GDA09H', 'W lokalu, Gdańsk', '54.3444078,18.5347306', 'AKTYWNY', 10, 14),
('GDA11H', 'W lokalu, Gdańsk', '54.3831883,18.5871972', 'AKTYWNY', 6, 6),
('GDA165M', 'Przy Lewiatanie, Gdańsk', '54.3352481,18.626158', 'AKTYWNY', 6, 7),
('GDA20H', 'w lokalu użytkowym, Gdańsk', '54.307722,18.5843361', 'AKTYWNY', 4, 12),
('GDA217M', 'Przy sklepie ABC Modra, Gdańsk', '54.3371451,18.6747508', 'AKTYWNY', 4, 10),
('GDA15H', 'w sklepie Duży Ben, Gdańsk', '54.3078445,18.5818248', 'AKTYWNY', 14, 5),
('GWI01L', 'Gorzów Wielkopolski, Aleksandra Fredry 10, Gorzów Wielkopolski', '52.7387901,15.2188439', 'AKTYWNY', 10, 14),
('GWI08M', 'Gorzów Wielkopolski, Grobla 35, Gorzów Wielkopolski', '52.722625,15.2514632', 'AKTYWNY', 14, 10),
('GWI54M', 'Gorzów Wielkopolski, Generała Ignacego Prądzyńskiego 30, Gorzów Wielkopolski', '52.76558,15.24589', 'AKTYWNY', 12, 14),
('GWI55M', 'Gorzów Wielkopolski, Jana Dekerta 103, Gorzów Wielkopolski', '52.7660149,15.2483297', 'AKTYWNY', 8, 12),
('GWI03APP', 'Gorzów Wielkopolski, Przemysłowa 53, Gorzów Wielkopolski', '52.7264277,15.2408199', 'AKTYWNY', 10, 12),
('GWI04N', 'Gorzów Wielkopolski, Koniawska 50, Gorzów Wielkopolski', '52.717069,15.2534911', 'AKTYWNY', 4, 13),
('KAT03A', 'Przy markecie Auchan, Katowice', '50.2301581,18.9495167', 'AKTYWNY', 4, 13),
('KAT04A', 'Przy Simply Market, Katowice', '50.2200028,18.9693821', 'AKTYWNY', 10, 6),
('KAT127M', 'na parkingu przy sklepie Biedronka, Katowice', '50.2185064,18.9690001', 'AKTYWNY', 16, 14),
('KAT13M', 'Przy sklepie NETTO, Katowice', '50.1959811,18.978573', 'AKTYWNY', 14, 11),
('KAT09N', 'Stacja paliw Circle K, Katowice', '50.1937753,18.983715', 'AKTYWNY', 8, 14),
('KAT02M', 'Przy piekarni Kłos, Katowice', '50.2059554,18.979115', 'AKTYWNY', 12, 6),
('KAT01N', 'Przy markecie Intermarche, Katowice', '50.1998417,18.9756643', 'AKTYWNY', 16, 9),
('KAT25M', 'Przy sklepie Lidl, Katowice', '50.2339892,18.975651', 'AKTYWNY', 6, 6),
('KAT135M', 'Przy PSS Społem, Katowice', '50.252853,19.0050738', 'AKTYWNY', 16, 11),
('KAT02H', 'W wolnostojącym pawilonie po prawej stronie budynku przy Poniatowskiego 19, Katowice', '50.2508511,19.0111017', 'AKTYWNY', 8, 7),
('KAT71M', 'SHELL Katowice Rozdzieńskiego, Katowice', '50.27159,19.06615', 'AKTYWNY', 14, 14),
('KAT57M', 'Parking Strzelców Bytomskich 17, Katowice', '50.278219,19.0695635', 'AKTYWNY', 8, 7),
('KAT39M', 'Przy Hallera 18, Katowice', '50.2700189,19.0783959', 'AKTYWNY', 6, 9),
('KAT15N', 'Studio ruchu i tańca ADS, Katowice', '50.260159,19.1099679', 'AKTYWNY', 6, 14),
('KAT143M', 'na parkingu przy budynku ul. Deszczowa 12, Katowice', '50.27393,19.07463', 'AKTYWNY', 8, 8),
('KAT05APP', 'TTW OPEX Katowice, Katowice', '50.27754,19.0724', 'AKTYWNY', 16, 8),
('KAT01HP', 'w sklepie Duży Ben, Katowice', '50.26271,19.09439', 'AKTYWNY', 16, 11),
('KAT01B', 'obok przystanku autobusowego przed firmą Elbud, Katowice', '50.26368,19.08822', 'AKTYWNY', 8, 9),
('PNET0916', 'Parking strzeżony przy ul. Ułańskiej/Tysiąclecia, Katowice', '50.28519,18.9648', 'AKTYWNY', 8, 8),
('KAT91M', 'po prawej stronie sklepu Żabka, Katowice', '50.21244,18.98774', 'AKTYWNY', 8, 5),
('KAT90M', 'po prawej stronie budynku, Katowice', '50.20422,18.97574', 'AKTYWNY', 14, 11),
('KAT85M', 'przed budynkiem mieszkalnym, naprzeciwko szpitala Górnośląskie Centrum Medyczne, Katowice', '50.21149,18.99643', 'AKTYWNY', 6, 12),
('KAT83M', 'na parkingu przed sklepem Żabka, Katowice', '50.1765302,18.9717046', 'AKTYWNY', 4, 11),
('KAT80M', 'na parkingu wewnętrznym kościoła przy ul. Bukszpanowej, Katowice', '50.19473,18.96926', 'AKTYWNY', 6, 12),
('KAT78M', 'przy osiedlowym boisku, pomiędzy ul. Zbożową, ul. Szewską i ul. Targową, Katowice', '50.21313,18.98059', 'AKTYWNY', 12, 5),
('KAT77M', 'przy parkingu obok bloku ul. Radockiego nr. 174, Katowice', '50.2020733,18.9874379', 'AKTYWNY', 14, 13),
('KAT76M', 'przy budynku Poczty Polskiej, po przeciwległej stronie budynku, Katowice', '50.2152022,18.9877334', 'AKTYWNY', 14, 6),
('KAT75M', 'przy budynku kotłowni osiedlowej, Katowice', '50.2093947,18.9829574', 'AKTYWNY', 10, 5),
('KAT74M', 'SHELL Katowice Kościuszki 322, Katowice', '50.21871,18.9844', 'AKTYWNY', 16, 10),
('KAT69M', 'na parkingu marketu Stokrotka, Katowice', '50.20325,18.98424', 'AKTYWNY', 16, 7),
('KAT68M', 'przed wjazdem na posesję ul. Boya Żeleńskiego 15A, Katowice', '50.1908783,18.9923226', 'AKTYWNY', 16, 11),
('KAT66M', 'parking przed budynkiem, równolegle do ul. Wileńskiej, Katowice', '50.22354,18.96387', 'AKTYWNY', 12, 5),
('KAT65M', 'Dojazd od ul. Spokojnej, wjazd w drogę osiedlową, naprzeciwko targowiska przy bloku ul. Spokojna 43, Katowice', '50.20692,18.9864', 'AKTYWNY', 6, 5),
('KAT64M', 'PRZY WJEZDZIE NA TEREN MYJNI, Katowice', '50.1979711,18.9837881', 'AKTYWNY', 4, 13),
('KAT63M', 'Spożywczy Katowice Żurawia 80, Katowice', '50.2077983,18.9644045', 'AKTYWNY', 14, 9),
('KAT61M', 'Parking sklepu Lidl, Katowice', '50.2298005,18.9392507', 'AKTYWNY', 4, 6),
('KAT58M', 'Apartamenty Hiacynt Katowice, Katowice', '50.18867,18.98182', 'AKTYWNY', 12, 10),
('KAT55M', 'obok pawilonu handlowego, Katowice', '50.2204879,18.9740868', 'AKTYWNY', 14, 8),
('KAT44M', 'Na parkinu samochodowym, Katowice', '50.2245683,18.9248988', 'AKTYWNY', 8, 7),
('KAT43M', 'Przy wejściu do sklepu, Katowice', '50.1979303,18.9635835', 'AKTYWNY', 4, 6),
('KAT41M', 'Przy bloku mieszkalnym, Katowice', '50.22246,18.96025', 'AKTYWNY', 4, 10),
('KAT32A', 'przy punkcie Kolporter, Katowice', '50.20172,18.99029', 'AKTYWNY', 8, 14),
('KAT26A', 'Przy przychodni Revital, Katowice', '50.18363,18.99818', 'AKTYWNY', 6, 14),
('KAT25N', 'Na myjni samoobsługowej, Katowice', '50.207494,18.9897897', 'AKTYWNY', 14, 9),
('KAT22M', 'Parking Lidl, Katowice', '50.2793949,18.974538', 'AKTYWNY', 10, 11),
('KAT22A', 'Parking przy Żłobku Misiowy Zakątek, Katowice', '50.27049,18.97248', 'AKTYWNY', 16, 12),
('KAT21N', 'Sklep Euro przy Grota-Roweckiego, Katowice', '50.18208,18.93996', 'AKTYWNY', 10, 13),
('KAT154M', 'Posesja Katowice Panewnicka 360, Katowice', '50.22864,18.92092', 'AKTYWNY', 6, 11),
('KAT151M', 'Kaufland Katowice Famur, Katowice', '50.21348,18.97601', 'AKTYWNY', 12, 14),
('KAT148M', 'przy Klubie Osiedlowym, na tylnej ścianie sklepu Żabka, Katowice', '50.2124417,18.978931', 'AKTYWNY', 10, 13),
('KAT145M', 'obok budynku sklepu Społem, Katowice', '50.22943,18.9435', 'AKTYWNY', 4, 8),
('KAT139M', 'na targowisku miejskim, Katowice', '50.27989,18.97284', 'AKTYWNY', 16, 7),
('KAT138M', 'na parkingu obok budynku ul. Bażantów 41, Katowice', '50.19873,18.98836', 'AKTYWNY', 6, 10),
('KAT136M', 'Posesja Katowice Wymysłów Tylna 8, Katowice', '50.22534,18.93853', 'AKTYWNY', 10, 12),
('KAT133M', 'przed budynkiem akademików, Katowice', '50.2262927,18.957728', 'AKTYWNY', 16, 8),
('KAT125M', 'u zbiegu ul. Asnyka i ul. Kosynierów, Katowice', '50.21408,18.97086', 'AKTYWNY', 4, 6),
('KAT123M', 'na parkingu, Katowice', '50.19251,18.97528', 'AKTYWNY', 14, 14),
('KAT118M', 'obok garaży, Katowice', '50.2075,18.99371', 'AKTYWNY', 6, 10),
('KAT117M', 'przed budynkiem, Katowice', '50.20097,18.96354', 'AKTYWNY', 4, 6),
('KAT105M', 'na parkingu przed sklepem, Katowice', '50.1938344,18.9910434', 'AKTYWNY', 6, 13),
('KAT103M', 'przed budynkiem, Katowice', '50.20729,18.96814', 'AKTYWNY', 16, 14),
('KAT06APP', 'na parkingu budynku usługowo-handlowego, Katowice', '50.18253,18.97797', 'AKTYWNY', 10, 14),
('KAT02HP', 'w sklepie Duży Ben, Katowice', '50.20642,18.98988', 'AKTYWNY', 14, 13),
('KAT02A', 'Obok bankomatu PKO BP, Katowice', '50.2041745,18.9885342', 'AKTYWNY', 8, 10),
('KAT01M', 'Na parkingu przy Pracowni Projektowej, Katowice', '50.22939,18.95416', 'AKTYWNY', 8, 12),
('KIE22N', 'Przed wejściem do marketu PSB Mrówka, Kielce', '50.8816669,20.5776855', 'AKTYWNY', 6, 8),
('KIE52M', 'Przy sklepie Cannabis Platinium, Kielce', '50.8845737,20.5833765', 'AKTYWNY', 6, 8),
('KIE68M', 'Stacja paliw BP, Kielce', '50.8741563,20.6084949', 'AKTYWNY', 16, 14),
('KIE31M', 'Osiedle na Stoku Pawilon 102, 25-437, Kielce, przy wjeździe do siedziby Spółdzielni, Kielce', '50.8966634,20.6728841', 'AKTYWNY', 14, 13),
('KIE44M', 'Kielce, Osiedle Na Stoku 71A, Kielce', '50.8929121,20.6598489', 'AKTYWNY', 14, 10),
('KIE03M', 'Paczkomat znajduję się na parkingu przy sklepie Delikatesy Centrum, Kielce', '50.8794287,20.6069446', 'AKTYWNY', 10, 11),
('KRA46A', 'Na parkingu przy sklepie Lidl, Kraków', '50.0255314,19.9127913', 'AKTYWNY', 12, 7),
('KRA282M', 'Przy bloku nr 103, Kraków', '50.0241023,19.9106043', 'AKTYWNY', 12, 5),
('KRA05N', 'Paczkomat przy banku BPH, Kraków', '50.0664519,19.9617136', 'AKTYWNY', 14, 7),
('KRA22M', 'Paczkomat przy stacji Circle K, Kraków', '50.0846394,19.9623679', 'AKTYWNY', 16, 12),
('KRA31A', 'Aleja Generała Tadeusza Bora-Komorowskiego, Kraków', '50.0871367,19.9850691', 'AKTYWNY', 14, 10),
('KRA45A', 'Paczkomat przy budynku Copernicus, Kraków', '50.0798342,19.9939956', 'AKTYWNY', 4, 7),
('KRA15A', 'Przy markecie Kaufland, Kraków', '50.0149506,20.0220011', 'AKTYWNY', 16, 7),
('KRA01N', 'Przy sklepie Market Point, Kraków', '50.0181048,20.0343049', 'AKTYWNY', 10, 10),
('KRA15N', 'Paczkomat Inpost KRA15N, Kraków', '50.0156096,20.053023', 'AKTYWNY', 16, 7),
('KRA281M', 'FACTORY PARK ul. Przemysłowa 12, Kraków', '50.0484426,19.9601448', 'AKTYWNY', 14, 8),
('KRA28N', 'Na bocznej ścianie Galerii Bronowice, Kraków', '50.0928,19.8954271', 'AKTYWNY', 14, 7),
('KRA29M', 'Paczkomat InPost KRA29M, Kraków', '50.0226183,20.0507635', 'AKTYWNY', 14, 8),
('KRA09AP', 'Przy markecie Kaufland - Paczkomat Hi-Shine, Kraków', '50.0149968,20.0220891', 'AKTYWNY', 8, 8),
('KRA31M', 'Na parkingu sklepu LIDL, Kraków', '50.0737813,20.0016176', 'AKTYWNY', 12, 8),
('KRA68M', 'Paczkomat Inpost KRA68M, Kraków', '50.0193476,20.0505745', 'AKTYWNY', 10, 6),
('KRA69M', 'Paczkomat przy Opolska Business Park, Kraków', '50.08722,19.9552286', 'AKTYWNY', 10, 8),
('KRA84M', 'Parking przy sklepie owocowo - warzywnym (obok ul. Lea 82), Kraków', '50.0716505,19.9095938', 'AKTYWNY', 16, 7),
('KRA164M', 'Przy parkingu restauracji Da Marco, Kraków', '50.0667145,19.9715351', 'AKTYWNY', 10, 6),
('KRA390M', 'Stacja paliw Krak-Tar, Kraków', '50.0379741,19.9250434', 'AKTYWNY', 10, 5),
('PNET0909', 'Sklep Społem, po lewej stronie od wejścia, Kraków', '50.0795393,20.06503', 'AKTYWNY', 6, 9),
('KRA262M', 'Obok wjazdu do Jednostki Wojskowej, Kraków', '50.0767594,19.9277716', 'AKTYWNY', 12, 14),
('KRA181M', 'Parking przed Zakładem Produkcyjnym Opakowań Wykwintnych, Kraków', '49.9851793,19.9862434', 'AKTYWNY', 16, 14),
('KRA317M', 'Na Łąkach 7, Kraków', '50.0664969,20.0067059', 'AKTYWNY', 8, 10),
('KRA192M', 'Z tyłu biurowca PODIUM PARK, Kraków', '50.075087,19.9993335', 'AKTYWNY', 8, 5),
('KRA193M', 'Przy ścianie frontowej Budynku Wydziału Mechanicznego, Kraków', '50.0746581,19.9976954', 'AKTYWNY', 8, 6),
('KRA235M', 'Przy wjeździe na parking, obok Lokali handlowych, Kraków', '50.0755406,20.0058157', 'AKTYWNY', 14, 8),
('KRA311M', 'Przy wjeździe do strefy handlowo przemysłowej, Kraków', '50.0620366,20.0176772', 'AKTYWNY', 10, 8),
('KRA187M', 'Przed ogrodzeniem posesji od strony ul.Gromady Grudziąż, Kraków', '50.0150363,19.9592282', 'AKTYWNY', 14, 8),
('KRA279M', 'Frontowa Ściana Sklepu, Kraków', '50.079004,19.8849633', 'AKTYWNY', 12, 7),
('KRA118M', 'Dajwór, Kraków', '50.0517406,19.9491256', 'AKTYWNY', 10, 13),
('KRA417M', 'przy skrzyżowaniu ul. Jaremy i Gnieźnieńskiej, Kraków', '50.0865333,19.9069409', 'AKTYWNY', 12, 14),
('KRA24M', 'Przy sklepie zoologicznym, Kraków', '50.0755163,19.919448', 'AKTYWNY', 14, 10),
('KRA322M', 'PRZY BUDYNKU ul. STRÓŻA RYBNA 20, Kraków', '50.0440077,19.9832042', 'AKTYWNY', 10, 13),
('KRA357M', 'Parking na końcu bloku, Kraków', '50.0185844,20.0546403', 'AKTYWNY', 14, 14),
('KRA349M', 'Rej. skrzyżowania ul. Jabłonnej i Siewnej, Kraków', '50.0916638,19.9553378', 'AKTYWNY', 16, 7),
('KRA46M', 'Przed wejściem do sklepu Żabka, Kraków', '50.0442985,19.9863652', 'AKTYWNY', 14, 12),
('KRA190M', 'Od strony ulicy Balickiej, Kraków', '50.0823837,19.887875', 'AKTYWNY', 12, 5),
('KRA230M', 'Przy chodniku, Kraków', '50.0651589,19.8661533', 'AKTYWNY', 4, 13),
('KRA341M', 'posesja Przewóz 49, Kraków', '50.0409233,19.9943083', 'AKTYWNY', 6, 8),
('KRA379M', 'W ogrodzeniu po prawej strony od bramy, Kraków', '50.0914097,19.9685283', 'AKTYWNY', 16, 11),
('KRA19APP', 'Przy bloku ul. Przewóz 40A, Kraków', '50.0407668,19.996108', 'AKTYWNY', 16, 12),
('KRA339M', 'Przy skrzyżowaniu, Kraków', '50.0933934,19.9840723', 'AKTYWNY', 6, 14),
('KRA398M', 'Obok parkingu, środkowy Paczkomat, Kraków', '50.0820803,20.0009815', 'AKTYWNY', 4, 13),
('KRA333M', 'z tyłu Pawilonu od str. ul. Bosaków, Kraków', '50.0839648,19.9633974', 'AKTYWNY', 8, 12),
('KRA401M', 'Adama Próchnika 64, Kraków', '50.1023893,20.008364', 'AKTYWNY', 10, 10),
('KRA13M', 'Przy sklepie Lewiatan, Kraków', '50.0874951,20.0219851', 'AKTYWNY', 8, 12),
('KRA327M', 'Przy Centrum Kształcenia Zawodowego i Ustawicznego (z boku budynku), Kraków', '50.0792813,20.0475733', 'AKTYWNY', 8, 10),
('KRA399M', 'Bitwy nad Bzurą, Kraków', '50.0984716,20.0109865', 'AKTYWNY', 12, 12),
('KRA400M', 'przy skrzyżowaniu obok sklepu Shot, Kraków', '50.1003409,20.0099728', 'AKTYWNY', 4, 9),
('KRA386M', 'Obok Centrum Zdrowia i Profilaktyki, Kraków', '50.0573684,19.9797395', 'AKTYWNY', 12, 14),
('KRA256M', 'posesja Mały Płaszów 16, Kraków', '50.0419124,20.0027739', 'AKTYWNY', 8, 14),
('KRA11HP', 'Paczkomat przy wejściu głównym w środku budynku, Kraków', '50.0121222,19.9999996', 'AKTYWNY', 6, 8),
('KRA410M', 'Parking ul. Zaczarowane Koło 2, Kraków', '50.078405,19.9021791', 'AKTYWNY', 16, 10),
('KRA08BAPP', 'Z tyłu budynku przy parkingu, Kraków', '50.0665513,20.0275994', 'AKTYWNY', 16, 8),
('KRA07BAPP', 'Przy bloku mieszklanym, Kraków', '50.0722066,19.9053798', 'AKTYWNY', 8, 11),
('KRA423M', 'Paczkomat znajduje się na parkingu, Kraków', '50.0630016,19.9082649', 'AKTYWNY', 8, 5),
('KRA150M', 'Przejście pomiędzy parkingiem sklepu MILA a ul. Jadźwingów, Kraków', '50.0969667,20.0201316', 'AKTYWNY', 6, 12),
('KRA58M', 'Obok sklepu Delikatesy Centrum, Kraków', '50.097268,20.0201082', 'AKTYWNY', 14, 13),
('KRA326M', 'Przy pawilonie handlowym od strony parkingu, Kraków', '50.0769707,19.9806785', 'AKTYWNY', 10, 13),
('KRA03HO', 'W budynku Kaufland, na pierwszym piętrze holu Klubu Fitness Platinium, Kraków', '50.084217,19.935559', 'AKTYWNY', 12, 11),
('KRA04BAPP', 'Przy bloku - Aleja Pokoju 89, Kraków', '50.0685763,20.0123195', 'AKTYWNY', 4, 10),
('KRA52BAPP', 'ul. Mariana Domagały obok nr 27, Kraków', '50.0268793,20.0513676', 'AKTYWNY', 16, 11),
('KRA06MP', 'Stacja paliw Circle K, Kraków', '50.0661483,19.9726589', 'AKTYWNY', 12, 10),
('KRA185M', 'przy skrzyżowaniu ulic Wileńskiej z Celarowską, Kraków', '50.0820312,19.9546374', 'AKTYWNY', 6, 8),
('KRA13APP', 'Kraków, Fabryczna 13, Kraków', '50.0618256,19.9731682', 'AKTYWNY', 12, 5),
('KRA15APP', 'Kraków, 3A, Kraków', '50.077223,20.0413361', 'AKTYWNY', 14, 7),
('KRA02BAPP', 'Kraków, Jeziorko 23, Kraków', '50.0877903,20.1462079', 'AKTYWNY', 14, 9),
('KRA20M', 'Kraków, Skotnicka 78, Kraków', '50.0190343,19.8752297', 'AKTYWNY', 4, 14),
('LUB07N', 'Przy markecie Auchan, Lublin', '51.2665156,22.5606657', 'AKTYWNY', 14, 7),
('LUB01N', 'Przy sklepie Stokrotka, Lublin', '51.2025649,22.544442', 'AKTYWNY', 10, 6),
('LUB07ML', 'Stacja paliw Lotos, Lublin', '51.2141015,22.5495506', 'AKTYWNY', 10, 8),
('LUB11N', 'Przy Centrum Handlowym Atrium Felicity, Lublin', '51.231791,22.6126499', 'AKTYWNY', 4, 6),
('LUB16N', 'Przy SKENDE Shopping Centrum Handlowe, Lublin', '51.2831097,22.5700243', 'AKTYWNY', 10, 8),
('LUB33M', 'Przy Lewiatanie, Lublin', '51.2764654,22.577151', 'AKTYWNY', 6, 12),
('LUB40M', 'Przy Omega Centrum, Lublin', '51.197281,22.5952209', 'AKTYWNY', 10, 9),
('LUB17N', 'Przy sklepie Minuta 8, Lublin', '51.1955916,22.5954241', 'AKTYWNY', 12, 8),
('LUB38M', 'Zieleniak "U Sąsiada", Lublin', '51.2229423,22.4925346', 'AKTYWNY', 16, 9),
('LUB05N', 'Przy sklepie Stokrotka, Lublin', '51.2224331,22.5104462', 'AKTYWNY', 12, 10),
('LUB05ML', 'Przy Color Park Lublin, Lublin', '51.2357297,22.5770482', 'AKTYWNY', 4, 8),
('LUB32M', 'Przy Lidlu, Lublin', '51.2237342,22.5742367', 'AKTYWNY', 14, 5),
('LUB04ML', 'Stacja paliw Shell, Lublin', '51.2534706,22.5620653', 'AKTYWNY', 12, 6),
('LUB16A', 'Przy Carrefour, Lublin', '51.2591843,22.5837834', 'AKTYWNY', 12, 5),
('node/8929305781', 'Lublin, Mirosława Dereckiego 38, Lublin', '51.2799883,22.5404433', 'AKTYWNY', 16, 6),
('LUB84M', 'Przy sklepie Dywany Łuszczów, Lublin', '51.22743,22.55627', 'AKTYWNY', 12, 8),
('LUB81M', 'przy ścianie apteki przy wejściu, Lublin', '51.24791,22.59585', 'AKTYWNY', 6, 6),
('LUB79M', 'Przy budynku usługowym, Lublin', '51.25556,22.51717', 'AKTYWNY', 8, 8),
('LUB78M', 'Przy Auto Serwisie 1,5 Volta, Lublin', '51.21612,22.59109', 'AKTYWNY', 8, 14),
('LUB77M', 'przy bocznej ścianie apteki, Lublin', '51.2211951,22.5006222', 'AKTYWNY', 14, 6),
('LUB76M', 'Przy piekarni, Lublin', '51.2700255,22.511097', 'AKTYWNY', 14, 11),
('LUB73M', 'Przy firmie Inform, Lublin', '51.2877,22.47533', 'AKTYWNY', 8, 8),
('LUB67M', 'Przy sklepie spożywczym, Lublin', '51.25537,22.55151', 'AKTYWNY', 6, 14),
('LUB65M', 'Przy parkingu, Lublin', '51.25737,22.54692', 'AKTYWNY', 4, 10),
('LUB64M', 'Przy garażach, Lublin', '51.25935,22.53972', 'AKTYWNY', 14, 6),
('LUB63M', 'Przy administracji RSM Motor, Lublin', '51.25677,22.59283', 'AKTYWNY', 10, 8),
('LUB59M', 'Przy LPEC, Lublin', '51.23704,22.4979', 'AKTYWNY', 10, 6),
('LUB58M', 'Przy budynku LPEC, Lublin', '51.23523,22.50085', 'AKTYWNY', 12, 7),
('LUB56M', 'Przy budynku LPEC, Lublin', '51.23369,22.50842', 'AKTYWNY', 4, 14),
('LUB55M', 'LSS Społem LUX, Lublin', '51.2496774,22.5319256', 'AKTYWNY', 6, 6),
('LUB28M', 'Przy Lidlu, Lublin', '51.21308,22.54963', 'AKTYWNY', 10, 8),
('LUB09M', 'Przy Galerii Parada, Lublin', '51.25019,22.51121', 'AKTYWNY', 14, 14),
('LUB80M', 'Na prywatnej posesji, Lublin', '51.2663984,22.5103332', 'AKTYWNY', 4, 13),
('LUB83M', 'Przy przedszkolu, Lublin', '51.2767246,22.5770051', 'AKTYWNY', 14, 11),
('LUB87M', 'parking przy schodach, Lublin', '51.2703399,22.5820232', 'AKTYWNY', 4, 10),
('LUB86M', 'Na parkingu Aldi, Lublin', '51.2762465,22.5730238', 'AKTYWNY', 12, 12),
('LUB97M', 'Niedaleko wiat śmietnikowych, Lublin', '51.2201957,22.6374681', 'AKTYWNY', 6, 12),
('LUB95M', 'przy wejściu do budynku administracji stadionu, Lublin', '51.2422275,22.5119488', 'AKTYWNY', 6, 14),
('LUB98M', 'Przy wiacie śmietnikowej, Lublin', '51.2315838,22.5822368', 'AKTYWNY', 14, 7),
('LUB93M', 'Przy sklepie spożywczym, Lublin', '51.2088874,22.5823965', 'AKTYWNY', 6, 7),
('LUB91M', 'Przy budynku mieszkalnym, Lublin', '51.2669985,22.5844543', 'AKTYWNY', 14, 8),
('LUB90M', 'Przy parkingu na posesji prywatnej, Lublin', '51.2764285,22.5821443', 'AKTYWNY', 10, 13),
('LUB99M', 'Przy Lewiatanie, Lublin', '51.2577985,22.4933443', 'AKTYWNY', 12, 14),
('LUB94M', 'Przy Aptece, Lublin', '51.2363185,22.5051643', 'AKTYWNY', 10, 7),
('LUB89M', 'Przy budynku ZUBRZYCKI i S-ka, Lublin', '51.2426085,22.5031143', 'AKTYWNY', 12, 11),
('LUB106M', 'Przy Stokrotce, Lublin', '51.2519685,22.5296943', 'AKTYWNY', 10, 5),
('OLS15M', 'przy Lidlu, Olsztyn', '53.7864652,20.4482715', 'AKTYWNY', 4, 10),
('OLS11A', 'Przy parkingu Warmia Wheels, Olsztyn', '53.7417249,20.4928807', 'AKTYWNY', 10, 5),
('OLS08M', 'Przy sklepie Stodoła, Olsztyn', '53.7671028,20.4358566', 'AKTYWNY', 12, 5),
('OLS08N', 'Przy akademiku, Olsztyn', '53.7553707,20.4599825', 'AKTYWNY', 6, 12),
('OLS30M', 'przy aptece Savita, Olsztyn', '53.7396988,20.5136045', 'AKTYWNY', 6, 5),
('OLS23M', 'przy sklepie Lewiatan, Olsztyn', '53.76574,20.49487', 'AKTYWNY', 8, 6),
('OLS29M', 'przy Kauflandzie, Olsztyn', '53.76344,20.49593', 'AKTYWNY', 6, 8),
('OLS22A', 'Przy budynku mieszkalnym, Olsztyn', '53.7415673,20.4899271', 'AKTYWNY', 6, 8),
('OLS13M', 'przy Lidlu, Olsztyn', '53.7572012,20.4667813', 'AKTYWNY', 8, 9),
('OLS03M', 'Przy Domu studenta 119, Olsztyn', '53.7488567,20.4516985', 'AKTYWNY', 16, 12),
('OLS12A', 'Przy sklepie Intermarche, Olsztyn', '53.7323668,20.4912282', 'AKTYWNY', 10, 10),
('OLS27A', 'Przy budynku mieszkalnym, Olsztyn', '53.7260607,20.478071', 'AKTYWNY', 16, 13),
('OLS01H', 'wewnątrz lokalu, Olsztyn', '53.7206789,20.47128', 'AKTYWNY', 12, 8),
('OLS17A', 'Przy sklepie Lewiatan, Olsztyn', '53.8005753,20.4058977', 'AKTYWNY', 12, 7),
('OLS04N', 'Przy gabinecie stomatologicznym Dentalfit, Olsztyn', '53.8034557,20.4421662', 'AKTYWNY', 10, 14),
('OLS39M', 'przy Carrefour, Olsztyn', '53.800011,20.4406254', 'AKTYWNY', 12, 12),
('OLS21M', 'przy poradni psychologicznej, Olsztyn', '53.7817937,20.4583684', 'AKTYWNY', 8, 7),
('OLS42M', 'przy posesji prywatnej, Olsztyn', '53.770026,20.466437', 'AKTYWNY', 16, 10),
('OLS24M', 'przy Biedronce, Olsztyn', '53.7687519,20.4297473', 'AKTYWNY', 6, 9),
('OLS33M', 'przy Żabce, Olsztyn', '53.7649197,20.4190833', 'AKTYWNY', 12, 8),
('OLS06N', 'Przy biurowcu Ubezpieczenia Zawistowscy, Olsztyn', '53.7861835,20.5178053', 'AKTYWNY', 14, 9),
('OLS18M', 'przy Lidlu, Olsztyn', '53.7786909,20.5116114', 'AKTYWNY', 14, 5),
('OLS09M', 'przy sklepie Malwa, Olsztyn', '53.7727007,20.4975044', 'AKTYWNY', 14, 10),
('OLS37M', 'przy sklepie Kalina, Olsztyn', '53.7794506,20.5018389', 'AKTYWNY', 12, 6),
('OLS02M', 'Przy stacji paliw Circle K, Olsztyn', '53.7839269,20.5001878', 'AKTYWNY', 8, 13),
('OLS21A', 'przy sklepie medycznym, Olsztyn', '53.791414,20.4827653', 'AKTYWNY', 6, 11),
('OLS26A', 'Przy warsztacie samochodowym, Olsztyn', '53.7816239,20.4705469', 'AKTYWNY', 8, 13),
('OLS06A', 'Przy Centrum Handlowym Victor, Olsztyn', '53.7727541,20.4992577', 'AKTYWNY', 16, 7),
('OLS02APP', 'kwiaciarnia MAK, Olsztyn', '53.7686736,20.4984634', 'AKTYWNY', 4, 12),
('OLS04G', 'przy Firmie Smart, Olsztyn', '53.7650176,20.5241385', 'AKTYWNY', 12, 14),
('OLS06BAPP', 'przy Aldi, Olsztyn', '53.7320702,20.4962905', 'AKTYWNY', 16, 9),
('OPO01M', 'Na terenie myjni samoobsługowej, Opole', '50.6849051,17.9534348', 'AKTYWNY', 6, 13),
('OLB03M', 'Obok Pepco, Opole', '51.1449668,21.9773013', 'AKTYWNY', 6, 5),
('OLB04M', 'Przy Lidlu, Opole', '51.1464583,21.979417', 'AKTYWNY', 8, 9),
('OPO14M', 'Przy Galerii ZIelony Rynek, Opole', '50.6756382,17.9710465', 'AKTYWNY', 10, 5),
('OLB02M', 'Przy budynku usługowym, Opole', '51.1483914,21.9680699', 'AKTYWNY', 10, 9),
('OPO10N', 'Przy budce ochrony, Opole', '50.6601662,17.980952', 'AKTYWNY', 16, 13),
('OPO13M', 'Przy Budynku Usługowym, Opole', '50.68437,17.82296', 'AKTYWNY', 6, 11),
('POZ12N', 'Przy sklepie spożywczym, Poznań', '52.4087996,16.8365976', 'AKTYWNY', 16, 7),
('POZ16B', 'Stacja paliwowa Amic, Poznań', '52.4100829,16.972642', 'AKTYWNY', 14, 13),
('POZ26A', 'Stacja paliw BP, Poznań', '52.4267978,16.9779407', 'AKTYWNY', 10, 14),
('POZ09ML', 'Przy markecie Biedronka, Poznań', '52.4517629,16.9224574', 'AKTYWNY', 4, 13),
('POZ38A', 'Przy prywatnej posesji, Poznań', '52.4223567,16.97535', 'AKTYWNY', 12, 13),
('POZ11A', 'Stacja paliw Shell, Poznań', '52.3996685,16.9687736', 'AKTYWNY', 4, 8),
('POZ01M', 'Przy pasażu handlowym, Poznań', '52.3911967,16.986958', 'AKTYWNY', 14, 12),
('POZ48N', 'Na tyłach stacji paliw Circle K, Poznań', '52.3916294,16.9811265', 'AKTYWNY', 8, 11),
('POZ42N', 'Przy sklepie Stokrotka, Poznań', '52.4077339,17.0243329', 'AKTYWNY', 16, 8),
('POZ25A', 'Przy sklepie Decathlon, Poznań', '52.4320227,16.9505833', 'AKTYWNY', 14, 11),
('POZ15M', 'przy hurtowni GRACJA, Poznań', '52.4358815,16.9437217', 'AKTYWNY', 12, 8),
('POZ31M', 'Na parkingu sklepu Lidl, Poznań', '52.3930139,16.9935328', 'AKTYWNY', 14, 10),
('POZ52A', 'Niezabudowana działka od strony ul. Wachowiaka, Poznań', '52.4487482,16.9232003', 'AKTYWNY', 14, 13),
('POZ47N', 'Myjnia samochodowa F1 CarWash, Poznań', '52.4126786,16.8319067', 'AKTYWNY', 10, 7),
('POZ85M', 'position estimated, Poznań', '52.4445542,16.96133', 'AKTYWNY', 10, 12),
('POZ49M', 'Przy Hotelu Dorrian, Poznań', '52.3992503,16.8931682', 'AKTYWNY', 10, 10),
('POZ22A', 'Stacja paliw BP, Poznań', '52.4065826,16.8891462', 'AKTYWNY', 10, 10),
('POZ146M', 'Na tyłach restauracji, Poznań', '52.4101599,16.9856738', 'AKTYWNY', 16, 12),
('POZ17N', 'Przy sklepie Carrefour, Poznań', '52.4090896,16.9844694', 'AKTYWNY', 10, 8),
('POZ126M', 'Parking hotelowy (dla Klientów InPost bezpłatny do 20minut), Poznań', '52.408076,16.974027', 'AKTYWNY', 14, 13),
('POZ206M', 'Prywatna posesja, Poznań', '52.4055414,17.0226834', 'AKTYWNY', 8, 9),
('POZ281M', 'Przy budynku produkcyjnym, Poznań', '52.4117099,16.9523081', 'AKTYWNY', 6, 7),
('POZ223M', 'Teren prywatnej posesji, Poznań', '52.4078618,17.0106491', 'AKTYWNY', 16, 13),
('POZ29N', 'Przy bramie wjazdowej, Poznań', '52.4135449,16.8838565', 'AKTYWNY', 14, 9),
('POZ100M', 'Przy wjeździe od ul. Lwowskiej, Poznań', '52.400824,16.964264', 'AKTYWNY', 10, 6),
('POZ147M', 'Przy parkingu, Poznań', '52.3992687,16.9624548', 'AKTYWNY', 4, 13),
('POZ10B', 'Przy sklepie Kaufland, Poznań', '52.4353022,16.9272034', 'AKTYWNY', 12, 9),
('POZ227M', 'teren zielony przy stacji Shell, Poznań', '52.3997794,16.9691796', 'AKTYWNY', 8, 14),
('POZ239M', 'teren zielony przy budynku, Poznań', '52.3933248,16.9747813', 'AKTYWNY', 14, 13),
('POZ190M', 'Przy Siedzibie ZKZL, Poznań', '52.406817,16.8699327', 'AKTYWNY', 16, 14),
('POZ13M', 'Przy Lidlu, Poznań', '52.3785705,16.8739088', 'AKTYWNY', 16, 5),
('POZ244M', 'Drogeria, Poznań', '52.407749,16.869985', 'AKTYWNY', 8, 12),
('POZ203M', 'Za pasażem handlowym, Poznań', '52.4092701,16.8717118', 'AKTYWNY', 8, 10),
('POZ213M', 'Przy zakładzie optycznym, Poznań', '52.4075438,16.872093', 'AKTYWNY', 12, 7),
('POZ88M', 'Za Apteką Wrzosowa, od strony ul. Turkusowej, Poznań', '52.4305275,16.9043174', 'AKTYWNY', 8, 12),
('POZ251M', 'Przy bloku mieszkalnym os. Dębina 7, Poznań', '52.36007,16.9058246', 'AKTYWNY', 12, 6),
('POZ232M', 'Szczyt bloku od ul. Rolnej, Poznań', '52.3837519,16.9177566', 'AKTYWNY', 12, 14),
('POZ02H', 'W lokalu użytkowym, Poznań', '52.407694,16.9211199', 'AKTYWNY', 10, 11),
('POZ163M', 'przy markecie Stokrotka, Poznań', '52.3878906,16.9840029', 'AKTYWNY', 6, 12),
('POZ04A', 'Stacja paliw Shell, Poznań', '52.4104998,16.8681166', 'AKTYWNY', 10, 10),
('POZ50A', 'Na parkingu przy sklepie Lidl, Poznań', '52.4593766,16.9085814', 'AKTYWNY', 6, 14),
('POZ267M', 'obok parkingu, Poznań', '52.4227348,16.9095998', 'AKTYWNY', 4, 9),
('POZ84M', 'Parking samochodowy, Poznań', '52.4350058,16.9124913', 'AKTYWNY', 14, 11),
('POZ26N', 'Przy markecie Biedronka, Poznań', '52.3867598,16.9826549', 'AKTYWNY', 14, 11),
('POZ19HP', 'w sklepie Duży Ben, Poznań', '52.4083315,16.9378636', 'AKTYWNY', 6, 6),
('POZ129M', 'parking Lidla, Poznań', '52.3849636,16.943648', 'AKTYWNY', 14, 13),
('POZ04H', 'pawilon handlowo-usługowy Równość, Poznań', '52.3867773,16.9440593', 'AKTYWNY', 14, 6),
('POZ43N', 'Przy parkingu strzeżonym, Poznań', '52.3906663,16.9464579', 'AKTYWNY', 8, 9),
('POZ104M', 'Przy pływalni miejskiej Rataje, Poznań', '52.3931384,16.9440985', 'AKTYWNY', 16, 12),
('POZ02B', 'Stacja paliw BP, Poznań', '52.4136842,16.8339018', 'AKTYWNY', 8, 12),
('POZ07B', 'Stacja paliw AMIC ENERGY, Poznań', '52.3750778,16.8689713', 'AKTYWNY', 4, 8),
('POZ01APP', 'przy cukierni, Poznań', '52.4121774,16.9785661', 'AKTYWNY', 6, 9),
('POZ03APP', 'przy pawilonie handlowym, Poznań', '52.4094708,16.963074', 'AKTYWNY', 16, 14),
('POZ273M', 'teren zielony przy budynku mieszkalnym, Poznań', '52.4128038,16.9644293', 'AKTYWNY', 6, 9),
('POZ262M', 'Przy salonie fryzjerskim, Poznań', '52.4091978,16.9811423', 'AKTYWNY', 14, 14),
('POZ265M', 'Prywatna posesji, Poznań', '52.4057108,17.0160472', 'AKTYWNY', 8, 13),
('POZ57A', 'za budynkiem stacji, Poznań', '52.4259082,16.9775121', 'AKTYWNY', 8, 14),
('POZ250M', 'Przy budynku mieszkalnym, Poznań', '52.3870926,16.9597262', 'AKTYWNY', 6, 12),
('POZ253M', 'Przy bloku mieszkalnym os. Dębina 22b, Poznań', '52.3613473,16.9083423', 'AKTYWNY', 8, 8),
('POZ187M', 'Przed wjazdem na posesję, Poznań', '52.3701476,16.9036749', 'AKTYWNY', 12, 11),
('POZ10H', 'W lokalu użytkowym, Poznań', '52.4010895,16.9366372', 'AKTYWNY', 12, 8),
('POZ20HP', 'w sklepie Duży Ben, Poznań', '52.409509,16.9026234', 'AKTYWNY', 12, 5),
('POZ36A', 'Stacja paliw BP, Poznań', '52.3841744,16.9158633', 'AKTYWNY', 16, 11),
('POZ294M', 'parking przed budynkiem, Poznań', '52.3904445,16.9044414', 'AKTYWNY', 10, 12),
('POZ92M', 'Na parkingu myjni Banieczka, Poznań', '52.3837878,16.8940276', 'AKTYWNY', 12, 10),
('POZ14B', 'Stacja paliw BP, Poznań', '52.3751297,16.8942363', 'AKTYWNY', 16, 11),
('POZ172M', 'teren posesji, Poznań', '52.4287462,16.9471881', 'AKTYWNY', 10, 13),
('POZ230M', 'Na parkingu budynku wielorodzinnego, Poznań', '52.4301108,16.9510321', 'AKTYWNY', 16, 11),
('POZ51M', 'Przy sklepie Lewiatan, Poznań', '52.4335433,16.9110088', 'AKTYWNY', 10, 10),
('POZ124M', 'Na parkingu, Poznań', '52.4739756,16.9465761', 'AKTYWNY', 12, 14),
('POZ245M', 'na terenie osiedla Różany Potok, Poznań', '52.4681268,16.9375709', 'AKTYWNY', 6, 10),
('POZ215M', 'Przy parkingu za budynkiem, Poznań', '52.455555,16.9488219', 'AKTYWNY', 12, 8),
('POZ20H', 'W lokalu użytkowym, Poznań', '52.4621189,16.9218831', 'AKTYWNY', 8, 13),
('POZ196M', 'Przy warsztacie Auto-Axel, Poznań', '52.4401542,16.9164616', 'AKTYWNY', 14, 7),
('POZ183M', 'Przy Przychodni, Poznań', '52.4494151,16.9154536', 'AKTYWNY', 14, 7),
('POZ14M', 'Przy Chacie Polskiej, Poznań', '52.4502584,16.9146364', 'AKTYWNY', 12, 9),
('POZ15B', 'Przy Zakładzie Opieki Zdrowotnej, Poznań', '52.4478759,16.9079843', 'AKTYWNY', 6, 7),
('POZ222M', 'Przy warsztacie samochodowym, Poznań', '52.4151002,16.888722', 'AKTYWNY', 6, 9),
('POZ210M', 'Na parkingu marketu Lidl, Poznań', '52.3964996,16.8700288', 'AKTYWNY', 4, 9),
('POZ08A', 'Stacja paliw BP, Poznań', '52.3967287,16.8682421', 'AKTYWNY', 4, 9),
('POZ159M', 'Myjnia Piątkowo - paczkomat od strony Jaroczyńskiego, Poznań', '52.4540123,16.9038767', 'AKTYWNY', 14, 6),
('POZ186M', 'Przy Ninja Pizza, Poznań', '52.4535653,16.906405', 'AKTYWNY', 10, 13),
('POZ29M', 'Przy budynku obok parkingu sklepu Lidl, Poznań', '52.4509488,16.906154', 'AKTYWNY', 4, 6),
('POZ98M', 'Przy biurowcu, Poznań', '52.3908897,16.8763112', 'AKTYWNY', 16, 10),
('POZ80M', 'Trawnik przy bloku mieszkalnym, Poznań', '52.390477,16.8680513', 'AKTYWNY', 16, 13),
('POZ10M', 'Na parkingu przy markecie ALDI, Poznań', '52.3911148,16.8666796', 'AKTYWNY', 6, 8),
('POZ77M', 'Przy wypożyczalni Ramirent, Poznań', '52.3738848,16.8689564', 'AKTYWNY', 6, 8),
('POZ13A', 'Przy markecie Chata Polska, Poznań', '52.4345259,16.8273195', 'AKTYWNY', 8, 13),
('POZ34H', 'lokal w przyziemiu, Poznań', '52.4541441,16.9422009', 'AKTYWNY', 8, 6),
('POZ03B', 'Poznań, Szwajcarska, Poznań', '52.3936932,16.9914472', 'AKTYWNY', 4, 13),
('POZ70N', 'Poznań, Polanka 13, Poznań', '52.3997693,16.9578561', 'AKTYWNY', 6, 5),
('RZE02M', 'Przy cukierni Społem i Banku Pekao, Rzeszów', '50.0188285,21.9944927', 'AKTYWNY', 8, 13),
('RZE23A', 'Przy stacji Watkem, Rzeszów', '50.0173424,22.0235067', 'AKTYWNY', 14, 12),
('RZE07N', 'Stacja paliw Źródełko, Rzeszów', '50.0569175,21.9959314', 'AKTYWNY', 4, 11),
('RZE21M', 'Przy sklepie E. Leclerc, Rzeszów', '50.0191593,22.0194996', 'AKTYWNY', 12, 7),
('RZE05A', 'Przy markecie Biedronka, Rzeszów', '50.0023459,22.0153148', 'AKTYWNY', 4, 8),
('RZE06A', 'Stacja paliw Mares, Rzeszów', '50.0329185,22.0343887', 'AKTYWNY', 10, 7),
('RZE03N', 'Przy wjeździe do płatnego Parkingu, Rzeszów', '50.0356432,21.9950095', 'AKTYWNY', 14, 12),
('RZE01A', 'Przy Porcie Lotniczym Rzeszów - na terenie strefy pasażerskiej przy parkingu, Rzeszów', '50.1153172,22.0257549', 'AKTYWNY', 8, 5),
('RZE14M', 'Przy sklepie Alkapone, Rzeszów', '50.0302467,21.9769527', 'AKTYWNY', 10, 7),
('RZE05N', 'Przy sklepie Biedronka, Rzeszów', '50.044176,21.9554153', 'AKTYWNY', 6, 5),
('RZE04A', 'Przy salonie łazienek BLU, Rzeszów', '50.0224685,22.0176821', 'AKTYWNY', 16, 10),
('RZE18A', 'Na tylnym parkingu przy sklepie meblowym Meblex, Rzeszów', '50.0252952,22.0178325', 'AKTYWNY', 6, 14),
('RZE01N', 'Stacja paliw BP, Rzeszów', '50.0184466,22.014523', 'AKTYWNY', 16, 13),
('RZE24A', 'Przy delikatesach Frac, Rzeszów', '50.0172618,22.0038743', 'AKTYWNY', 4, 13),
('RZE05M', 'Przy sklepie Społem, Rzeszów', '50.0235986,22.0224763', 'AKTYWNY', 12, 13),
('RZE01G', 'Przy delikatesach Premium, Rzeszów', '50.0281468,22.0186251', 'AKTYWNY', 16, 8),
('RZE09N', 'Stacja paliw Źródełko, Rzeszów', '50.0262503,21.9777656', 'AKTYWNY', 10, 12),
('RZE09A', 'Przy sklepie spożywczym MARMAX, Rzeszów', '50.0190781,21.9776547', 'AKTYWNY', 16, 13),
('RZE16A', 'Przy sklepie MarketVita, Rzeszów', '50.0069372,21.9563612', 'AKTYWNY', 10, 6),
('RZE10A', 'Przy sklepie Delikatesy Centrum, Rzeszów', '50.0385475,22.0451958', 'AKTYWNY', 6, 14),
('RZE06M', 'Obok budynku przy ulicy Twardowskiego 9, Rzeszów', '50.0339681,22.0327235', 'AKTYWNY', 16, 7),
('RZE15M', 'Przy bloku Grodzisko 3A, Rzeszów', '50.0352238,22.0037743', 'AKTYWNY', 14, 5),
('RZE01W', 'Przy Sklepie Delikatesy Centrum, Rzeszów', '50.036597,21.9696564', 'AKTYWNY', 12, 14),
('RZE45M', 'Maszyna z lewej strony galerii, Rzeszów', '50.0442798,21.9548983', 'AKTYWNY', 8, 5),
('RZE30M', 'Przy sklepie Lewiatan, Rzeszów', '50.0796549,21.9774886', 'AKTYWNY', 14, 13),
('RZE01M', 'Przy stacji paliw Watkem, Rzeszów', '50.013174,21.9687938', 'AKTYWNY', 8, 14),
('RZE11M', 'Na parkingu Delikatesy Centrum, Rzeszów', '49.9818479,22.0209678', 'AKTYWNY', 6, 12),
('RZE40M', 'Przy stacji, Rzeszów', '50.0164676,21.9616575', 'AKTYWNY', 6, 7),
('RZE46M', 'Przy sklpeie Nasz sklep, Rzeszów', '50.0093249,22.0217529', 'AKTYWNY', 10, 9),
('RZE08N', 'Przy sklepie Żabka, Rzeszów', '49.9961521,21.9897174', 'AKTYWNY', 16, 5),
('RZE20M', 'Przy Delikatesach Centrum, Rzeszów', '49.9787904,21.992907', 'AKTYWNY', 16, 14),
('RZE32M', 'Na parkingu Domu Kultury Matysówka, Rzeszów', '49.9991316,22.055643', 'AKTYWNY', 8, 7),
('RZE13M', 'Przy sklepie spożywczym, Rzeszów', '49.9665501,21.9938179', 'AKTYWNY', 6, 7),
('RZE13A', 'Przy parku handlowym, Rzeszów', '50.0018864,22.0246871', 'AKTYWNY', 14, 8),
('RZE23M', 'Przy sklepie Spar, Rzeszów', '50.0104595,22.0363657', 'AKTYWNY', 12, 10),
('RZE37M', 'Przy sklepie FRAC, Rzeszów', '50.016711,21.9735687', 'AKTYWNY', 14, 10),
('RZE31M', 'Przy sklepie Żabka, Rzeszów', '50.0120424,21.9991156', 'AKTYWNY', 14, 10),
('RZE36M', 'Przy sklepie Sieć Delikatesów GS, Rzeszów', '50.0076086,21.9547833', 'AKTYWNY', 6, 5),
('RZE35M', 'Przy Galerii Budziwój, Rzeszów', '49.9680602,21.9843406', 'AKTYWNY', 16, 8),
('RZE03M', 'Przy sklepie Społem, Rzeszów', '50.0232951,21.989493', 'AKTYWNY', 10, 14),
('RZE28M', 'Przy sklepie Lidl, Rzeszów', '50.0249827,22.0056122', 'AKTYWNY', 12, 13),
('RZE11N', 'Przy myjni samochodowej, Rzeszów', '50.028923,22.0418925', 'AKTYWNY', 14, 11),
('RZE24M', 'Przy Galerii NOVA od parkingu dawnego TESCO, Rzeszów', '50.0192888,22.0141005', 'AKTYWNY', 14, 13),
('RZE38M', 'Przy Folwark Center Rzeszów, Rzeszów', '50.0260843,22.0419654', 'AKTYWNY', 6, 11),
('RZE02N', 'Przy sklepie Majster, Rzeszów', '50.0241676,21.9743395', 'AKTYWNY', 12, 13),
('RZE11A', 'Przy sklepie Centrum Dekoral Professional, Rzeszów', '50.0277404,22.0347926', 'AKTYWNY', 10, 14),
('RZE19M', 'Przy centrum Handlowym w przejściu wewnętrzym (podcienia), Rzeszów', '50.0259981,22.0079038', 'AKTYWNY', 6, 13),
('RZE12M', 'Parking Delikatesów Centrum, Rzeszów', '50.0244069,22.0453081', 'AKTYWNY', 8, 5),
('RZE26M', 'Przy myjni Auto Błysk, Rzeszów', '50.0259894,21.9822512', 'AKTYWNY', 8, 8),
('RZE41M', 'Przy stacji paliw Moya, Rzeszów', '50.0252987,22.0302624', 'AKTYWNY', 6, 10),
('RZE09M', 'Na parkingu, po lewej stronie wejścia do sklepu Lidl, Rzeszów', '50.0232727,21.9966901', 'AKTYWNY', 4, 14),
('RZE17M', 'Przy pawilonie, obok sklepu Żabka, Rzeszów', '50.0210416,22.0072634', 'AKTYWNY', 6, 5),
('RZE02A', 'Stacja paliw Shell, Rzeszów', '50.0425566,21.990462', 'AKTYWNY', 8, 5),
('RZE27M', 'Przy Agencji Rozwoju Regionalnego front budynku, Rzeszów', '50.0319206,22.002372', 'AKTYWNY', 14, 6),
('RZE03W', 'Przy sklepie Delikatesy Centrum, Rzeszów', '50.0326359,21.9814928', 'AKTYWNY', 14, 9),
('RZE14A', 'Na parkingu Outlet Graffica, Rzeszów', '50.0353798,21.997314', 'AKTYWNY', 16, 11),
('RZE295', 'Przy parkingu samochodowym, Rzeszów', '50.0410076,21.9765142', 'AKTYWNY', 10, 7),
('RZE16M', 'Przy Galerii Rzeszów od ul. Piłsudskiego, Rzeszów', '50.042383,21.996627', 'AKTYWNY', 6, 8),
('RZE02HO', 'Wewnatrz Galerii Graffica obok sklepu Douglas, Rzeszów', '50.03522,21.99633', 'AKTYWNY', 8, 14),
('RZE19A', 'Przy Galerii Rzeszów wejście od ul. Stefana Czarnieckiego, Rzeszów', '50.042495,21.9995244', 'AKTYWNY', 14, 13),
('RZE07A', 'Przy Galerii Bi1, Rzeszów', '50.0392171,21.9765472', 'AKTYWNY', 6, 7),
('RZE21A', 'Przy Banku Spółdzielczym w Błażowej, Rzeszów', '50.0375204,21.9819112', 'AKTYWNY', 8, 14),
('RZE22A', 'Przy delikatesach Frac, Rzeszów', '50.0398572,21.9894906', 'AKTYWNY', 8, 5),
('RZE17A', 'Przy Centrum Handlowym Capital Park, Rzeszów', '50.0303722,22.0172248', 'AKTYWNY', 10, 14),
('RZE29M', 'Przy budynku usługowym Lwowska 15A, Rzeszów', '50.0381727,22.0259913', 'AKTYWNY', 6, 13),
('RZE01HO', 'Wewnątrz Pasażu Rzeszów obok operatora spożywczego, Rzeszów', '50.03644,22.00262', 'AKTYWNY', 16, 6),
('RZE20A', 'Przy sklepie Delikatesy Centrum, Rzeszów', '50.0593835,22.0471927', 'AKTYWNY', 16, 11),
('RZE064', 'Stacja paliw PKS, Rzeszów', '50.0566457,21.9884942', 'AKTYWNY', 4, 7),
('RZE04M', 'Przy sklepie Społem, Rzeszów', '50.0512575,21.9819926', 'AKTYWNY', 10, 8),
('RZE10M', 'Przy stacji paliw Shell, Rzeszów', '50.0524071,21.9716761', 'AKTYWNY', 8, 10),
('RZE42M', 'Przy Centrum Handlowym Stara Szwalnia, Rzeszów', '50.0475897,21.9862892', 'AKTYWNY', 8, 7),
('RZE15A', 'Przy sklepie Kaufland, Rzeszów', '50.0500514,21.9897105', 'AKTYWNY', 16, 6),
('RZE12A', 'Przy sklepie Delikatesy Centrum, Rzeszów', '50.0614081,22.0100925', 'AKTYWNY', 12, 8),
('RZE06N', 'Przy Galerii Nowy Świat, Rzeszów', '50.0488824,21.9754387', 'AKTYWNY', 10, 8),
('RZE44M', 'przy myjni, Rzeszów', '50.0509004,21.9718657', 'AKTYWNY', 14, 9),
('RZE10N', 'Przy przedszkolu, Rzeszów', '50.0579087,21.985057', 'AKTYWNY', 6, 11),
('RZE02W', 'Przy Delikatesach Centrum, Rzeszów', '50.0533387,21.9474802', 'AKTYWNY', 14, 7),
('RZE07M', 'Po prawej stronie od wejścia do sklepu Lidl, Rzeszów', '50.0528973,21.9707785', 'AKTYWNY', 12, 5),
('RZE71M', 'Przy parkingu osiedlowym obok pętli autobusowej, Rzeszów', '50.0629294,21.9801852', 'AKTYWNY', 6, 11),
('RZE18M', 'Przy Delikatesach Centrum, Rzeszów', '50.0462203,21.9972213', 'AKTYWNY', 6, 11),
('RZE25M', 'Przy sklepie meblowym oraz przedszkolu, Rzeszów', '50.0548834,21.9729778', 'AKTYWNY', 14, 7),
('RZE08M', 'Przy parkingu sklepu Lidl, Rzeszów', '50.0502553,22.0011269', 'AKTYWNY', 4, 5),
('RZE34M', 'Z boku sklepu od strony magazynu, Rzeszów', '50.058425,21.9841145', 'AKTYWNY', 12, 11),
('RZE14N', 'Agencja Waldi przy przystanku autobusowym, Rzeszów', '50.0589057,21.9541531', 'AKTYWNY', 8, 13),
('RZE22M', 'Przy stacji Watkem, Rzeszów', '50.0584425,22.024077', 'AKTYWNY', 16, 8),
('RZE49M', 'Przy Outlet Sknerus, Rzeszów', '49.9979985,21.9573234', 'AKTYWNY', 12, 11),
('RZE48M', 'Przy sklepie Spiżarnia, Rzeszów', '50.0341308,21.9731123', 'AKTYWNY', 4, 8),
('RZE47M', 'Przy sklepie Nasz Sklep Śnieżynka, Rzeszów', '50.0141154,22.0169305', 'AKTYWNY', 10, 5),
('RZE66M', 'Z tyłu za budynkiem MDK, Rzeszów', '50.0612498,21.9818199', 'AKTYWNY', 10, 6),
('RZE57M', 'Przy Pasażu Handlowy, Rzeszów', '50.0433549,21.9867314', 'AKTYWNY', 8, 13),
('RZE54M', 'Przy stacji paliw Watkem, Rzeszów', '49.9871138,22.0178689', 'AKTYWNY', 6, 14),
('RZE09BAPP', 'Na parkingu Lidl, Rzeszów', '49.9765272,22.0253469', 'AKTYWNY', 8, 14),
('SZC102M', 'Przy sklepie Społem, Szczecin', '53.4325218,14.5038013', 'AKTYWNY', 8, 8),
('SZC19A', 'Przy Centrum Handlowym Manhattan, Szczecin', '53.4429924,14.5515778', 'AKTYWNY', 12, 5),
('SZC45M', 'Przy parkingu biurowca Oxygen, Szczecin', '53.4354268,14.5554131', 'AKTYWNY', 16, 6),
('SZC26A', 'Przed zakładem wulkanizacyjnym, Szczecin', '53.4948575,14.4802409', 'AKTYWNY', 10, 8),
('SZC07H', 'W Lokalu, Szczecin', '53.3952791,14.4915777', 'AKTYWNY', 14, 10),
('SZC06H', 'W lokalu, Szczecin', '53.450131,14.5737015', 'AKTYWNY', 8, 9),
('SZC116M', 'Przy Outlecie Velpa, Szczecin', '53.4550865,14.4775641', 'AKTYWNY', 4, 8),
('SZC75M', 'Na parkingu przy stacji kolejowej PKP Szczecin Zdroje, Szczecin', '53.3788644,14.6362481', 'AKTYWNY', 8, 9),
('SZC21L', 'na posesji, Szczecin', '53.3791277,14.6325736', 'AKTYWNY', 8, 13),
('SZC154M', 'Przy domu studenckim, Szczecin', '53.4523,14.5378259', 'AKTYWNY', 16, 8),
('TOR12N', 'Przy markecie Decathlon, Toruń', '53.0230959,18.6418677', 'AKTYWNY', 6, 9),
('TOR16A', 'Na parkingu przy parking CUK, Toruń', '53.0138684,18.5914462', 'AKTYWNY', 4, 6),
('TOR18M', 'Na parkingu, Toruń', '53.0129643,18.5702247', 'AKTYWNY', 8, 12),
('TOR21N', 'Przy banku PKO SA i przychodni, Toruń', '52.9935801,18.5957751', 'AKTYWNY', 12, 14),
('TOR42M', 'na parkingu Polomarket, Toruń', '53.0255241,18.6168596', 'AKTYWNY', 12, 14),
('TOR29M', 'Na parkingu Kaufland, Toruń', '53.0169784,18.5894508', 'AKTYWNY', 10, 9),
('TOR10N', 'pasaż handlowy Stacja Północ, Toruń', '53.0331357,18.5880355', 'AKTYWNY', 8, 11),
('TOR02A', 'Przy markecie Twój Market, Toruń', '53.0202862,18.6015897', 'AKTYWNY', 14, 12),
('TOR41M', 'przy pawilonie Maciej, Toruń', '53.0232535,18.6766367', 'AKTYWNY', 14, 11),
('TOR06M', 'Za cukiernią, Toruń', '53.0192895,18.6130161', 'AKTYWNY', 10, 11),
('TOR22M', 'Przy sklepie spożywczym ABC, Toruń', '53.0284236,18.5913375', 'AKTYWNY', 10, 6),
('TOR18A', 'Przy Intermarche, Toruń', '53.0418601,18.5980122', 'AKTYWNY', 8, 9),
('TOR43M', 'na parkingu Polomarket, Toruń', '52.9937138,18.5939878', 'AKTYWNY', 8, 5),
('TOR26N', 'Przy Kościele, Toruń', '53.041394,18.5805232', 'AKTYWNY', 6, 6),
('TOR15N', 'Przy posesji prywatnej, Toruń', '53.0171558,18.6340803', 'AKTYWNY', 8, 6),
('TOR32N', 'Przy sklepie Żabka, Toruń', '53.0120599,18.5766936', 'AKTYWNY', 16, 14),
('TOR44M', 'na parkingu Polomarket, Toruń', '53.0177367,18.5642851', 'AKTYWNY', 14, 6),
('TOR08A', 'Stacja BP, Toruń', '53.0249414,18.6644074', 'AKTYWNY', 6, 12),
('TOR28M', 'Przy markecie Torimpex, Toruń', '53.0258279,18.6123198', 'AKTYWNY', 10, 8),
('TOR18N', 'Przy sklepie Żabka, Toruń', '53.0211245,18.5836911', 'AKTYWNY', 14, 9),
('TOR03A', 'Przy markecie Netto, Toruń', '53.0165132,18.6076677', 'AKTYWNY', 6, 14),
('TOR53M', 'na parkingu sklepu, Toruń', '52.9969443,18.6217673', 'AKTYWNY', 4, 13),
('TOR16N', 'Przy salonie BRW, Toruń', '52.9962005,18.6246996', 'AKTYWNY', 14, 11),
('TOR47M', 'Przy sklepie spożywczym, Toruń', '52.9948981,18.6236767', 'AKTYWNY', 8, 11),
('TOR20M', 'Obok myjni samochodowej, Toruń', '52.9947131,18.6171581', 'AKTYWNY', 10, 8),
('TOR01M', 'Na parkingu przy administracji SM Rubinkowo, Toruń', '53.0285345,18.6714076', 'AKTYWNY', 14, 7),
('TOR29N', 'Przy sklepie Aldi, Toruń', '53.0352203,18.5996504', 'AKTYWNY', 12, 14),
('TOR24N', 'Przy piekarni U Dziadka, Toruń', '53.0246731,18.6111685', 'AKTYWNY', 14, 5),
('TOR31N', 'Przy sklepie Żabka, Toruń', '53.0234418,18.6503917', 'AKTYWNY', 6, 5),
('TOR06A', 'Przy sklepie Carrefour, Toruń', '53.0240127,18.6758013', 'AKTYWNY', 10, 6),
('TOR34M', 'na parkingu Toruń Plaza, Toruń', '53.0152764,18.5632468', 'AKTYWNY', 16, 9),
('TOR52M', 'przy bloku nr 42, Toruń', '52.9833462,18.6836563', 'AKTYWNY', 12, 9),
('TOR09M', 'Na parkingu Piotr i Paweł od strony Wielkiego Rowu, Toruń', '53.0331898,18.6026164', 'AKTYWNY', 12, 11),
('TOR06N', 'Przy parkingu firmy Sellmet, Toruń', '53.0440066,18.6265053', 'AKTYWNY', 4, 8),
('TOR04N', 'Stacja paliw AMIC ENERGY, Toruń', '53.0137418,18.5843307', 'AKTYWNY', 4, 13),
('TOR15M', 'Na parkingu sklepu Lidl, Toruń', '52.9909303,18.6325803', 'AKTYWNY', 14, 8),
('TOR27M', 'Na parkingu sklepu Torimpex, Toruń', '53.0285101,18.6740941', 'AKTYWNY', 4, 9),
('TOR02M', 'Przy sklepie Sumik, Toruń', '53.0284531,18.6612385', 'AKTYWNY', 16, 13),
('WAW195AP', 'Stacja paliw BP, Warszawa', '52.2193286,20.9152087', 'AKTYWNY', 4, 8),
('WAW730M', 'Warszawa, Bełdan 2, Warszawa', '52.1713436,21.0104714', 'AKTYWNY', 14, 12),
('WAW105A', 'Stacja paliw Circle K, Warszawa', '52.2925691,21.0509731', 'AKTYWNY', 14, 11),
('WAW11AP', 'Stacja Paliw BP, Warszawa', '52.3200876,20.9711438', 'AKTYWNY', 10, 14),
('WAW129A', 'Stacja Circle K, Warszawa', '52.2999841,21.0360944', 'AKTYWNY', 4, 13),
('WAW16A', 'Stacja paliw BP, Warszawa', '52.1848546,20.9546322', 'AKTYWNY', 12, 13),
('WAW207AP', 'Stacja paliw AMIC ENERGY, Warszawa', '52.3467481,20.9477044', 'AKTYWNY', 8, 11),
('WAW18A', 'Przy stacji BP, po lewej stronie od wejścia, Warszawa', '52.3034387,20.9878037', 'AKTYWNY', 16, 10),
('WAW02B', 'Biurowiec PLL Lot, Warszawa', '52.1828663,20.9694723', 'AKTYWNY', 10, 5),
('WAW72AP', 'Przy Drogerii Rossmann, Warszawa', '52.1894246,20.9581512', 'AKTYWNY', 4, 9),
('WAW20A', 'Przy sklepie Nikon, Warszawa', '52.1947712,20.9407163', 'AKTYWNY', 10, 8),
('WAW21A', 'Przy wejściu do budynku Tajfun, Warszawa', '52.2021759,20.9397908', 'AKTYWNY', 14, 7),
('WAW70A', 'Na parkingu, Warszawa', '52.2017984,20.95214', 'AKTYWNY', 16, 7),
('WAW27B', 'Przy Hotelu Novotel Warsaw Airport, Warszawa', '52.1905462,20.9803841', 'AKTYWNY', 6, 10),
('WAW17M', 'Przy parkingu na terenie Business Garden II, Warszawa', '52.189792,20.9819411', 'AKTYWNY', 12, 5),
('WAW05B', 'Przy budynku Administracji SM Miła, Warszawa', '52.2465989,20.987766', 'AKTYWNY', 8, 12),
('WAW52A', 'Przy bloku mieszkalnym, Warszawa', '52.2500354,20.9841124', 'AKTYWNY', 8, 14),
('WAW127AP', 'Stacja paliw Shell, Warszawa', '52.2745268,21.0302869', 'AKTYWNY', 10, 12),
('WAW139AP', 'Przy parkingu na ulicy Kinowa 19, Warszawa', '52.2424897,21.0710121', 'AKTYWNY', 16, 13),
('WAW13B', 'Przy sklepie Netto, Warszawa', '52.3243154,21.0644818', 'AKTYWNY', 16, 13),
('WAW11A', 'Przy markecie, Warszawa', '52.239535,20.9066356', 'AKTYWNY', 12, 9),
('WAW91A', 'Przy SBM Ruda, Warszawa', '52.2813092,20.9766091', 'AKTYWNY', 16, 8),
('WAW58N', 'Stacja paliw Circle K, Warszawa', '52.1987029,21.0232526', 'AKTYWNY', 8, 12),
('WAW436', 'Stacja paliw Circle K, Warszawa', '52.3151735,20.9775151', 'AKTYWNY', 4, 7),
('WAW124A', 'obok baru Pod Dębami, Warszawa', '52.3314529,20.9535312', 'AKTYWNY', 10, 11),
('WAW118A', 'Przy Sklepie Doroty, Warszawa', '52.2780824,20.9802285', 'AKTYWNY', 6, 11),
('WAW698M', 'Obok wjazdu na parking od strony ulicy Tokarz, Warszawa', '52.2972533,21.0490476', 'AKTYWNY', 6, 6),
('WAW150A', 'Przy markecie Lewiatan, Warszawa', '52.339757,21.0481499', 'AKTYWNY', 10, 9),
('WAW43N', 'Przy piekarni Putka, Warszawa', '52.2475026,20.9162613', 'AKTYWNY', 12, 11),
('WAW757M', 'Za sklepem, Warszawa', '52.2853579,20.9781813', 'AKTYWNY', 14, 9),
('WAW120A', 'Przy myjni samochodowej, Warszawa', '52.3321847,20.954566', 'AKTYWNY', 8, 8),
('WAW85AP', 'Stacja paliw BP, Warszawa', '52.1934437,20.92362', 'AKTYWNY', 6, 14),
('WAW142AP', 'Kleszczowa 24, Warszawa', '52.1981173,20.9192385', 'AKTYWNY', 6, 11),
('WAW64M', 'Przy sklepie Lidl, Warszawa', '52.2508218,20.9390744', 'AKTYWNY', 14, 13),
('WAW42AP', 'Stacja paliw BP, Warszawa', '52.1765395,20.9432729', 'AKTYWNY', 14, 12),
('WAW13M', 'Przy sklepie Społem, Warszawa', '52.2475387,20.9556854', 'AKTYWNY', 14, 6),
('WAW78H', 'w lokalu użytkowym, Warszawa', '52.2349606,21.0157366', 'AKTYWNY', 6, 7),
('WAW02AP', 'Przy Administracji Osiedla Żoliborz II, Warszawa', '52.2603426,20.9828013', 'AKTYWNY', 10, 8),
('WAW07A', 'Przy Pasażu Handlowym, Warszawa', '52.2650404,20.9714424', 'AKTYWNY', 10, 8),
('WAW12AP', 'Przy parkingu strzeżonym, Warszawa', '52.2655725,20.9730667', 'AKTYWNY', 14, 10),
('WAW68M', 'Przy prywatnym parkingu, Warszawa', '52.282617,20.9751101', 'AKTYWNY', 12, 13),
('WAW83M', 'Przy Aptece Głównej, Warszawa', '52.2486564,21.0922711', 'AKTYWNY', 8, 5),
('WAW78N', 'Przy markecie Auchan, Warszawa', '52.2939491,21.0009138', 'AKTYWNY', 6, 12),
('WAW71A', 'Przy Selen Materace i Credit Agricole, Warszawa', '52.2455696,21.075754', 'AKTYWNY', 10, 8),
('WAW85M', 'Na parkingu Lidla, Warszawa', '52.1916909,20.9581615', 'AKTYWNY', 4, 7),
('WAW110M', 'W pobliżu kładki dla pieszych nad Al. 4 czerwca 1989 r, Warszawa', '52.2051963,20.8922893', 'AKTYWNY', 4, 7),
('WAW96M', 'Na parkingu myjni samochodowej, Warszawa', '52.2228962,20.9314758', 'AKTYWNY', 4, 14),
('WAW149A', 'Na parkingu przy Costa Coffee, Warszawa', '52.2520146,20.915026', 'AKTYWNY', 14, 6),
('WAW48N', 'Przy budynku handlowym, Warszawa', '52.2578785,20.9179284', 'AKTYWNY', 12, 7),
('WAW126M', 'Na myjni bezdotykowej, Warszawa', '52.199285,20.8733548', 'AKTYWNY', 10, 8),
('WAW66M', 'Przy administracji osiedla Bemowo IV, obok parkingu, Warszawa', '52.2566972,20.9253421', 'AKTYWNY', 12, 13),
('WAW75A', 'Przy Centrum Handlowym Bemowo, Warszawa', '52.2644383,20.9313781', 'AKTYWNY', 6, 7),
('WAW161M', 'Przy stacji Shell, po prawej stronie budynku, Warszawa', '52.298206,21.0323391', 'AKTYWNY', 16, 6),
('WAW135AP', 'Stacja paliw BP, Warszawa', '52.3079465,21.0824316', 'AKTYWNY', 10, 5),
('WAW192M', 'Na szczycie budynku Gwiaździsta 13, Warszawa', '52.2792856,20.9849784', 'AKTYWNY', 14, 12),
('WAW106M', 'Przy sklepie Żabka, Warszawa', '52.2528381,21.0837584', 'AKTYWNY', 12, 12),
('WAW123M', 'Przy parkingu Warszawa Górczewska 228D, Warszawa', '52.2405546,20.8990841', 'AKTYWNY', 14, 6),
('WAW738M', 'Przy wejściu do Aldi, Warszawa', '52.1560093,21.0359105', 'AKTYWNY', 12, 13),
('WAW106A', 'Na stacji Circle K, Warszawa', '52.2528316,20.981802', 'AKTYWNY', 4, 7),
('WAW142A', 'W Przy Centrum Handlowym Factory, Warszawa', '52.2000568,20.894787', 'AKTYWNY', 6, 12),
('WAW271M', 'Na parkingu stacji benzynowej Shell, Warszawa', '52.1994474,20.8922016', 'AKTYWNY', 14, 14),
('WAW84M', 'Na parkingu sklepu Lidl, Warszawa', '52.1972134,20.8826048', 'AKTYWNY', 4, 7),
('WAW139A', 'Przy Żabce, Warszawa', '52.2085423,20.8958317', 'AKTYWNY', 12, 10),
('WAW153A', 'Na terenie bazaru przy Pizzerii, Warszawa', '52.1945296,20.8744833', 'AKTYWNY', 6, 6),
('WAW772M', 'Przy Carrefourze, Warszawa', '52.1963625,20.8787379', 'AKTYWNY', 12, 5),
('WAW57N', 'Przy markecie Biedronce, Warszawa', '52.1941931,20.8686936', 'AKTYWNY', 8, 11),
('WAW156A', 'Za sklepem Margot, Warszawa', '52.1912814,20.8665599', 'AKTYWNY', 4, 6),
('WAW35M', 'Przy galerii Gawra, Warszawa', '52.1957777,20.8636927', 'AKTYWNY', 14, 8),
('WAW97N', 'Stacja paliw AMIC ENERGY, Warszawa', '52.2173442,20.8992334', 'AKTYWNY', 12, 8),
('WAW54A', 'Obok towarzystwa ubezpieczeniowego WARTA, Warszawa', '52.2176377,20.8994356', 'AKTYWNY', 16, 8),
('WAW45M', 'Za sklepem Lidl od strony parkingu, Warszawa', '52.219993,20.8957841', 'AKTYWNY', 10, 11),
('WAW32B', 'Na myjni Auqua, Warszawa', '52.2313957,20.8965089', 'AKTYWNY', 14, 11),
('WAW10N', 'Po prawej stronie budynku Kaufland, Warszawa', '52.2308345,20.8951418', 'AKTYWNY', 8, 13),
('WAW129M', 'Przy sklepie Warus, Warszawa', '52.1954588,20.8968205', 'AKTYWNY', 4, 10),
('WAW273M', 'Szczyt budynku Warszawskiej Wyższej Szkoły Informatycznej, Warszawa', '52.2488277,20.9887397', 'AKTYWNY', 10, 11),
('WAW286M', 'Za budynkiem mieszkalnym przy ul.Niskiej 3A, Warszawa', '52.2518956,20.9903993', 'AKTYWNY', 16, 8),
('WAW87AP', 'Przy parkingu, naprzeciwko budynku Broniewskiego 26, Warszawa', '52.2668326,20.9648732', 'AKTYWNY', 4, 14),
('WAW195M', 'Z tyłu budynku przy wjeździe na parking podziemny, Warszawa', '52.1952177,20.9679452', 'AKTYWNY', 4, 10),
('WAW228AP', 'Przy firmie Hit-Car, Warszawa', '52.262009,21.024891', 'AKTYWNY', 12, 5),
('WAW11H', 'Przejazd 2, Warszawa', '52.1921377,20.9876246', 'AKTYWNY', 10, 6),
('WAW16M', 'Przy lokalu z kebabem, Warszawa', '52.2885255,20.9410634', 'AKTYWNY', 12, 9),
('WAW530M', 'Naprzeciwko Szkoły podstawowej nr 353, Warszawa', '52.2190629,21.2345417', 'AKTYWNY', 16, 13),
('WAW142M', 'Naprzeciwko restauracji Koneser Grill, Warszawa', '52.2549919,21.0436371', 'AKTYWNY', 4, 7),
('WAW338M', 'Za sklepem Carrefour Express, Warszawa', '52.2069414,20.8951326', 'AKTYWNY', 10, 6),
('WAW01APP', 'Przy sklepie Top Market, Warszawa', '52.3394361,20.9390155', 'AKTYWNY', 12, 9),
('WAW352M', 'Przy Galerii Łopuszańska 22, Warszawa', '52.1925199,20.9521052', 'AKTYWNY', 14, 9),
('WAW391M', 'Przy budynku usługowym, Warszawa', '52.2735044,20.9312198', 'AKTYWNY', 6, 6),
('WAW395M', 'Przy budynku usługowym, Warszawa', '52.2760999,20.9275869', 'AKTYWNY', 14, 5),
('WAW74N', 'Przy sklepie Ceramix, Warszawa', '52.2679531,20.9570329', 'AKTYWNY', 8, 8),
('WAW386M', 'Przy pasażu handlowym, po wschodniej stronie budynku, Warszawa', '52.2711636,20.9457345', 'AKTYWNY', 14, 13),
('WAW24B', 'Stacja paliw MOL, Warszawa', '52.1912556,20.9502396', 'AKTYWNY', 6, 10),
('WAW342M', 'Od ul. Hetmańskiej, Warszawa', '52.2453909,21.1106397', 'AKTYWNY', 14, 14),
('WAW185M', 'Na tylnej (południowej) ścianie budynku, Warszawa', '52.1313265,21.0712024', 'AKTYWNY', 8, 9),
('WAW496M', 'Prywatna posesja, Warszawa', '52.2061154,20.8633147', 'AKTYWNY', 10, 8),
('WAW32N', 'Przy sklepie Lewiatan, Warszawa', '52.3366754,20.9893851', 'AKTYWNY', 14, 9),
('WAW109M', 'Przed wejściem do sklepu Carrefour, Warszawa', '52.2445985,21.0049671', 'AKTYWNY', 4, 8),
('WAW42A', 'Po prawej stronie budynku wspólnoty mieszkaniowej, Warszawa', '52.1879837,20.8985834', 'AKTYWNY', 8, 13),
('WAW180M', 'Przy osiedlu Skoroszewska 7 na rogu ulic Hassa i Składkowskiego, Warszawa', '52.1877701,20.8982778', 'AKTYWNY', 16, 5),
('WAW122M', 'Na rogu budynku Allianz, po lewej stronie wejścia. Przy skrzyżowaniu, Warszawa', '52.1811543,21.0057625', 'AKTYWNY', 16, 10),
('WAW370M', 'Przed sklepem rowerowym KOMOBIKE, Warszawa', '52.1866042,20.9067419', 'AKTYWNY', 12, 13),
('WAW369M', 'Przy przedszkolu, Warszawa', '52.1879553,20.9086522', 'AKTYWNY', 10, 14),
('WAW803M', 'Przy sklepie Żabka, Warszawa', '52.1881836,20.9079646', 'AKTYWNY', 16, 10),
('WAW75M', 'Na tylnym parkingu sklepu Lidl, Warszawa', '52.2087045,20.9216109', 'AKTYWNY', 4, 10),
('WAW447M', 'przy ulicy na posesji prywatnej, Warszawa', '52.2468833,21.0566583', 'AKTYWNY', 8, 9),
('WAW91M', 'Przy sklepie Lidl, Warszawa', '52.1827585,20.8932', 'AKTYWNY', 16, 8),
('WAW35B', 'Przy sklepie WSM Ochota, Warszawa', '52.1952884,20.9634932', 'AKTYWNY', 8, 8),
('WAW403M', 'na ścianie pawilonu handlowo usługowego, Warszawa', '52.2861798,20.9378182', 'AKTYWNY', 10, 10),
('WAW06N', 'Stacja paliw BP, Warszawa', '52.3055989,20.9888052', 'AKTYWNY', 10, 14),
('WAW141M', 'Na parkingu Galerii Północnej od ulicy Trakt Nadwiślański, Warszawa', '52.3168816,20.965616', 'AKTYWNY', 14, 5),
('WAW463M', 'Na terenie posesji budynku biurowego, Warszawa', '52.1697774,21.0768874', 'AKTYWNY', 6, 11),
('WAW475M', 'Przy budynku Jana Kazimierza 45 od ulicy Sowińskiego, Warszawa', '52.2216765,20.9369599', 'AKTYWNY', 12, 5),
('WAW538M', 'Od ulicy Rakowskiej, Warszawa', '52.1990693,20.9532261', 'AKTYWNY', 14, 14),
('WAW477M', 'Przy parkingu budynku biurowego, Warszawa', '52.2064601,20.8585168', 'AKTYWNY', 16, 6),
('WAW18H', 'W lokalu, Warszawa', '52.1951579,20.8608467', 'AKTYWNY', 6, 10),
('WAW368M', 'Na ścianie z boku sklepu, Warszawa', '52.1964658,20.8664799', 'AKTYWNY', 12, 13),
('WAW548M', 'Przy Stadionie Przyszłość Włochy, Warszawa', '52.205828,20.9037241', 'AKTYWNY', 14, 13),
('WAW189M', 'Przy sklepie Nastrój - Sklep i Chleb, Warszawa', '52.2103515,20.9159133', 'AKTYWNY', 4, 12),
('WAW200M', 'Obok sklepu z warzywami, Warszawa', '52.2055255,20.9176014', 'AKTYWNY', 6, 6),
('WAW84AP', 'Przy CH Społem, Warszawa', '52.1975065,20.9239852', 'AKTYWNY', 4, 5),
('WAW420M', 'Przy ścianie lokalu gastronomicznego, Warszawa', '52.1984372,20.9131497', 'AKTYWNY', 6, 11),
('WAW128M', 'Przy kawiarni Stolica Lodów i Pączków, Warszawa', '52.1944418,20.9003847', 'AKTYWNY', 14, 7),
('WAW51N', 'Przy Apartamentach Magnolie, Warszawa', '52.1938355,20.9084063', 'AKTYWNY', 14, 9),
('WAW113A', 'Przy osiedlu mieszkaniowym, Warszawa', '52.1868707,20.8963681', 'AKTYWNY', 10, 11),
('WAW127M', 'Przy wejściu na teren os. Skoroszewska 1 od ul. Chełmońskiego, Warszawa', '52.1918431,20.9021964', 'AKTYWNY', 6, 7),
('WAW298M', 'Na parkingu obok budki z ubezpieczeniami, Warszawa', '52.1930979,20.8987297', 'AKTYWNY', 6, 5),
('WAW258M', 'Przy budynku ochrony, obok wjazdu na osiedle, Warszawa', '52.333844,20.9732001', 'AKTYWNY', 4, 14),
('WAW364M', 'Skrzyżowanie ulic Pomorskiej z Modlińską, Warszawa', '52.3313885,20.964911', 'AKTYWNY', 16, 11),
('WAW454M', 'Przy sklepie spożywczym, na końcu parkingu, Warszawa', '52.3216087,20.9724787', 'AKTYWNY', 8, 13),
('WAW88AP', 'Na osiedlu mieszkaniowym, Warszawa', '52.3221371,20.9510426', 'AKTYWNY', 6, 5),
('WAW143A', 'Przy Parkingu strzeżonym, Warszawa', '52.3316868,20.9447972', 'AKTYWNY', 6, 13),
('WAW33AP', 'Na osiedlu mieszkaniowym, Warszawa', '52.3322232,20.9407762', 'AKTYWNY', 16, 6),
('WAW304M', 'Przy sklepie Lidl, po lewej stronie budynku, Warszawa', '52.3237542,20.9393969', 'AKTYWNY', 10, 6),
('WAW144A', 'Przy markecie Kaufland, Warszawa', '52.2421791,21.1612786', 'AKTYWNY', 12, 6),
('WAW26N', 'Przy szkole języka angielskiego, Warszawa', '52.1842192,20.8700691', 'AKTYWNY', 4, 11),
('WAW23B', 'Przy Hoteliku 39, Warszawa', '52.1741471,20.9225855', 'AKTYWNY', 10, 7),
('WAW545M', 'od ulicy Potockiej przy bramie wjazdowej, Warszawa', '52.2777006,20.9858056', 'AKTYWNY', 8, 11),
('WAW130A', 'Przy Centrum Handlowym Białołęcka, Warszawa', '52.316904,21.0302833', 'AKTYWNY', 12, 5),
('WAW571M', 'Przy parku handlowym, Warszawa', '52.2060261,20.8827161', 'AKTYWNY', 8, 12),
('WAW62N', 'Przy budynku spółdzielni, Warszawa', '52.2905295,20.9374914', 'AKTYWNY', 16, 10),
('WAW154AP', 'Osiedle mieszkaniowe, Warszawa', '52.2266388,20.90415', 'AKTYWNY', 10, 6),
('WAW487M', 'Na parkingu wewnętrznym całodobowym, Warszawa', '52.2009977,20.9669523', 'AKTYWNY', 10, 6),
('WAW347M', 'Na myjni, Warszawa', '52.222873,20.9312992', 'AKTYWNY', 8, 9),
('WAW614M', 'Przy sklepie Lidl, Warszawa', '52.2829229,21.0328633', 'AKTYWNY', 12, 6),
('WAW34N', 'Przy sklepie Groszek, Warszawa', '52.280397,21.0689395', 'AKTYWNY', 10, 9),
('WAW166M', 'Przed bramą wjazdową od ul. Targowej, Warszawa', '52.2502612,21.0418637', 'AKTYWNY', 12, 9),
('WAW384M', 'BOCZNA ŚCIANA SKLEPU, Warszawa', '52.2385319,20.9472338', 'AKTYWNY', 12, 14),
('WAW83AP', 'Na osiedlu mieszkaniowym, Warszawa', '52.2472746,21.1325126', 'AKTYWNY', 8, 9),
('WAW77A', 'Przy kwiaciarni A.Szewczyk, na rogu ulic Braci Załuskich i Broniewskiego, Warszawa', '52.2655908,20.9689829', 'AKTYWNY', 4, 7),
('WAW67A', 'Przy ścianie po prawej stronie od wejścia głównego, Warszawa', '52.209266,20.950725', 'AKTYWNY', 8, 6),
('WAW65A', 'Przy sklepie ABC, Warszawa', '52.2810297,21.0786375', 'AKTYWNY', 10, 6),
('WAW60M', 'Między budynkami 37B i 37A, Warszawa', '52.3228911,20.9589857', 'AKTYWNY', 10, 8),
('WAW565M', 'Na terenie posesji prywatnej, Warszawa', '52.2447766,21.1891535', 'AKTYWNY', 8, 13),
('WAW55AP', 'Biurowiec, Warszawa', '52.1830433,20.9653668', 'AKTYWNY', 16, 13),
('WAW54M', 'Przy sklepie Lidl, Warszawa', '52.3630291,21.0285234', 'AKTYWNY', 12, 9),
('WAW51M', 'Za sklepem Lewiatan, Warszawa', '52.2798951,21.0556085', 'AKTYWNY', 12, 12),
('WAW50M', 'Przy Lidlu, Warszawa', '52.2582933,21.1580387', 'AKTYWNY', 14, 5),
('WAW486M', 'Parking przy wejściu do NETTO, Warszawa', '52.2573195,21.1677251', 'AKTYWNY', 12, 6),
('WAW47M', 'Na Parkingu sklepu Lidl, Warszawa', '52.2684067,21.0618736', 'AKTYWNY', 8, 6),
('WAW46A', 'Za parkiem handlowym City Park, Warszawa', '52.2291874,20.8951137', 'AKTYWNY', 6, 9),
('WAW460M', 'Na działce, Warszawa', '52.2784611,21.0574934', 'AKTYWNY', 8, 10),
('WAW456M', 'Na działce, przy ulicy, Warszawa', '52.34015,21.03645', 'AKTYWNY', 12, 8),
('WAW449M', 'Przy budynku ochrony, obok szlabanu, Warszawa', '52.3453416,21.0540717', 'AKTYWNY', 16, 13),
('WAW431M', 'przy wjeździe do warsztatu, Warszawa', '52.2737223,21.0372275', 'AKTYWNY', 16, 13),
('WAW422M', 'przy zakładzie pogrzebowym, Warszawa', '52.2634618,21.15717', 'AKTYWNY', 6, 10),
('WAW400M', 'Na tyłach klubu sportowego, Warszawa', '52.2521795,20.9123458', 'AKTYWNY', 14, 5),
('WAW39B', 'Przy sklepie spożywczym Asia, Warszawa', '52.2835502,21.0556574', 'AKTYWNY', 8, 12),
('WAW383M', 'Przy rozdzielni elektrycznej, Warszawa', '52.26684,20.94949', 'AKTYWNY', 8, 14),
('WAW37N', 'Przy sklepie Społem, Warszawa', '52.276573,20.9489041', 'AKTYWNY', 16, 8),
('WAW371M', 'Przy przedszkolu, po prawej stronie działki, Warszawa', '52.32175,21.0700171', 'AKTYWNY', 12, 8),
('WAW353M', 'Przy budynku hydroforni, Warszawa', '52.2491801,20.9143514', 'AKTYWNY', 14, 9),
('WAW34B', 'Przy Centrum Handlowym Warszawa - Rembertów, Warszawa', '52.2710189,21.1499071', 'AKTYWNY', 10, 11),
('WAW349M', 'Przy sklepie Żabka z lewej strony budynku, Warszawa', '52.1857905,20.885264', 'AKTYWNY', 4, 6),
('WAW343M', 'Przy budynku Kickiego 21 A, Warszawa', '52.2518634,21.0791509', 'AKTYWNY', 4, 14),
('WAW33B', 'Przy sklepie Żabka, Warszawa', '52.1942888,20.8889128', 'AKTYWNY', 16, 11),
('WAW339M', 'AK-POL AKUMULATORY OLEJE BEMOWO, Warszawa', '52.217476,20.8996355', 'AKTYWNY', 6, 10),
('WAW337M', 'Pojedynczy paczkomat w kształcie L, Warszawa', '52.130255,21.0560887', 'AKTYWNY', 8, 10),
('WAW323M', 'Przy przychodni weterynaryjnej, Warszawa', '52.2686793,20.9687108', 'AKTYWNY', 10, 5),
('WAW31M', 'Przy lokalu Ośrodka Szkolenia Kierowców Sorsey, Warszawa', '52.2272107,20.9165523', 'AKTYWNY', 16, 14),
('WAW318M', 'ul. Magenta 101, Warszawa', '52.2674512,21.147384', 'AKTYWNY', 6, 13),
('WAW313M', 'Przy Nozomi Sushi, Warszawa', '52.3519387,21.0534067', 'AKTYWNY', 6, 9),
('WAW312M', 'Przy restauracji Thai Feel Ursus, Warszawa', '52.1937727,20.8833681', 'AKTYWNY', 4, 10),
('WAW311M', 'Za Delikatesami Jago, między pawilonami, Warszawa', '52.2661799,20.9751088', 'AKTYWNY', 16, 14),
('WAW299M', 'Przy budynku nr. 10, obok ronda, Warszawa', '52.2773911,21.0862093', 'AKTYWNY', 14, 11),
('WAW292M', 'Obok Bloku Warszawa Puszczy Solskiej 8, Warszawa', '52.22738,20.90792', 'AKTYWNY', 4, 6),
('WAW291M', 'Na pasie zieleni przy budynku mieszkalnym, Warszawa', '52.2245418,20.9120022', 'AKTYWNY', 16, 10),
('WAW288M', 'Przy budynku usługowym Górczewska 129, Warszawa', '52.2391315,20.9405586', 'AKTYWNY', 4, 6),
('WAW282M', 'Paderewskiego 74 A, Warszawa', '52.2661652,21.1550164', 'AKTYWNY', 8, 11),
('WAW269M', 'Przy budynku nr. 43, obok ścieżki rowerowej, Warszawa', '52.3156445,21.0724166', 'AKTYWNY', 14, 8),
('WAW264M', 'przy wejściu do klatki schodowej przy bramie awaryjnej, Warszawa', '52.2925139,21.0468707', 'AKTYWNY', 6, 5),
('WAW263M', 'Na pasie zieleni obok hydroforni, Warszawa', '52.2269444,20.9118907', 'AKTYWNY', 12, 11),
('WAW255M', 'Przy budynku handlowo-usługowym, Warszawa', '52.2418975,21.1217948', 'AKTYWNY', 4, 5),
('WAW250M', 'Na Parkingu od strony Sabały, Warszawa', '52.1900712,20.9598856', 'AKTYWNY', 12, 8),
('WAW241M', 'Przy wjeździe na teren Auto Dar, Warszawa', '52.2438772,21.1355667', 'AKTYWNY', 16, 6),
('WAW231M', 'Za budynkiem stacji benzynowej, Warszawa', '52.2482563,20.9124956', 'AKTYWNY', 6, 11),
('WAW219AP', 'Przy ścianie po lewej stronie wjazdu na teren WM Zawiszy 16, Warszawa', '52.2436579,20.9593936', 'AKTYWNY', 4, 5),
('WAW215M', 'Po prawej stronie budynku A, Warszawa', '52.1949856,20.9311706', 'AKTYWNY', 12, 6),
('WAW208M', 'Za szlabanem, przy budynku ochrony, Warszawa', '52.2746064,20.997398', 'AKTYWNY', 16, 7),
('WAW190M', 'Przy wiacie śmietnikowej od strony Pełczyńskiego, Warszawa', '52.241997,20.9061945', 'AKTYWNY', 4, 10),
('WAW18B', 'Prywatna posesja, Warszawa', '52.2731213,20.9117273', 'AKTYWNY', 4, 12),
('WAW183M', 'Z boku budynku przy parkingu, Warszawa', '52.2466746,21.1878144', 'AKTYWNY', 6, 11),
('WAW179M', 'Przy budynku Marymoncka 32b, za sklepem Żabka, Warszawa', '52.2817894,20.9583845', 'AKTYWNY', 16, 6),
('WAW167M', 'W pasażu handlowym na przeciwko PKO BP, Warszawa', '52.1932599,20.8879962', 'AKTYWNY', 16, 14),
('WAW166A', 'Parking przy sklepie Al Capone, Warszawa', '52.2583959,21.1556263', 'AKTYWNY', 12, 5),
('WAW164M', 'Przy sklepie Arhelan, Warszawa', '52.2615419,20.9569189', 'AKTYWNY', 4, 14),
('WAW162M', 'NA parkingu sklepu Mok-Pol, Warszawa', '52.1893816,20.8873318', 'AKTYWNY', 4, 10),
('WAW158A', 'Przed blokiem przy ulicy Coopera 12, Warszawa', '52.2374059,20.8940013', 'AKTYWNY', 14, 10),
('WAW155A', 'Na parkingu przy firmie Catzy, Warszawa', '52.2446823,21.2127931', 'AKTYWNY', 6, 8),
('WAW154A', 'Przy sklepie Filip, Warszawa', '52.2620541,21.1788692', 'AKTYWNY', 4, 5),
('WAW144M', 'Za biurowcem firmy TIMEX, Warszawa', '52.20366,20.93737', 'AKTYWNY', 14, 6),
('WAW134M', 'Za budynkiem Szaserów 111 od ul. Wspólna Droga 14, Warszawa', '52.2477606,21.0977733', 'AKTYWNY', 8, 6),
('WAW12B', 'Parking przed blokiem Coopera 12G, Warszawa', '52.2388953,20.8946579', 'AKTYWNY', 4, 5),
('WAW11N', 'Parking przed sklepem Greno, Warszawa', '52.2478093,21.1927673', 'AKTYWNY', 16, 9),
('WAW103A', 'Przy parkingu, Warszawa', '52.1877573,20.8915078', 'AKTYWNY', 4, 13),
('WAW01M', 'Przy sklepie Lidl, Warszawa', '52.2402894,20.9139445', 'AKTYWNY', 6, 10),
('WAW42APP', 'Obok budynku mieszkalnego, Warszawa', '52.2091578,20.9289278', 'AKTYWNY', 14, 5),
('PNET0930', 'Na terenie Park Warsaw, Warszawa', '52.1889792,20.9487399', 'AKTYWNY', 14, 9),
('PNET0900', 'Przy salonie Perfect Lashes, Warszawa', '52.2485038,20.9238082', 'AKTYWNY', 4, 13),
('WAW610M', 'Na parkingu przy budynku mieszkalnym, Warszawa', '52.2394858,21.1524589', 'AKTYWNY', 14, 11),
('WAW184AP', 'Przy Centrum Handlowym Społem, Warszawa', '52.2496375,21.0932111', 'AKTYWNY', 8, 7),
('WAW160A', 'Na parkingu przy sklepie Biedronka, Warszawa', '52.2496582,21.0982856', 'AKTYWNY', 8, 13),
('WAW367M', 'Przy Parafia rzymskokatolicka Bogurodzicy Maryi, Warszawa', '52.2338634,20.910566', 'AKTYWNY', 10, 7),
('WAW378M', 'Przy wjeździe na posesję, Warszawa', '52.2480602,20.9954049', 'AKTYWNY', 14, 13),
('WAW594M', 'Przed budynkiem biurowym, Warszawa', '52.2447479,21.1133694', 'AKTYWNY', 4, 13),
('WAW542M', 'W płocie, od strony ulicy Makowskiej, Warszawa', '52.2489269,21.1086333', 'AKTYWNY', 14, 6),
('WAW623M', 'Przy budynku mieszkalnym, Warszawa', '52.1884537,20.8724211', 'AKTYWNY', 16, 7),
('WAW641M', 'Przy centrum handlowo usługowym Okrąglak, Warszawa', '52.1903733,20.8931347', 'AKTYWNY', 12, 10),
('WAW573M', 'Przy skrzyżowaniu Drzymały z Sosnowskiego, Warszawa', '52.1928336,20.8864066', 'AKTYWNY', 10, 12),
('WAW433M', 'Naprzeciwko przedszkola Pomarańczowa Ciuchcia, Warszawa', '52.1964533,20.8920754', 'AKTYWNY', 14, 11),
('WAW521M', 'W linii ogrodzenia przed biurowcem od ulicy Przerwanej, Warszawa', '52.1911049,20.9179092', 'AKTYWNY', 12, 14),
('WAW572M', 'Obok Żłobka Centrum Rozwoju DaVinci, Warszawa', '52.1989434,20.9096064', 'AKTYWNY', 14, 10),
('WAW612M', 'Przy sklepie spożywczym, Warszawa', '52.2028443,20.9299213', 'AKTYWNY', 6, 9),
('WAW605M', 'Parking nieruchomosci od ul.Techników, Warszawa', '52.2043529,20.9235803', 'AKTYWNY', 14, 9),
('WAW621M', 'Przy sklepie spożywczym, Warszawa', '52.207977,20.9088771', 'AKTYWNY', 14, 10),
('WAW31H', 'Obok 4 Łapy Sklep Zoologiczny, Warszawa', '52.2087173,20.8921866', 'AKTYWNY', 16, 12),
('WAW03G', 'Przy budynku biurowym, Warszawa', '52.1968466,20.9398812', 'AKTYWNY', 12, 7),
('WAW434M', 'Trawnik w okolicach akademika, Warszawa', '52.2381867,20.9149723', 'AKTYWNY', 6, 10),
('WAW652M', 'pod scianą budynku, Warszawa', '52.1930978,20.9293936', 'AKTYWNY', 8, 9),
('WAW483M', 'Na stacji Circle K, Warszawa', '52.220467,20.9151819', 'AKTYWNY', 4, 8),
('WAW513M', 'Na działce przy wjeździe na parking podziemny, Warszawa', '52.2235491,20.9056903', 'AKTYWNY', 6, 5),
('WAW90AP', 'Osiedle mieszkaniowe, Warszawa', '52.2294248,20.9144552', 'AKTYWNY', 6, 11),
('WAW02N', 'Przy Pasażu Handlowym, Warszawa', '52.2300803,20.9141722', 'AKTYWNY', 16, 5),
('WAW262M', 'Na stacji Shell, Warszawa', '52.2307812,20.8962574', 'AKTYWNY', 6, 8),
('WAW30H', 'lokal, Warszawa', '52.2273864,20.8843405', 'AKTYWNY', 16, 14),
('WAW495M', 'Przy drogerii Rossmann, Warszawa', '52.2369589,20.9116978', 'AKTYWNY', 4, 10),
('WAW461M', 'Przy budynku Lajosa Kossutha 8 Warszawa, Warszawa', '52.237991,20.9077794', 'AKTYWNY', 16, 10),
('WAW501M', 'Przy Piekarnia SPC Sklep Firmowy, Warszawa', '52.2386518,20.9054032', 'AKTYWNY', 4, 11),
('WAW80A', 'Przy sklepie Kaufland, od ul. Pełczyńskiego, Warszawa', '52.2404351,20.9067397', 'AKTYWNY', 12, 10),
('WAW627M', 'obok Przychodni Lekarskiej Zdrowa Rodzina, Warszawa', '52.2441927,20.9065444', 'AKTYWNY', 12, 14),
('WAW448M', 'na parkingu przed sklepem Globi, Warszawa', '52.2368782,20.9183014', 'AKTYWNY', 6, 14),
('WAW319M', 'Przy wejściu do CortenMedic, Warszawa', '52.1929174,20.9910152', 'AKTYWNY', 12, 10),
('WAW544M', 'Przy miejscach parkingowych obiektu, Warszawa', '52.1774945,20.9449373', 'AKTYWNY', 14, 7),
('WAW52M', 'Na parkingu Lidla po prawej stronie budynku, Warszawa', '52.1737925,20.938167', 'AKTYWNY', 12, 12),
('WAW631M', 'Przy myjni bezdotykowej, Warszawa', '52.3344043,20.9602517', 'AKTYWNY', 10, 13),
('WAW636M', 'Przy sklepie spożywczym, Warszawa', '52.2070247,20.9069161', 'AKTYWNY', 4, 11),
('WAW628M', 'Przy sklepie delikatesy Bona, Warszawa', '52.1989829,20.8581434', 'AKTYWNY', 10, 13),
('WAW642M', 'Przy Lidlu, Warszawa', '52.2526984,21.0653521', 'AKTYWNY', 6, 7),
('WAW558M', 'przy budynku mieszkaniowym, Warszawa', '52.2991704,21.0486159', 'AKTYWNY', 8, 14),
('WAW547M', 'przy budynku mieszkaniowym, Warszawa', '52.3001735,21.0456735', 'AKTYWNY', 12, 13),
('WAW657M', 'vis a vis wejścia do Castoramy od ulicy Kompani AK Goplana, Warszawa', '52.2068155,20.8819855', 'AKTYWNY', 14, 8),
('WAW16APP', 'Przy budynku mieszkalnym, Warszawa', '52.315686,21.0227784', 'AKTYWNY', 12, 13),
('WAW52H', 'w lokalu użytkowym, Warszawa', '52.1997906,20.8871529', 'AKTYWNY', 10, 6),
('WAW03A', 'Stacja paliw BP, Warszawa', '52.2692988,20.9320476', 'AKTYWNY', 12, 6),
('WAW438M', 'Na działce, Warszawa', '52.2826502,21.0641837', 'AKTYWNY', 14, 6),
('WAW696M', 'Przy sklepie spożywczym, Warszawa', '52.2404288,21.1231422', 'AKTYWNY', 10, 13),
('WAW92N', 'Na skrzyżowaniu Gojawiczyńskiej/Tołwińskiego, obok parkingu, Warszawa', '52.2693201,20.9731804', 'AKTYWNY', 14, 6),
('WAW555M', 'przy budynku mieszkaniowym, Warszawa', '52.2928298,21.0489798', 'AKTYWNY', 10, 5),
('WAW557M', 'przy budynku mieszkaniowym, Warszawa', '52.2952325,21.050081', 'AKTYWNY', 4, 14),
('WAW401M', 'Parking przed sklepem spożywczym, Warszawa', '52.2603688,20.9759121', 'AKTYWNY', 8, 6),
('WAW693M', 'Parking Warszawa Szeligowska 47B, Warszawa', '52.2270824,20.8883137', 'AKTYWNY', 10, 11),
('WAW682M', 'Parking, Warszawa', '52.1964305,20.8585073', 'AKTYWNY', 6, 8),
('WAW91N', 'Między blokiem, a Supermarketem Auchan, Warszawa', '52.2676791,20.9633912', 'AKTYWNY', 6, 8),
('WAW511M', 'Przy budynku biurowym, Warszawa', '52.272393,21.0648539', 'AKTYWNY', 16, 13),
('WAW58H', 'W pasażu lokali usługowych, Warszawa', '52.2240622,20.8958646', 'AKTYWNY', 16, 9),
('WAW701M', 'Przy budynku usługowym, Warszawa', '52.2453835,21.086992', 'AKTYWNY', 4, 14),
('WAW618M', 'Obok wypożyczalni samochodów, Warszawa', '52.2771773,21.0680381', 'AKTYWNY', 4, 6),
('WAW175A', 'Obok Pub Butelki, Warszawa', '52.2928716,21.0327045', 'AKTYWNY', 4, 5),
('WAW11APP', 'Przy budynku administracji, Warszawa', '52.2967659,21.0418808', 'AKTYWNY', 14, 14),
('WAW535M', 'Przy bramie, od strony ulicy Gąsiorowskiej, Warszawa', '52.3519757,20.9420095', 'AKTYWNY', 10, 11),
('WAW413M', 'Na ścianie sklepu Społem Wola, Warszawa', '52.2535269,20.9804739', 'AKTYWNY', 16, 14),
('WAW46H', 'Rakowiecka 2B, Warszawa', '52.2090808,21.0157229', 'AKTYWNY', 6, 8),
('WAW691M', 'na terenie osiedla przy parkingu, Warszawa', '52.1741017,20.9980203', 'AKTYWNY', 10, 8),
('WAW385M', 'W środku osiedla, przy wiatach na śmieci, Warszawa', '52.2698031,20.9440875', 'AKTYWNY', 6, 8),
('WAW67H', 'w lokalu użytkowym, Warszawa', '52.2530968,21.0014712', 'AKTYWNY', 16, 9),
('WAW77N', 'Przy Teatrze Capitol od strony ulicy Przechodniej, Warszawa', '52.241282,21.002659', 'AKTYWNY', 16, 5),
('WAW568M', 'Przy Teatrze Capitol od strony parkingu, Warszawa', '52.2410264,21.0028875', 'AKTYWNY', 16, 12),
('WAW708M', 'Przy budynku usługowym, Warszawa', '52.229076,20.9160041', 'AKTYWNY', 4, 14),
('WAW677M', 'Na parkingu sklepu spożywczego Społem, wjazd od strony ulicy Antoniego Fontany, Warszawa', '52.2801733,20.9511394', 'AKTYWNY', 6, 13),
('WAW721M', 'Przy nieruchomości Warszawa Wolska 171, Warszawa', '52.225415,20.9399232', 'AKTYWNY', 12, 9),
('WAW54H', 'W lokalu obok Netto, Warszawa', '52.3233461,20.9444582', 'AKTYWNY', 16, 6),
('WAW08APP', 'Przy przystanku autobusowym, Warszawa', '52.3268583,20.9366515', 'AKTYWNY', 10, 12),
('WAW27H', 'W lokalu, Warszawa', '52.3098568,20.9913405', 'AKTYWNY', 8, 9),
('WAW24APP', 'Przy budynku mieszkalnym, Warszawa', '52.3365339,20.9486241', 'AKTYWNY', 6, 9),
('WAW519M', 'Na parkingu budynku handlowo-usługowego, Warszawa', '52.3104508,20.9694555', 'AKTYWNY', 4, 12),
('WAW498M', 'Na działce, Warszawa', '52.30468,20.9829935', 'AKTYWNY', 12, 14),
('WAW517M', 'Przy budynku mieszkalnym, Warszawa', '52.3038766,20.9763486', 'AKTYWNY', 4, 8),
('WAW64H', 'w lokalu, Warszawa', '52.2440493,21.0770603', 'AKTYWNY', 12, 11),
('WAW72H', 'Nowy Służewiec 21, Warszawa', '52.1643397,20.9910056', 'AKTYWNY', 16, 14),
('WAW484M', 'Na działce, Przy ulicy Kolejarskiej 14, Warszawa', '52.289771,21.074679', 'AKTYWNY', 16, 9),
('WAW62H', 'Przy salonie meblowym SolidneDrzwiOkna, Warszawa', '52.2255345,20.957177', 'AKTYWNY', 16, 10),
('WAW40HP', 'W sklepie Duży Ben, Warszawa', '52.2046889,20.8819749', 'AKTYWNY', 14, 5),
('WAW755M', 'GreenWings Offices, Warszawa', '52.1838066,20.9676289', 'AKTYWNY', 6, 5),
('WAW109A', 'Przy parkingu strzeżonym, Warszawa', '52.2840963,20.9795566', 'AKTYWNY', 4, 5),
('WAW432M', 'Przy pawilonach handlowych, Warszawa', '52.2948815,21.0530653', 'AKTYWNY', 12, 11),
('WAW159AP', 'Stacja LPG Wasbruk, Warszawa', '52.2571985,20.9773215', 'AKTYWNY', 10, 7),
('WAW600M', 'przy wejściu do budynku, Warszawa', '52.2414579,21.0947789', 'AKTYWNY', 8, 6),
('WAW39H', 'Lokal L3 Parter od ulicy Gdeckiej, Warszawa', '52.240847,21.100122', 'AKTYWNY', 14, 13),
('WAW81H', 'obok Mali Mówcy Centrum Diagnozy i Terapii Twojego Dziecka, Warszawa', '52.2235846,20.9464537', 'AKTYWNY', 10, 10),
('WAW402M', 'Na ścianie budynki od wejścia do sklepu, Warszawa', '52.2470486,21.1894056', 'AKTYWNY', 8, 12),
('WAW663M', 'Myjnia bezdotykowa, Warszawa', '52.1863082,20.8723953', 'AKTYWNY', 14, 8),
('WAW739M', 'Przy budynku mieszkalnym, Warszawa', '52.1993061,20.9154671', 'AKTYWNY', 14, 12),
('WAW706M', 'przy głównym wejściu (po zamknięciu szlabanu dojście do Paczkomatu możliwe tylko pieszo), Warszawa', '52.1995649,20.9365571', 'AKTYWNY', 6, 8),
('WAW21HO', 'W sklepie Mokpol, Warszawa', '52.1499228,21.0520985', 'AKTYWNY', 4, 6),
('WAW446M', 'Szyszaków 71, Warszawa', '52.2705279,21.162546', 'AKTYWNY', 6, 6),
('WAW451M', 'Na myjni samochodowej, Warszawa', '52.3024416,21.0415168', 'AKTYWNY', 14, 13),
('WAW455M', 'Przy budynku handlowym, Warszawa', '52.2541317,21.1642833', 'AKTYWNY', 16, 7),
('WAW467M', 'Przed budynkiem handlowym, Warszawa', '52.285154,20.9354481', 'AKTYWNY', 8, 8),
('WAW471M', 'Przy budynku handlowo usługowym, Warszawa', '52.2846581,20.9359196', 'AKTYWNY', 4, 9),
('WAW482M', 'przy budynku Pływalni od strony parkingu, Warszawa', '52.2873298,20.942542', 'AKTYWNY', 8, 10),
('WAW490M', 'parking przed budynkiem, Warszawa', '52.2782046,21.0114931', 'AKTYWNY', 6, 14),
('WAW500M', 'Przy budynku numer 13, od strony parkingu, Warszawa', '52.2734062,20.9515562', 'AKTYWNY', 6, 10),
('WAW503M', 'Na rogu ulic Staffa/Perzyńskiego, Warszawa', '52.2748321,20.9527955', 'AKTYWNY', 8, 7),
('WAW507M', 'Na działce, wejście od strony ulicy Przeździeckiej, Warszawa', '52.3385023,20.9920113', 'AKTYWNY', 10, 7),
('WAW525M', 'Przy wejściu do Administracji, Warszawa', '52.2640985,20.9599656', 'AKTYWNY', 6, 10),
('WAW540M', 'Przy Biedronce, Warszawa', '52.2391651,21.1090693', 'AKTYWNY', 12, 14),
('WAW559M', 'przy budynku mieszkaniowym, Warszawa', '52.2981773,21.045099', 'AKTYWNY', 4, 5),
('WAW55A', 'Stacja paliw Shell, Warszawa', '52.3647085,21.0272488', 'AKTYWNY', 16, 9),
('WAW564M', 'Przy stacji benzynowej, Warszawa', '52.2408709,21.158849', 'AKTYWNY', 10, 8),
('WAW577M', 'Na działce, Warszawa', '52.3146456,21.0675465', 'AKTYWNY', 10, 9),
('WAW580M', 'z boku budynku przy ogródku, Warszawa', '52.239607,21.0634135', 'AKTYWNY', 10, 6),
('WAW584M', 'Parking przy Przedszkolu, Warszawa', '52.2652971,21.1682137', 'AKTYWNY', 12, 8),
('WAW586M', 'Na terenie centrum handlowo-usługowego, Warszawa', '52.3549003,21.0287178', 'AKTYWNY', 16, 12),
('WAW590M', 'Na ścianie sklepu spożywczego, Warszawa', '52.3610138,21.0380168', 'AKTYWNY', 14, 8),
('WAW591M', 'na terenie posesji prywatnej, Warszawa', '52.3268158,21.0313894', 'AKTYWNY', 10, 7),
('WAW592M', 'Przy budynku, Warszawa', '52.2913544,21.0614754', 'AKTYWNY', 8, 7),
('WAW593M', 'Na parkingu budynku biurowego, Warszawa', '52.2696006,21.1487052', 'AKTYWNY', 4, 14),
('WAW596M', 'Naprzeciwko Jasnodworskiej 6, Warszawa', '52.2617349,20.9589287', 'AKTYWNY', 16, 12),
('WAW597M', 'Przy budce strażniczej, Warszawa', '52.2608995,21.1532769', 'AKTYWNY', 4, 6),
('WAW611M', 'przy ogrodzeniu, Warszawa', '52.2762238,21.1688627', 'AKTYWNY', 10, 11),
('WAW61A', 'Przy parkingu przed oknami Agencji Pocztowej, Warszawa', '52.3175753,21.0500823', 'AKTYWNY', 8, 10),
('WAW635M', 'od ul. Gawędziarzy 18, Warszawa', '52.2598795,21.1645236', 'AKTYWNY', 14, 11),
('WAW638M', 'Przy budynku mieszkalnym, Warszawa', '52.2842619,21.0827786', 'AKTYWNY', 14, 12),
('WAW643M', 'parking od ul. Grzybowej 3, Warszawa', '52.2523152,21.1702224', 'AKTYWNY', 10, 13),
('WAW648M', 'Przy budynku mieszkalnym, Warszawa', '52.2918733,21.0558346', 'AKTYWNY', 10, 10),
('WAW649M', 'Przy budynku mieszkalnym, Warszawa', '52.2818071,21.0761145', 'AKTYWNY', 12, 9),
('WAW656M', 'pod ścianą budynku, Warszawa', '52.3609338,21.044868', 'AKTYWNY', 14, 8),
('WAW658M', 'Przy budynku usługowym, Warszawa', '52.3245949,21.0534138', 'AKTYWNY', 6, 9),
('WAW660M', 'Parking, Warszawa', '52.2630992,20.9197595', 'AKTYWNY', 12, 12),
('WAW665M', 'Przy budynku usługowym, Warszawa', '52.3191476,20.9624854', 'AKTYWNY', 6, 12),
('WAW672M', 'od ulicy Andersena, Warszawa', '52.2804929,20.9369658', 'AKTYWNY', 6, 6),
('WAW675M', 'Przy wejściu do parku na terenie zielonym, Warszawa', '52.2355187,20.9048714', 'AKTYWNY', 10, 10),
('WAW678M', 'Przy budynku mieszkalnym, Warszawa', '52.3325401,21.0475308', 'AKTYWNY', 16, 9),
('WAW216AP', 'Przy Restauracji Da Vinci, Warszawa', '52.3182957,21.0586382', 'AKTYWNY', 6, 7),
('WAW704M', 'Przy sklepie Rossmann, Warszawa', '52.3180392,21.0583078', 'AKTYWNY', 10, 8),
('WAW543M', 'Przy budynku, po prawej stronie, Warszawa', '52.3180872,21.0587417', 'AKTYWNY', 6, 13),
('WAW709M', 'Przy budynku od strony ulicy Antalla, Warszawa', '52.3154398,20.9559279', 'AKTYWNY', 10, 14),
('WAW710M', 'Przy sklepie Netto, Warszawa', '52.3576035,21.0356714', 'AKTYWNY', 12, 10),
('WAW715M', 'Pasaż Chomiczówka, Warszawa', '52.2761574,20.9222183', 'AKTYWNY', 16, 7),
('WAW716M', 'Przy myjni samochodowej, Warszawa', '52.3454402,20.9434504', 'AKTYWNY', 8, 7),
('WAW735M', 'Obok budynku, Warszawa', '52.3465809,21.0497936', 'AKTYWNY', 16, 11),
('WAW95N', 'Przy sklepie Globi, Warszawa', '52.2437576,20.9178872', 'AKTYWNY', 16, 14),
('WAW98M', 'Przy głównym wejściu do galerii od strony al. Jerozolimskich, Warszawa', '52.2126553,20.9547468', 'AKTYWNY', 12, 9),
('WAW33APP', 'Na działce, Warszawa', '52.3248317,21.0556265', 'AKTYWNY', 6, 13),
('WAW357M', 'parking szkolny, Warszawa', '52.3213765,21.0497166', 'AKTYWNY', 8, 11),
('WAW365M', 'Przy DOSiR Kawęczyńska od ulicy Kawęczyńskiej, Warszawa', '52.2587653,21.0614682', 'AKTYWNY', 8, 6),
('WAW374M', 'Parking przy Kebab Egipt, Warszawa', '52.2386392,21.1501952', 'AKTYWNY', 12, 5),
('WAW375M', 'przy wejściu na teren uczelni od ulicy Wawerskiej, Warszawa', '52.247499,21.0663788', 'AKTYWNY', 6, 7),
('WAW393M', 'parking samochodowy , równolegle do chodnika, Warszawa', '52.3219756,21.0756907', 'AKTYWNY', 16, 8),
('WAW406M', 'Na parkingu przy sklepie, Warszawa', '52.2390123,20.948342', 'AKTYWNY', 8, 9),
('WAW408M', 'przy wejściu na teren Hali od ulicy Pieniążka, Warszawa', '52.2584128,20.930699', 'AKTYWNY', 8, 7),
('WAW419M', 'Za budynkiem piekarni PUTKA, Warszawa', '52.252199,20.9229039', 'AKTYWNY', 14, 7),
('WAW427M', 'Obok Parku Sybiraków, Warszawa', '52.2544791,20.9202419', 'AKTYWNY', 4, 11),
('WAW441M', 'Na posesji prywatnej, Warszawa', '52.2859309,21.0781636', 'AKTYWNY', 14, 10),
('WAW02APP', 'Przy budynku administracji, Warszawa', '52.2891722,21.0575525', 'AKTYWNY', 8, 6),
('WAW115A', 'teren zielony przed marketem, Warszawa', '52.2944181,20.9441225', 'AKTYWNY', 8, 7),
('WAW13APP', 'Przy siedzibie Spółdzielni, Warszawa', '52.2664363,20.9628162', 'AKTYWNY', 8, 9),
('WAW17APP', 'Przy sklepie Netto, po prawej stronie budynku, Warszawa', '52.2839145,20.9164494', 'AKTYWNY', 6, 13),
('WAW19APP', 'przy parkingu, Warszawa', '52.2433897,20.9653988', 'AKTYWNY', 10, 6),
('WAW25APP', 'Przy budynku mieszkaniowym Morcinka 12, Warszawa', '52.259201,20.9194212', 'AKTYWNY', 14, 6),
('WAW27M', 'Przy sklepie spożywczym Społem Żoliborz, Warszawa', '52.2920672,20.9383314', 'AKTYWNY', 8, 10),
('WAW747M', 'Paczkomat znajduje się przy budynku OPZZ, Warszawa', '52.2380293,21.020432', 'AKTYWNY', 16, 11),
('WAW28HO', 'Na Parkingu podziemnym, przy wejściu do sklepu, Warszawa', '52.2080722,21.0539937', 'AKTYWNY', 8, 12),
('WAW714M', 'Przy budynku mieszkalnym, Warszawa', '52.267552,20.9406371', 'AKTYWNY', 14, 11),
('WAW615M', 'Przy wejściu na osiedle, po prawej stronie wjazdu do garażu, Warszawa', '52.3066078,20.9755036', 'AKTYWNY', 12, 13),
('WAW668M', 'Przy budynku biurowym, Warszawa', '52.1312311,21.0186313', 'AKTYWNY', 12, 14),
('WAW514M', 'Po prawej stronie od bramki, Warszawa', '52.2344429,21.0323439', 'AKTYWNY', 12, 6),
('WAW124M', 'Po lewej stronie wejścia do budynku, Warszawa', '52.2343922,21.0322421', 'AKTYWNY', 12, 10),
('WAW249M', 'Przy wejściu do Instytut Psychologii PAN, Warszawa', '52.2375806,21.0325875', 'AKTYWNY', 12, 13),
('WAW620M', 'Przy budynku mieszkalnym, Warszawa', '52.227099,21.0413873', 'AKTYWNY', 8, 12),
('WAW155M', 'Przy budynku Międzynarodowa 64, Warszawa', '52.2385379,21.0637344', 'AKTYWNY', 8, 7),
('WAW444M', 'W przejściu, przy serwisie rowerowym, Warszawa', '52.2389254,21.024246', 'AKTYWNY', 8, 6),
('WAW04BAPP', 'przy sklepie Lidl, Warszawa', '52.3363439,20.9386424', 'AKTYWNY', 8, 7),
('WAW23APP', 'przy klatce nr 3 od ul. Instalatorów, Warszawa', '52.1970312,20.962721', 'AKTYWNY', 10, 12),
('WAW761M', 'Przy biurowcu Warsaw Unit, Warszawa', '52.2302956,20.9865534', 'AKTYWNY', 14, 6),
('WAW125M', 'Za sklepem żabka, Warszawa', '52.2285122,20.9728878', 'AKTYWNY', 12, 14),
('WAW733M', 'parking przed budynkiem, Warszawa', '52.227885,21.0958642', 'AKTYWNY', 12, 5),
('WAW609M', 'Przy wejściu na bazar od ulicy Kawęczyńskiej, Warszawa', '52.2558796,21.0507389', 'AKTYWNY', 14, 8),
('WAW583M', 'od ul. Torowej, Warszawa', '52.238718,21.1345567', 'AKTYWNY', 8, 11),
('WAW562M', 'przy myjni samochodowej, Warszawa', '52.278705,20.9743902', 'AKTYWNY', 10, 12),
('WAW499M', 'Obok garaży, od strony ulicy Księgarzy, Warszawa', '52.2745553,20.9431781', 'AKTYWNY', 12, 5),
('WAW474M', 'przy budynku OSIR, w płocie od strony ulicy Bogumińskiej, Warszawa', '52.2834502,21.0709839', 'AKTYWNY', 12, 5),
('WAW425M', 'Na działce, przy płocie, Warszawa', '52.2852272,21.0681738', 'AKTYWNY', 12, 11),
('WAW125A', 'Przy fitness klubie, Warszawa', '52.3022627,20.9336166', 'AKTYWNY', 10, 7),
('PNET0931', 'Przy stacji paliw Moya, Warszawa', '52.3360219,21.0300853', 'AKTYWNY', 6, 11),
('WAW139H', 'w lokalu obok fryzjera, Warszawa', '52.2065423,20.8784208', 'AKTYWNY', 4, 12),
('WAW82H', 'Lokal obok Pretty Woman Studio. Wejście od Ratuszowej, Warszawa', '52.2614638,21.0368502', 'AKTYWNY', 10, 11),
('WAW748M', 'przy Parku Henrykowskim od ul. Dziatwy, Warszawa', '52.3303121,20.9674018', 'AKTYWNY', 4, 7),
('WAW22BAPP', 'Po prawej stronie budynku, Warszawa', '52.2819937,21.0476906', 'AKTYWNY', 16, 10),
('WAW01BAPP', 'Przy budynku mieszkalnym, Warszawa', '52.2416884,20.9197424', 'AKTYWNY', 16, 6),
('WAW702M', 'Parking, Warszawa', '52.2437784,20.9128735', 'AKTYWNY', 8, 13),
('WAW787M', 'Na parkingu sklepu Lidl, Warszawa', '52.2158692,20.8787867', 'AKTYWNY', 10, 8),
('WAW763M', 'Przy budynku usługowym, Warszawa', '52.1888252,20.880347', 'AKTYWNY', 14, 10),
('WAW414M', 'teren zewnętrzny przy budynku, Warszawa', '52.2474246,21.0583119', 'AKTYWNY', 16, 5),
('WAW770M', 'parking przed sklepem, Warszawa', '52.2940571,21.0825773', 'AKTYWNY', 14, 5),
('WAW619M', 'Przy budynku biurowym, Warszawa', '52.2847755,21.074205', 'AKTYWNY', 14, 10),
('WRO04H', 'Wrocław, Nowowiejska 26, Wrocław', '51.1239091,17.0480658', 'AKTYWNY', 10, 7),
('LOD18M', 'Łódź, Księdza Biskupa Wincentego Tymienieckiego 16B, Łódź', '51.7511957,19.4685072', 'AKTYWNY', 6, 10),
('LOD034', 'Łódź, Czechosłowacka 3a, Łódź', '51.7716852,19.5077862', 'AKTYWNY', 16, 6),
('LOD23A', 'Łódź, Jana Karskiego 5, Łódź', '51.7799,19.4455919', 'AKTYWNY', 16, 10),
('LOD18APP', 'Łódź, Karola Miarki 12, Łódź', '51.7979165,19.4720204', 'AKTYWNY', 12, 6);

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
