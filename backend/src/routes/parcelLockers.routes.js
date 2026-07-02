// backend/src/routes/parcelLockers.routes.js
import { Router } from "express"
import { getAllCities, getParcelLockersInCity, getParcelLockerInfoById } from "../utils.js"
import { query } from "../db.js"
import { requireAuth } from "../middleware/auth.js"
import { requireRoles } from "../middleware/requireRoles.js"

const router = Router()

const PARCEL_LOCKER_STATUSES = new Set(["AKTYWNY", "W_SERWISIE", "NIEAKTYWNY"])
const LOCKER_STATUSES = new Set(["WOLNA", "ZAJETA", "USZKODZONA"])

router.get("/miasta", async (req, res) => {
  const cities = await getAllCities()
  res.json(cities)
})

router.get("/automaty", async (req, res) => {
  const city = req.query.miasto
  if (!city) return res.json([])
  const parcelLockers = await getParcelLockersInCity(city)
  res.json(parcelLockers)
})

router.get("/automaty/:id", async (req, res) => {
  const parcelLockerId = req.params.id
  const parcelLockerInfo = await getParcelLockerInfoById(parcelLockerId)

  if (!parcelLockerInfo) return res.status(404).json({ ok: false, error: "Automat not found" })
  res.json(parcelLockerInfo)
})

router.put("/automaty/:id/status", requireAuth, requireRoles("ADMIN", "OPERATOR"), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const status = String(req.body?.status || "").toUpperCase()

    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "Invalid automat id" })
    if (!PARCEL_LOCKER_STATUSES.has(status)) return res.status(400).json({ ok: false, error: "Invalid status" })

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
    if (!LOCKER_STATUSES.has(status)) return res.status(400).json({ ok: false, error: "Invalid status" })

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
