import { Router } from "express"
import { query } from "../db.js"
import { initDatabase } from "../dbAdmin.js"
import { clearDatabase } from "../utils.js"
import { requireAuth, requireRole } from "../middleware/auth.js"

const router = Router()

router.get("/test", requireAuth, requireRole(["ADMIN","OPERATOR"]), async (req, res) => {
  const result = await query("SELECT NOW() AS now", [])
  res.json({ ok: true, now: result.rows[0].now })
})

router.post("/clear", requireAuth, requireRole(["ADMIN","OPERATOR"]), async (req, res) => {
  await clearDatabase()
  res.json({ ok: true, message: "Schema parcel_locker dropped" })
})

router.post("/init", requireAuth, requireRole(["ADMIN","OPERATOR"]), async (req, res) => {
  await initDatabase()
  res.json({ ok: true, message: "Schema parcel_locker initialized" })
})

export default router
