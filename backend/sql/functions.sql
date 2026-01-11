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