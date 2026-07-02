import { initDatabase } from "./dbAdmin.js"
import { pool, query } from "./db.js"

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForDatabase({ attempts = 30, intervalMs = 1000 } = {}) {
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await query("SELECT 1")
      return
    } catch (err) {
      lastError = err
      console.log(`Waiting for database (${attempt}/${attempts})...`)
      await delay(intervalMs)
    }
  }

  throw lastError
}

async function isInitialized() {
  const result = await query(
    `
    SELECT
      to_regclass('parcel_locker.appuser') IS NOT NULL
      AND to_regclass('parcel_locker.automat_view') IS NOT NULL
      AS initialized
    `
  )

  return Boolean(result.rows[0]?.initialized)
}

async function main() {
  try {
    await waitForDatabase()

    if (await isInitialized()) {
      console.log("Database schema already initialized.")
      return
    }

    await initDatabase()
    console.log("Database schema initialized.")
  } catch (err) {
    console.error("Database setup failed:")
    console.error(err)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()
