import { query } from "./db.js"

/* =========================
   PARCEL LOCKERS
========================= */

export async function getParcelLockersInCity(city) {
  const result = await query(
    `
    SELECT *
    FROM parcel_locker.automaty_in_city
    WHERE miasto = $1;
    `,
    [city]
  )

  return result.rows
}

export async function getAllCities() {
  const result = await query(
    `
    SELECT *
    FROM parcel_locker.get_all_cities_with_automat();
    `
  )

  return result.rows.map(row => row.miasto)
}

export async function getParcelLockerInfoById(parcelLockerId) {
  const result = await query(
    `
    SELECT
      a.automat_id,
      a.liczba_wierszy,
      a.liczba_kolumn,
      a.ekran_w_kolumnie,

      s.skrytka_id,
      s.wiersz,
      s.kolumna,
      s.status,

      r.kod AS rozmiar,
      r.szerokosc_cm,
      r.wysokosc_cm,
      r.glebokosc_cm
    FROM parcel_locker.automat a
    LEFT JOIN parcel_locker.skrytka s
           ON s.automat_id = a.automat_id
    LEFT JOIN parcel_locker.rozmiar r
           ON r.rozmiar_id = s.rozmiar_id
    WHERE a.automat_id = $1
    ORDER BY s.wiersz, s.kolumna;
    `,
    [parcelLockerId]
  )

  return result.rows
}

/* =========================
   PARCEL LOCKER GRID (FRONTEND)
========================= */

export async function getParcelLockerGridById(parcelLockerId) {
  const result = await query(
    `
    SELECT
      a.automat_id,
      a.liczba_wierszy,
      a.liczba_kolumn,
      a.ekran_w_kolumnie,

      s.skrytka_id,
      s.wiersz,
      s.kolumna,
      s.status,

      r.kod AS rozmiar,
      r.szerokosc_cm,
      r.wysokosc_cm,
      r.glebokosc_cm
    FROM parcel_locker.automat a
    LEFT JOIN parcel_locker.skrytka s
           ON s.automat_id = a.automat_id
    LEFT JOIN parcel_locker.rozmiar r
           ON r.rozmiar_id = s.rozmiar_id
    WHERE a.automat_id = $1
    ORDER BY s.wiersz, s.kolumna;
    `,
    [parcelLockerId]
  )

  return result.rows
}

/* =========================
   ADMIN
========================= */

export async function clearDatabase() {
  await query(
    `
    SELECT public.drop_parcel_locker_schema();
    `
  )
}
