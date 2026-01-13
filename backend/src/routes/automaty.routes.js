// backend/src/routes/automaty.routes.js
import { Router } from "express"
import { getAllMiasta, getAutomatyInCity, getAutomatInfoById } from "../utils.js"
import { query } from "../db.js"
import { requireAuth } from "../middleware/auth.js"
import { requireRoles } from "../middleware/requireRoles.js"

const router = Router()

const AUTOMAT_STATUSES = new Set(["AKTYWNY", "W_SERWISIE", "NIEAKTYWNY"])
const SKRYTKA_STATUSES = new Set(["WOLNA", "ZAJETA", "USZKODZONA"])

router.get("/miasta", async (req, res) => {
  const miasta = await getAllMiasta()
  res.json(miasta)
})

router.get("/automaty", async (req, res) => {
  const miasto = req.query.miasto
  if (!miasto) return res.json([])
  const automaty = await getAutomatyInCity(miasto)
  res.json(automaty)
})

router.get("/automaty/:id", async (req, res) => {
  const automatId = req.params.id
  const automatInfo = await getAutomatInfoById(automatId)

  if (!automatInfo) return res.status(404).json({ ok: false, error: "Automat not found" })
  res.json(automatInfo)
})

router.put("/automaty/:id/status", requireAuth, requireRoles("ADMIN", "OPERATOR"), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const status = String(req.body?.status || "").toUpperCase()

    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "Invalid automat id" })
    if (!AUTOMAT_STATUSES.has(status)) return res.status(400).json({ ok: false, error: "Invalid status" })

    const result = await query(
      `
      UPDATE parcel_locker.automat
      SET status = $1
      WHERE automat_id = $2
      RETURNING automat_id, status
      `,
      [status, id]
    )

    const row = result.rows[0]
    if (!row) return res.status(404).json({ ok: false, error: "Automat not found" })

    res.json({ ok: true, automat: row })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: "Update automat status failed" })
  }
})

router.put("/skrytki/:id/status", requireAuth, requireRoles("ADMIN", "OPERATOR"), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const status = String(req.body?.status || "").toUpperCase()

    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "Invalid skrytka id" })
    if (!SKRYTKA_STATUSES.has(status)) return res.status(400).json({ ok: false, error: "Invalid status" })

    const result = await query(
      `
      UPDATE parcel_locker.skrytka
      SET status = $1
      WHERE skrytka_id = $2
      RETURNING skrytka_id, status
      `,
      [status, id]
    )

    const row = result.rows[0]
    if (!row) return res.status(404).json({ ok: false, error: "Skrytka not found" })

    res.json({ ok: true, skrytka: row })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: "Update skrytka status failed" })
  }
})

export default router
