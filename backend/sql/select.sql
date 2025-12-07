
-- znajdz wszystkie automaty w danym mieście
-- wykorzystuje funkcję extract_city_from_address do wyodrębnienia miasta z adresu
-- sa pomoca SELECT AS 
SET search_path TO parcel_locker;
SELECT * FROM Automat
WHERE parcel_locker.extract_city_from_address(adres) = 'Kraków';
