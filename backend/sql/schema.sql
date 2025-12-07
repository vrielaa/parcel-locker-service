-- Ustawiamy się na schemacie public (niekonieczne, ale ok)
SET search_path TO public;

CREATE SCHEMA IF NOT EXISTS parcel_locker;

SET search_path TO parcel_locker;

CREATE TABLE IF NOT EXISTS Automat (
    automat_id      SERIAL PRIMARY KEY,
    nazwa           VARCHAR(50) NOT NULL,
    adres           VARCHAR(255) NOT NULL,
    wspolrzedne_gps VARCHAR(100),
    status          VARCHAR(20) NOT NULL DEFAULT 'AKTYWNY'
);
