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
    SELECT ekran_w_kolumnie
    INTO col_screen
    FROM Automat
    WHERE automat_id = p_automat_id;

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
-- Trigger: otwieranie obsługi automatu przy starcie dostawy
-- =====================================================

CREATE OR REPLACE FUNCTION parcel_locker.trg_open_oa_when_transport_starts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status = 'W_DRODZE'
     AND NEW.kurier_id IS NOT NULL
     AND NEW.docelowy_automat_id IS NOT NULL
  THEN
    INSERT INTO parcel_locker.obslugaautomatu (kurier_id, automat_id, data_od, data_do)
    VALUES (NEW.kurier_id, NEW.docelowy_automat_id, CURRENT_TIMESTAMP, NULL)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


--- =====================================================
-- Trigger: trg_open_oa_when_transport_starts
-- =====================================================

DROP TRIGGER IF EXISTS trg_open_oa_when_transport_starts ON parcel_locker.paczka;

CREATE TRIGGER trg_open_oa_when_transport_starts
AFTER UPDATE OF status ON parcel_locker.paczka
FOR EACH ROW
EXECUTE FUNCTION parcel_locker.trg_open_oa_when_transport_starts();


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
     AND NEW.status IN ('W_AUTOMACIE','ODEBRANA','PRZETERMINOWANA','ANULOWANA')
  THEN
    UPDATE parcel_locker.obslugaautomatu oa
    SET data_do = CURRENT_TIMESTAMP
    WHERE oa.obsluga_id = (
      SELECT oa2.obsluga_id
      FROM parcel_locker.obslugaautomatu oa2
      WHERE oa2.kurier_id = NEW.kurier_id
        AND oa2.automat_id = NEW.docelowy_automat_id
        AND oa2.data_do IS NULL
      ORDER BY oa2.data_od DESC
      LIMIT 1
    )
    AND NOT EXISTS (
      SELECT 1
      FROM parcel_locker.paczka p
      WHERE p.kurier_id = NEW.kurier_id
        AND p.docelowy_automat_id = NEW.docelowy_automat_id
        AND p.status IN ('W_DRODZE')
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
