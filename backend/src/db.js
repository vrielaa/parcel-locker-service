import pg from "pg"
import dotenv from "dotenv"

dotenv.config()

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

export async function query(sql, params) {
  const client = await pool.connect()
  try {
    const res = await client.query(sql, params)
    return res
  } finally {
    client.release()
  }
}
