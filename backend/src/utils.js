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
    SELECT *
    FROM parcel_locker.automat_view
    WHERE automat_id = $1
    ORDER BY wiersz, kolumna;
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
    SELECT *
    FROM parcel_locker.automat_view
    WHERE automat_id = $1
    ORDER BY wiersz, kolumna;
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
