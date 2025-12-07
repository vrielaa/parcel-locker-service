SET search_path TO parcel_locker;

-- Wyczyść tabelę przy ponownym ładowaniu (opcjonalnie)
TRUNCATE TABLE Automat RESTART IDENTITY CASCADE;


-- Kraków
INSERT INTO Automat (nazwa, adres, wspolrzedne_gps, status) VALUES
  ('KRA-001', 'ul. Aleja Mickiewicza 30, 30-059 Kraków', '50.0669,19.9127', 'AKTYWNY'),
  ('KRA-002', 'ul. Zwierzyniecka 10, 31-103 Kraków', '50.0552,19.9315', 'AKTYWNY'),
  ('KRA-003', 'ul. Wielicka 72, 30-552 Kraków', '50.0295,19.9621', 'AKTYWNY'),
  ('KRA-004', 'ul. Bora-Komorowskiego 41, 31-876 Kraków', '50.0963,20.0014', 'W_SERWISIE'),
  ('KRA-005', 'ul. Karmelicka 15, 31-133 Kraków', '50.0654,19.9320', 'AKTYWNY');

-- Warszawa
INSERT INTO Automat (nazwa, adres, wspolrzedne_gps, status) VALUES
  ('WAR-001', 'ul. Marszałkowska 100, 00-001 Warszawa', '52.2297,21.0122', 'AKTYWNY'),
  ('WAR-002', 'ul. Puławska 50, 02-515 Warszawa', '52.1667,21.0333', 'AKTYWNY'),
  ('WAR-003', 'ul. Grochowska 200, 04-186 Warszawa', '52.2300,21.0500', 'W_SERWISIE'),
  ('WAR-004', 'ul. Żelazna 59, 00-848 Warszawa', '52.2320,20.9980', 'AKTYWNY'),
  ('WAR-005', 'ul. Słowackiego 10, 02-003 Warszawa', '52.2100,21.0200', 'AKTYWNY'); 
-- Poznań
INSERT INTO Automat (nazwa, adres, wspolrzedne_gps, status) VALUES
  ('POZ-001', 'ul. Święty Marcin 80, 61-809 Poznań', '52.4064,16.9252', 'AKTYWNY'),
  ('POZ-002', 'ul. Głogowska 120, 60-004 Poznań', '52.3958,16.8850', 'AKTYWNY'),
  ('POZ-003', 'ul. Grunwaldzka 5, 60-783 Poznań', '52.4100,16.9000', 'W_SERWISIE'),
  ('POZ-004', 'ul. Dąbrowskiego 15, 61-841 Poznań', '52.4200,16.9300', 'AKTYWNY'),
  ('POZ-005', 'ul. 27 Grudnia 42, 60-101 Poznań', '52.4000,16.9200', 'AKTYWNY');    
-- Gdańsk
INSERT INTO Automat (nazwa, adres, wspolrzedne_gps, status) VALUES
  ('GDA-001', 'ul. Długa 20, 80-831 Gdańsk', '54.3520,18.6466', 'AKTYWNY'),
  ('GDA-002', 'ul. Grunwaldzka 100, 80-244 Gdańsk', '54.3600,18.6200', 'AKTYWNY'),
  ('GDA-003', 'ul. Rajska 5, 80-850 Gdańsk', '54.3500,18.6400', 'W_SERWISIE'),
  ('GDA-004', 'ul. Podwale Przedmiejskie 15, 80-895 Gdańsk', '54.3600,18.6500', 'AKTYWNY'),
  ('GDA-005', 'ul. Chmielna 10, 80-748 Gdańsk', '54.3400,18.6300', 'AKTYWNY');  

-- Wrocław
INSERT INTO Automat (nazwa, adres, wspolrzedne_gps, status) VALUES
  ('WRO-001', 'ul. Rynek 1, 50-101 Wrocław', '51.1079,17.0385', 'AKTYWNY'),
  ('WRO-002', 'ul. Świdnicka 10, 50-066 Wrocław', '51.1090,17.0320', 'AKTYWNY'),
  ('WRO-003', 'ul. Legnicka 50, 54-202 Wrocław', '51.1000,16.9800', 'W_SERWISIE'),
  ('WRO-004', 'ul. Piłsudskiego 20, 50-020 Wrocław', '51.1100,17.0400', 'AKTYWNY'),
  ('WRO-005', 'ul. Kazimierza Wielkiego 15, 50-077 Wrocław', '51.1050,17.0250', 'AKTYWNY'); 


-- Łódź
INSERT INTO Automat (nazwa, adres, wspolrzedne_gps, status) VALUES
  ('LOD-001', 'ul. Piotrkowska 90, 90-001 Łódź', '51.7592,19.4560', 'AKTYWNY'),
  ('LOD-002', 'ul. Narutowicza 50, 90-135 Łódź', '51.7600,19.4700', 'AKTYWNY'),
  ('LOD-003', 'ul. Gdańska 20, 91-002 Łódź', '51.7700,19.4800', 'W_SERWISIE'),
  ('LOD-004', 'ul. Wólczańska 15, 90-521 Łódź', '51.7500,19.4400', 'AKTYWNY'),
  ('LOD-005', 'ul. Sienkiewicza 10, 90-113 Łódź', '51.7550,19.4500', 'AKTYWNY');

-- Szczecin
INSERT INTO Automat (nazwa, adres, wspolrzedne_gps, status) VALUES
  ('SZZ-001', 'ul. Krzywoustego 10, 70-250 Szczecin', '53.4285,14.5528', 'AKTYWNY'),
  ('SZZ-002', 'ul. Wojska Polskiego 50, 70-481 Szczecin', '53.4300,14.5600', 'AKTYWNY'),
  ('SZZ-003', 'ul. Piłsudskiego 20, 70-330 Szczecin', '53.4200,14.5400', 'W_SERWISIE'),
  ('SZZ-004', 'ul. Słowackiego 15, 70-400 Szczecin', '53.4400,14.5700', 'AKTYWNY'),
  ('SZZ-005', 'ul. 3 Maja 5, 70-205 Szczecin', '53.4250,14.5450', 'AKTYWNY'); 


-- Lublin
INSERT INTO Automat (nazwa, adres, wspolrzedne_gps, status) VALUES
  ('LUB-001', 'ul. Krakowskie Przedmieście 15, 20-002 Lublin', '51.2465,22.5684', 'AKTYWNY'),
  ('LUB-002', 'ul. Lipowa 10, 20-112 Lublin', '51.2500,22.5700', 'AKTYWNY'),
  ('LUB-003', 'ul. Narutowicza 5, 20-016 Lublin', '51.2400,22.5600', 'W_SERWISIE'),
  ('LUB-004', 'ul. Głęboka 20, 20-612 Lublin', '51.2550,22.5800', 'AKTYWNY'),
  ('LUB-005', 'ul. Czechowska 30, 20-121 Lublin', '51.2450,22.5650', 'AKTYWNY');