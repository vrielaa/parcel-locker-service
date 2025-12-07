
-- funckja wyodrębniająca miasto z adresu w formacie "ulica, kod pocztowy miasto"
-- rexexp_replace usuwa wszystko przed kodem pocztowym oraz sam kod pocztowy, pozostawiając tylko nazwę miasta
-- Przykład: "ul. Aleja Mickiewicza 30, 30-059 Kraków" -> "Kraków"
-- .*,\s*\d{2}-\d{3}\s+  oznacza wszystko do kodu pocztowego wraz z przecinkiem i spacjami
-- Zastępujemy to pustym ciągiem znaków, pozostawiając tylko miasto
CREATE OR REPLACE FUNCTION parcel_locker.extract_city_from_address(adres text)
RETURNS text 
LANGUAGE sql
AS $$
    SELECT
        regexp_replace(
            adres,
            '.*,\s*\d{2}-\d{3}\s+',
            ''
            )
$$;


-- funckcja zwracajaca wszystkie miasta gdzie znajduja sie automaty
CREATE OR REPLACE FUNCTION parcel_locker.get_all_cities_with_automat()
RETURNS TABLE (miasto text)
LANGUAGE sql
AS $$
    SELECT DISTINCT
        parcel_locker.extract_city_from_address(adres) AS miasto
    FROM Automat
$$;
