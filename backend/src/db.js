import pg from "pg"
import dotenv from "dotenv"

dotenv.config()

const { Pool } = pg

const isCloudSql = !!process.env.INSTANCE_CONNECTION_NAME

export const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,

  host: isCloudSql ? `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}` : process.env.DB_HOST,
  port: 5432,

  ssl: isCloudSql ? false : false,

  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,

  keepAlive: true,

  options: "-c search_path=parcel_locker,public"
})

pool.on("error", (err) => {
  console.error("[DB][POOL_ERROR]", err)
})

export async function query(sql, params = []) {
  return pool.query(sql, params)
}
