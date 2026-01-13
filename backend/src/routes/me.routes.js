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

    const szerokosc_cm = Number(req.body?.szerokosc_cm)
    const wysokosc_cm = Number(req.body?.wysokosc_cm)
    const glebokosc_cm = Number(req.body?.glebokosc_cm)

    const odbiorca = req.body?.odbiorca || {}
    const odb_email = String(odbiorca.email || "").trim().toLowerCase()
    const odb_imie = String(odbiorca.imie || "").trim()
    const odb_nazwisko = String(odbiorca.nazwisko || "").trim()
    const odb_telefon = odbiorca.telefon != null ? String(odbiorca.telefon).trim() : null

    if (!Number.isFinite(szerokosc_cm) || szerokosc_cm <= 0) return res.status(400).json({ ok: false, error: "Niepoprawna szerokosc_cm" })
    if (!Number.isFinite(wysokosc_cm) || wysokosc_cm <= 0) return res.status(400).json({ ok: false, error: "Niepoprawna wysokosc_cm" })
    if (!Number.isFinite(glebokosc_cm) || glebokosc_cm <= 0) return res.status(400).json({ ok: false, error: "Niepoprawna glebokosc_cm" })

    if (!odb_email) return res.status(400).json({ ok: false, error: "Brak email odbiorcy" })
    if (!odb_imie) return res.status(400).json({ ok: false, error: "Brak imienia odbiorcy" })
    if (!odb_nazwisko) return res.status(400).json({ ok: false, error: "Brak nazwiska odbiorcy" })

    const numer_tracking = makeTracking()

    const result = await query(
      `
      WITH odb AS (
        INSERT INTO parcel_locker.klient (imie, nazwisko, email, telefon)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO UPDATE
          SET
            imie = EXCLUDED.imie,
            nazwisko = EXCLUDED.nazwisko,
            telefon = COALESCE(EXCLUDED.telefon, parcel_locker.klient.telefon)
        RETURNING klient_id, email
      ),
      p AS (
        INSERT INTO parcel_locker.paczka (
          numer_tracking,
          szerokosc_cm, wysokosc_cm, glebokosc_cm,
          nadawca_id, odbiorca_id,
          skrytka_id,
          status,
          data_nadania, termin_odbioru, data_odbioru
        )
        VALUES (
          $5,
          $6, $7, $8,
          $9, (SELECT klient_id FROM odb),
          NULL,
          'NADANA',
          CURRENT_TIMESTAMP, NULL, NULL
        )
        RETURNING paczka_id, numer_tracking, status, data_nadania, termin_odbioru, skrytka_id, odbiorca_id
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
        (SELECT email FROM odb) AS odbiorca_email,
        (SELECT zdarzenie_id FROM ev) AS zdarzenie_id
      `,
      [
        odb_imie,
        odb_nazwisko,
        odb_email,
        odb_telefon,
        numer_tracking,
        szerokosc_cm,
        wysokosc_cm,
        glebokosc_cm,
        klientId
      ]
    )

    res.status(201).json({ ok: true, paczka: result.rows[0] })
  } catch (err) {
    const msg = String(err?.message || "")
    if (msg.includes("duplicate key value") && msg.includes("numer_tracking")) {
      return res.status(409).json({ ok: false, error: "Kolizja numeru tracking, spróbuj ponownie" })
    }

    console.error(err)
    res.status(500).json({ ok: false, error: "Nie udało się nadać paczki" })
  }
})

export default router
