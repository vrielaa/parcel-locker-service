import { Router } from "express"
import { query } from "../db.js"
import { requireAuth } from "../middleware/auth.js"
import { requireRoles } from "../middleware/requireRoles.js"

const router = Router()

router.get("/paczki/pending", requireAuth, requireRoles("ADMIN", "OPERATOR"), async (req, res) => {
  try {
    const result = await query(
      `
      SELECT
        p.paczka_id,
        p.numer_tracking,
        p.status,
        p.data_nadania,
        n.email AS nadawca_email,
        o.email AS odbiorca_email
      FROM parcel_locker.paczka p
      JOIN parcel_locker.klient n ON n.klient_id = p.nadawca_id
      JOIN parcel_locker.klient o ON o.klient_id = p.odbiorca_id
      WHERE p.status = 'CZEKA_NA_ZATWIERDZENIE'
      ORDER BY p.data_nadania DESC
      `
    )

    res.json({ ok: true, paczki: result.rows })
  } catch (err) {
    res.status(500).json({ ok: false, error: "Get pending packages failed" })
  }
})

router.post("/paczki/:id/approve", requireAuth, requireRoles("ADMIN", "OPERATOR"), async (req, res) => {
  try {
    const paczkaId = Number(req.params.id)
    if (!Number.isInteger(paczkaId) || paczkaId <= 0) {
      return res.status(400).json({ ok: false, error: "Niepoprawne ID paczki." })
    }

    const upd = await query(
      `
      UPDATE parcel_locker.paczka
      SET status = 'NADANA'
      WHERE paczka_id = $1
        AND status = 'CZEKA_NA_ZATWIERDZENIE'
      RETURNING paczka_id, status
      `,
      [paczkaId]
    )

    if (upd.rowCount === 0) {
      return res.status(409).json({ ok: false, error: "Nie można zatwierdzić (zły status lub już obsłużona)." })
    }

    await query(
      `
      INSERT INTO parcel_locker.zdarzeniepaczki(paczka_id, typ, opis)
      VALUES ($1, 'UTWORZONA', 'Zatwierdzona przez operatora')
      `,
      [paczkaId]
    )

    res.json({ ok: true, paczka: upd.rows[0] })
  } catch (err) {
    res.status(500).json({ ok: false, error: "Approve failed" })
  }
})

export default router
