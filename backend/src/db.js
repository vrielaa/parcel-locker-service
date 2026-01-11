import pg from "pg"
import dotenv from "dotenv"

dotenv.config()

const { Pool } = pg

const hasCloudSql = Boolean(process.env.INSTANCE_CONNECTION_NAME)

const pool = new Pool(
  hasCloudSql
    ? {
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,

        host: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
        port: 5432,

        max: 5,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,

        keepAlive: true
      }
    : {
        connectionString: process.env.DATABASE_URL,

        ssl: { rejectUnauthorized: false },

        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,

        keepAlive: true
      }
)

pool.on("error", (err) => {
  console.error("[DB][POOL_ERROR]", err)
})

export async function query(sql, params = []) {
  return pool.query(sql, params)
}
