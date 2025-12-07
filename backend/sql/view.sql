
-- VIEW z wszystkimi automatami wraz z wyodrębnionym miastem z adresu
CREATE OR REPLACE VIEW parcel_locker.automat_in_city AS
SELECT
    automat_id,
    nazwa,
    adres,
    wspolrzedne_gps,
    status,
    parcel_locker.extract_city_from_address(adres) AS miasto
FROM Automat;