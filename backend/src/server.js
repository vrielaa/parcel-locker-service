import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { query } from "./db.js"
import { clearDatabase, initDatabase } from "./dbAdmin.js"
import { getAllAutomaty, getAllMiasta } from "./utils.js"

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

app.get("/api/test-db", async (req, res) => {
  try {
    const result = await query("SELECT NOW() AS now", [])
    res.json({ ok: true, now: result.rows[0].now })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: "Database error" })
  }
})

app.post("/api/db/clear", async (req, res) => {
  try {
    await clearDatabase()
    res.json({ ok: true, message: "Schema parcel_locker dropped" })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: "Clear failed" })
  }
})

app.post("/api/db/init", async (req, res) => {
  try {
    await initDatabase()
    res.json({ ok: true, message: "Schema parcel_locker initialized" })


  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: "Init failed" })
  }
})

app.get("/api/automaty", async (req, res) => {
  try {
    const automaty = await getAllAutomaty()
    res.json(automaty)
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: "Database error" })
  }
})

app.get("/api/miasta", async (req, res) => {
  try {
    const miasta = await getAllMiasta()
    // tworzenie buttonów dla każdego miasta
    


    res.json(miasta)
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: "Database error" })
  }
})


const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`)
})
