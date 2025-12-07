// src/utilsDb.js
import { query } from "./db.js"

const SCHEMA_NAME = "parcel_locker"

export async function queryInSchema(sql, params = []) {
  await query(`SET search_path TO ${SCHEMA_NAME};`, [])
  const result = await query(sql, params)
  return result
}

export async function getAllAutomaty() {
  const result = await queryInSchema(
    "SELECT * FROM Automat ORDER BY automat_id;",
    []
  )
  return result.rows
}

export async function getAllMiasta() {
  const result = await queryInSchema(
    "SELECT * FROM get_all_cities_with_automat();",
    [],
  )
  return result.rows.map(row => row.miasto)
}
