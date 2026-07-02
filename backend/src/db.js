import pg from "pg"
import dotenv from "dotenv"

dotenv.config()

const { Pool } = pg

const isCloudSql = !!process.env.INSTANCE_CONNECTION_NAME
const isProduction = process.env.NODE_ENV === "production"
const dbPort = Number(process.env.DB_PORT || 5433)

function valueOrLocalDefault(name, localDefault) {
  const value = process.env[name]
  if (value) return value
  if (isProduction) throw new Error(`${name} is required in production`)
  return localDefault
}

export const pool = new Pool({
  user: valueOrLocalDefault("DB_USER", "postgres"),
  password: valueOrLocalDefault("DB_PASS", "postgres"),
  database: process.env.DB_NAME || "parcel_locker",

  host: isCloudSql ? `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}` : process.env.DB_HOST || "localhost",
  port: dbPort,

  ssl: false,

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
