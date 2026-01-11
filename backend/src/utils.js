import { query } from "./db.js"

/* =========================
   AUTOMATY
========================= */

export async function getAutomatyInCity(miasto) {
  const result = await query(
    `
    SELECT *
    FROM parcel_locker.automaty_in_city
    WHERE miasto = $1;
    `,
    [miasto]
  )

  return result.rows
}

export async function getAllMiasta() {
  const result = await query(
    `
    SELECT *
    FROM parcel_locker.get_all_cities_with_automat();
    `
  )

  return result.rows.map(row => row.miasto)
}

export async function getAutomatInfoById(automatId) {
  const result = await query(
    `
    SELECT *
    FROM parcel_locker.automat_view
    WHERE automat_id = $1
    ORDER BY wiersz, kolumna;
    `,
    [automatId]
  )

  return result.rows
}

/* =========================
   GRID AUTOMATU (FRONTEND)
========================= */

export async function getAutomatGridById(automatId) {
  const result = await query(
    `
    SELECT *
    FROM parcel_locker.automat_view
    WHERE automat_id = $1
    ORDER BY wiersz, kolumna;
    `,
    [automatId]
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
