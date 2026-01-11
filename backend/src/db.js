import pg from "pg"
import dotenv from "dotenv"

dotenv.config()

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: { rejectUnauthorized: false },

  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,

  keepAlive: true
})

pool.on("error", (err) => {
  console.error("[DB][POOL_ERROR]", err)
})

export async function query(sql, params = []) {
  return pool.query(sql, params)
}
