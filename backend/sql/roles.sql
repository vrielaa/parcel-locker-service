-- =====================================================
-- ROLES / PERMISSIONS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parcel_admin') THEN
    CREATE ROLE parcel_admin LOGIN PASSWORD 'CHANGE_ME_admin';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parcel_operator') THEN
    CREATE ROLE parcel_operator LOGIN PASSWORD 'CHANGE_ME_operator';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parcel_kurier') THEN
    CREATE ROLE parcel_kurier LOGIN PASSWORD 'CHANGE_ME_kurier';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parcel_klient') THEN
    CREATE ROLE parcel_klient LOGIN PASSWORD 'CHANGE_ME_klient';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parcel_report') THEN
    CREATE ROLE parcel_report LOGIN PASSWORD 'CHANGE_ME_report';
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

-- klient: podgląd swoich danych i operacje związane z paczkami (na razie ogólnie)
-- docelowo "tylko swoje" robi się przez RLS, ale do projektu wystarczy warstwa uprawnień + endpointy.
GRANT SELECT, UPDATE ON parcel_locker.Klient       TO parcel_klient;
GRANT SELECT        ON parcel_locker.Paczka        TO parcel_klient;
GRANT SELECT, INSERT ON parcel_locker.Przedluzenie TO parcel_klient;
GRANT SELECT        ON parcel_locker.ZdarzeniePaczki TO parcel_klient;

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
