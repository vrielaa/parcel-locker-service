import { initDatabase } from "./dbAdmin.js"
import { pool } from "./db.js"

async function main() {
  try {
    await initDatabase()
    console.log("Schema parcel_locker initialized.")
  } catch (err) {
    console.error("Database initialization failed:")
    console.error(err)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()
