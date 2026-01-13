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

    skrytka_id      INT
        REFERENCES Skrytka(skrytka_id)
        ON DELETE SET NULL,

    status          TEXT NOT NULL DEFAULT 'DO_ZATWIERDZENIA'
        CHECK (status IN ('DO_ZATWIERDZENIA','NADANA','W_DRODZE','W_AUTOMACIE','ODEBRANA','PRZETERMINOWANA','ANULOWANA')),

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
        CHECK (typ IN ('UTWORZONA','W_AUTOMACIE','PRZEDLUZONA','ODEBRANA','ANULOWANA','PRZETERMINOWANA')),

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
