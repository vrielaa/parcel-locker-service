import { Router } from "express"
import { query, pool } from "../db.js"
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

        p.szerokosc_cm,
        p.wysokosc_cm,
        p.glebokosc_cm,

        p.docelowy_automat_id,
        ad.nazwa AS docelowy_automat_nazwa,
        ad.adres AS docelowy_automat_adres,

        n.email AS nadawca_email,
        o.email AS odbiorca_email
      FROM parcel_locker.paczka p
      JOIN parcel_locker.klient n ON n.klient_id = p.nadawca_id
      JOIN parcel_locker.klient o ON o.klient_id = p.odbiorca_id
      LEFT JOIN parcel_locker.automat ad ON ad.automat_id = p.docelowy_automat_id
      WHERE p.status = 'CZEKA_NA_ZATWIERDZENIE'
      ORDER BY p.data_nadania DESC
      `
    )

    res.json({ ok: true, paczki: result.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: "Get pending packages failed" })
  }
})

router.get("/paczki/:id/skrytki", requireAuth, requireRoles("ADMIN", "OPERATOR"), async (req, res) => {
  try {
    const paczkaId = Number(req.params.id)
    if (!Number.isInteger(paczkaId) || paczkaId <= 0) return res.status(400).json({ ok: false, error: "Niepoprawne ID paczki." })

    const result = await query(
      `
      WITH p AS (
        SELECT
          paczka_id,
          docelowy_automat_id AS automat_id,

          LEAST(szerokosc_cm, wysokosc_cm, glebokosc_cm) AS p1,
          (szerokosc_cm + wysokosc_cm + glebokosc_cm
            - LEAST(szerokosc_cm, wysokosc_cm, glebokosc_cm)
            - GREATEST(szerokosc_cm, wysokosc_cm, glebokosc_cm)) AS p2,
          GREATEST(szerokosc_cm, wysokosc_cm, glebokosc_cm) AS p3
        FROM parcel_locker.paczka
        WHERE paczka_id = $1
        LIMIT 1
      ),
      s AS (
        SELECT
          sk.skrytka_id,
          sk.wiersz,
          sk.kolumna,
          r.kod AS rozmiar_kod,

          LEAST(r.szerokosc_cm, r.wysokosc_cm, r.glebokosc_cm) AS l1,
          (r.szerokosc_cm + r.wysokosc_cm + r.glebokosc_cm
            - LEAST(r.szerokosc_cm, r.wysokosc_cm, r.glebokosc_cm)
            - GREATEST(r.szerokosc_cm, r.wysokosc_cm, r.glebokosc_cm)) AS l2,
          GREATEST(r.szerokosc_cm, r.wysokosc_cm, r.glebokosc_cm) AS l3
        FROM parcel_locker.skrytka sk
        JOIN parcel_locker.rozmiar r ON r.rozmiar_id = sk.rozmiar_id
        WHERE sk.status = 'WOLNA'
          AND sk.automat_id = (SELECT automat_id FROM p)
      )
      SELECT
        skrytka_id,
        wiersz,
        kolumna,
        rozmiar_kod
      FROM s
      WHERE (SELECT p1 FROM p) <= l1
        AND (SELECT p2 FROM p) <= l2
        AND (SELECT p3 FROM p) <= l3
      ORDER BY rozmiar_kod, wiersz, kolumna
      `,
      [paczkaId]
    )

    res.json({ ok: true, skrytki: result.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: "Get lockers failed" })
  }
})



router.post("/paczki/:id/approve", requireAuth, requireRoles("ADMIN", "OPERATOR"), async (req, res) => {

  console.log("Approve package endpoint called")
  const paczkaId = Number(req.params.id)
  const skrytkaId = Number(req.body?.skrytka_id)

  console.log("Approving package", paczkaId, "with locker", skrytkaId)

  if (!Number.isInteger(paczkaId) || paczkaId <= 0) return res.status(400).json({ ok: false, error: "Niepoprawne ID paczki." })
  if (!Number.isInteger(skrytkaId) || skrytkaId <= 0) return res.status(400).json({ ok: false, error: "Niepoprawne skrytka_id." })

    console.log("Connecting to DB")

  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const p = await client.query(
      `
      SELECT paczka_id, status, skrytka_id, docelowy_automat_id
      FROM parcel_locker.paczka
      WHERE paczka_id = $1
      FOR UPDATE
      `,
      [paczkaId]
    )

    if (p.rowCount === 0) {
      await client.query("ROLLBACK")
      return res.status(404).json({ ok: false, error: "Paczka nie istnieje." })
    }

    const pr = p.rows[0]
    if (String(pr.status || "").toUpperCase() !== "CZEKA_NA_ZATWIERDZENIE" || pr.skrytka_id != null) {
      await client.query("ROLLBACK")
      return res.status(409).json({ ok: false, error: "Nie można zatwierdzić (zły status lub już obsłużona)." })
    }

    const s = await client.query(
      `
      SELECT skrytka_id, status, automat_id
      FROM parcel_locker.skrytka
      WHERE skrytka_id = $1
      FOR UPDATE
      `,
      [skrytkaId]
    )

    if (s.rowCount === 0) {
      await client.query("ROLLBACK")
      return res.status(404).json({ ok: false, error: "Skrytka nie istnieje." })
    }

    const sr = s.rows[0]
    if (Number(sr.automat_id) !== Number(pr.docelowy_automat_id)) {
      await client.query("ROLLBACK")
      return res.status(409).json({ ok: false, error: "Skrytka nie należy do docelowego automatu." })
    }

    if (String(sr.status || "").toUpperCase() !== "WOLNA") {
      await client.query("ROLLBACK")
      return res.status(409).json({ ok: false, error: "Skrytka nie jest wolna." })
    }

    await client.query(
      `
      UPDATE parcel_locker.skrytka
      SET status = 'ZAJETA'
      WHERE skrytka_id = $1
      `,
      [skrytkaId]
    )

    const upd = await client.query(
      `
      UPDATE parcel_locker.paczka
      SET status = 'NADANA',
          skrytka_id = $2
      WHERE paczka_id = $1
        AND status = 'CZEKA_NA_ZATWIERDZENIE'
        AND skrytka_id IS NULL
      RETURNING paczka_id, status, skrytka_id
      `,
      [paczkaId, skrytkaId]
    )

    if (upd.rowCount === 0) {
      await client.query("ROLLBACK")
      return res.status(409).json({ ok: false, error: "Nie udało się zatwierdzić." })
    }

    await client.query("COMMIT")
    res.json({ ok: true, paczka: upd.rows[0] })
  } catch (err) {
    try { await client.query("ROLLBACK") } catch {}
    console.error(err)
    res.status(500).json({ ok: false, error: "Approve failed" , message: err?.message || "Internal server error" })
  } finally {
    client.release()
  }
})

export default router
