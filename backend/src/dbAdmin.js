import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import { query } from "./db.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const schemaFilePath = path.join(__dirname, "..", "sql", "schema.sql")
const dataFilePath = path.join(__dirname, "..", "sql", "data.sql")
const functionsFilePath = path.join(__dirname, "..", "sql", "functions.sql")
const viewsFilePath = path.join(__dirname, "..", "sql", "view.sql")

export async function clearDatabase() {
  await query("DROP SCHEMA IF EXISTS parcel_locker CASCADE;", [])
}

export async function initDatabase() {
  const schemaSql = await fs.readFile(schemaFilePath, "utf-8")
  await query(schemaSql, [])

  const dataSql = await fs.readFile(dataFilePath, "utf-8")
  await query(dataSql, [])

  const functionsSql = await fs.readFile(functionsFilePath, "utf-8")
  await query(functionsSql, [])
  
  const viewsSql = await fs.readFile(viewsFilePath, "utf-8")
  await query(viewsSql, [])
}
