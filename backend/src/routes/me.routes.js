import { Router } from "express"
import crypto from "crypto"
import { query } from "../db.js"
import { requireAuth } from "../middleware/auth.js"
import { requireRoles } from "../middleware/requireRoles.js"

const router = Router()

const makeTracking = () => {
  const ts = new Date().toISOString().replaceAll("-", "").replaceAll(":", "").replace(".", "")
  const rnd = crypto.randomBytes(3).toString("hex").toUpperCase()
  return `TRK-${ts}-${rnd}`
}

router.post("/paczki", requireAuth, requireRoles("KLIENT"), async (req, res) => {
  try {
    const klientId = req.user?.klientId
    if (!klientId) return res.status(403).json({ ok: false, error: "Brak klientId w tokenie" })

    const automatId = Number(req.body?.automat_id)
    if (!Number.isInteger(automatId) || automatId <= 0) {
      return res.status(400).json({ ok: false, error: "Niepoprawny automat_id" })
    }

    const a = await query(
      `
      SELECT automat_id
      FROM parcel_locker.automat
      WHERE automat_id = $1
      LIMIT 1
      `,
      [automatId]
    )
    if (a.rowCount === 0) return res.status(404).json({ ok: false, error: "Automat nie istnieje" })

    const szerokosc_cm = Number(req.body?.szerokosc_cm)
    const wysokosc_cm = Number(req.body?.wysokosc_cm)
    const glebokosc_cm = Number(req.body?.glebokosc_cm)

    const odbiorca = req.body?.odbiorca || {}
    const odb_email = String(req.body?.odbiorca_email ?? odbiorca.email ?? "").trim().toLowerCase()
    const odb_telefon = odbiorca.telefon != null ? String(odbiorca.telefon).trim() : null

    if (!Number.isFinite(szerokosc_cm) || szerokosc_cm <= 0) return res.status(400).json({ ok: false, error: "Niepoprawna szerokosc_cm" })
    if (!Number.isFinite(wysokosc_cm) || wysokosc_cm <= 0) return res.status(400).json({ ok: false, error: "Niepoprawna wysokosc_cm" })
    if (!Number.isFinite(glebokosc_cm) || glebokosc_cm <= 0) return res.status(400).json({ ok: false, error: "Niepoprawna glebokosc_cm" })

    if (!odb_email) return res.status(400).json({ ok: false, error: "Brak email odbiorcy" })

    const numer_tracking = makeTracking()

    const result = await query(
      `
      WITH odb_ins AS (
        INSERT INTO parcel_locker.klient (imie, nazwisko, email, telefon)
        VALUES ('Nieznany', 'Odbiorca', $1, $2)
        ON CONFLICT (email) DO NOTHING
        RETURNING klient_id, email
      ),
      odb AS (
        SELECT klient_id, email FROM odb_ins
        UNION ALL
        SELECT klient_id, email
        FROM parcel_locker.klient
        WHERE email = $1 AND NOT EXISTS (SELECT 1 FROM odb_ins)
      ),
      p AS (
        INSERT INTO parcel_locker.paczka (
          numer_tracking,
          szerokosc_cm, wysokosc_cm, glebokosc_cm,
          nadawca_id, odbiorca_id,
          docelowy_automat_id,
          status
        )
        VALUES (
          $3,
          $4, $5, $6,
          $7, (SELECT klient_id FROM odb LIMIT 1),
          $8,
          'CZEKA_NA_ZATWIERDZENIE'
        )
        RETURNING paczka_id, numer_tracking, status, data_nadania, termin_odbioru, skrytka_id, odbiorca_id, docelowy_automat_id
      ),
      ev AS (
        INSERT INTO parcel_locker.zdarzeniepaczki (paczka_id, typ, opis)
        VALUES ((SELECT paczka_id FROM p), 'UTWORZONA', 'Paczka nadana przez klienta')
        RETURNING zdarzenie_id
      )
      SELECT
        (SELECT paczka_id FROM p) AS paczka_id,
        (SELECT numer_tracking FROM p) AS numer_tracking,
        (SELECT status FROM p) AS status,
        (SELECT data_nadania FROM p) AS data_nadania,
        (SELECT termin_odbioru FROM p) AS termin_odbioru,
        (SELECT skrytka_id FROM p) AS skrytka_id,
        (SELECT docelowy_automat_id FROM p) AS docelowy_automat_id,
        (SELECT email FROM odb LIMIT 1) AS odbiorca_email,
        (SELECT zdarzenie_id FROM ev) AS zdarzenie_id
      `,
      [
        odb_email,
        odb_telefon,
        numer_tracking,
        szerokosc_cm,
        wysokosc_cm,
        glebokosc_cm,
        klientId,
        automatId
      ]
    )

    return res.status(201).json({ ok: true, paczka: result.rows[0] })
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" })
  }
})

router.get("/paczki", requireAuth, requireRoles("KLIENT"), async (req, res) => {
  try {
    const klientId = req.user.klientId
    if (!klientId) return res.status(403).json({ ok: false, error: "Forbidden" })

      await query(
        `
        UPDATE parcel_locker.paczka
        SET termin_odbioru = termin_odbioru
        WHERE status = 'W_AUTOMACIE'
          AND termin_odbioru IS NOT NULL
          AND termin_odbioru < CURRENT_TIMESTAMP
          AND odbiorca_id = $1
        `,
        [klientId]
    )


    const result = await query(
      `
      SELECT
        p.paczka_id,
        p.numer_tracking,
        p.status,
        p.data_nadania,
        p.termin_odbioru,
        p.data_odbioru,
        p.nadawca_id,
        p.odbiorca_id,
        p.skrytka_id,

        s.automat_id,
        a.nazwa AS automat_nazwa,
        a.adres AS automat_adres,

        kn.email AS nadawca_email,
        ko.email AS odbiorca_email
      FROM parcel_locker.paczka p
      LEFT JOIN parcel_locker.skrytka s ON s.skrytka_id = p.skrytka_id
      LEFT JOIN parcel_locker.automat a ON a.automat_id = s.automat_id
      LEFT JOIN parcel_locker.klient kn ON kn.klient_id = p.nadawca_id
      LEFT JOIN parcel_locker.klient ko ON ko.klient_id = p.odbiorca_id
      WHERE
        p.nadawca_id = $1
        OR (p.odbiorca_id = $1 AND p.status <> 'CZEKA_NA_ZATWIERDZENIE')
      ORDER BY p.paczka_id DESC
      `,
      [klientId]
    )

    res.json({ ok: true, paczki: result.rows })
  } catch (err) {
    res.status(500).json({ ok: false, error: "Get packages failed" })
  }
})

export default router
