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
    a.ekran_w_kolumnie,

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
