import { Router } from "express"
import { query, pool } from "../db.js"
import { requireAuth } from "../middleware/auth.js"
import { requireRoles } from "../middleware/requireRoles.js"

const router = Router()

const pgErrorToHttp = (err) => {
  const msg = String(err?.message || "Błąd bazy danych")

  if (err?.code === "P0001") {
    return { status: 409, error: msg }
  }

  if (err?.code === "23514") {
    return { status: 409, error: msg }
  }

  if (err?.code === "23503") {
    return { status: 409, error: "Nieprawidłowe powiązanie danych." }
  }

  if (err?.code === "22P02") {
    return { status: 400, error: "Niepoprawny format danych." }
  }

  return { status: 500, error: "Błąd serwera" }
}


router.get("/paczki/pool", requireAuth, requireRoles("KURIER"), async (req, res) => {
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
        a.nazwa AS docelowy_automat_nazwa,
        a.adres AS docelowy_automat_adres,

        n.email AS nadawca_email,
        o.email AS odbiorca_email

      FROM parcel_locker.paczka p
      JOIN parcel_locker.klient n ON n.klient_id = p.nadawca_id
      JOIN parcel_locker.klient o ON o.klient_id = p.odbiorca_id
      LEFT JOIN parcel_locker.automat a ON a.automat_id = p.docelowy_automat_id

      WHERE p.status = 'NADANA'
        AND p.kurier_id IS NULL

      ORDER BY p.data_nadania DESC
      `
    )

    res.json({ ok: true, paczki: result.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: "Get courier pool failed" })
  }
})

router.get("/paczki", requireAuth, requireRoles("KURIER"), async (req, res) => {
  try {
    const kurierId = req.user?.pracownikId
    if (!kurierId) return res.status(403).json({ ok: false, error: "Brak pracownikId w tokenie" })

    const result = await query(
      `
      SELECT
        p.paczka_id,
        p.numer_tracking,
        p.status,
        p.data_nadania,
        p.termin_odbioru,
        p.skrytka_id,

        p.szerokosc_cm,
        p.wysokosc_cm,
        p.glebokosc_cm,

        p.kurier_id,

        p.docelowy_automat_id,
        a.nazwa AS docelowy_automat_nazwa,
        a.adres AS docelowy_automat_adres,
        parcel_locker.extract_city_from_address(a.adres) AS docelowy_automat_miasto,

        n.email AS nadawca_email,
        o.email AS odbiorca_email

      FROM parcel_locker.paczka p
      JOIN parcel_locker.klient n ON n.klient_id = p.nadawca_id
      JOIN parcel_locker.klient o ON o.klient_id = p.odbiorca_id
      LEFT JOIN parcel_locker.automat a ON a.automat_id = p.docelowy_automat_id

      WHERE p.kurier_id = $1
        AND p.status IN ('W_DRODZE', 'W_AUTOMACIE')

      ORDER BY p.data_nadania DESC
      `,
      [kurierId]
    )

    res.json({ ok: true, paczki: result.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: "Get courier packages failed" })
  }
})

router.post("/paczki/:id/podejmij", requireAuth, requireRoles("KURIER"), async (req, res) => {
  const paczkaId = Number(req.params.id)
  const kurierId = req.user?.pracownikId

  if (!Number.isInteger(paczkaId) || paczkaId <= 0) return res.status(400).json({ ok: false, error: "Niepoprawne ID paczki" })
  if (!kurierId) return res.status(403).json({ ok: false, error: "Brak pracownikId w tokenie" })

  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const p = await client.query(
      `
      SELECT paczka_id, status, docelowy_automat_id, kurier_id
      FROM parcel_locker.paczka
      WHERE paczka_id = $1
      FOR UPDATE
      `,
      [paczkaId]
    )

    if (p.rowCount === 0) {
      await client.query("ROLLBACK")
      return res.status(404).json({ ok: false, error: "Paczka nie istnieje" })
    }

    const pr = p.rows[0]

    if (String(pr.status || "").toUpperCase() !== "NADANA") {
      await client.query("ROLLBACK")
      return res.status(409).json({ ok: false, error: "Transport można rozpocząć tylko dla statusu NADANA" })
    }

    if (pr.kurier_id != null && Number(pr.kurier_id) !== Number(kurierId)) {
      await client.query("ROLLBACK")
      return res.status(409).json({ ok: false, error: "Ta paczka została już podjęta przez innego kuriera" })
    }

    const upd = await client.query(
      `
      UPDATE parcel_locker.paczka
      SET
        status = 'W_DRODZE',
        kurier_id = $2
      WHERE paczka_id = $1
        AND status = 'NADANA'
        AND (kurier_id IS NULL OR kurier_id = $2)
      RETURNING paczka_id, numer_tracking, status, skrytka_id, data_nadania, termin_odbioru, data_odbioru, docelowy_automat_id, kurier_id
      `,
      [paczkaId, kurierId]
    )

    if (upd.rowCount === 0) {
      await client.query("ROLLBACK")
      return res.status(409).json({ ok: false, error: "Nie udało się podjąć paczki (możliwy konflikt)" })
    }

    await client.query(
      `
      INSERT INTO parcel_locker.zdarzeniepaczki (paczka_id, typ, opis)
      VALUES ($1, 'W_DRODZE', 'Kurier rozpoczął transport')
      `,
      [paczkaId]
    )

    await client.query("COMMIT")
    res.json({ ok: true, paczka: upd.rows[0] })
  } catch (err) {
    try { await client.query("ROLLBACK") } catch {}
    console.error(err)
    res.status(500).json({ ok: false, error: "Błąd serwera" })
  } finally {
    client.release()
  }
})

router.get("/paczki/:id/skrytki-docelowe", requireAuth, requireRoles("KURIER"), async (req, res) => {
  try {
    const kurierId = req.user?.pracownikId
    const paczkaId = Number(req.params.id)

    if (!kurierId) return res.status(403).json({ ok: false, error: "Brak pracownikId w tokenie" })
    if (!Number.isInteger(paczkaId) || paczkaId <= 0) return res.status(400).json({ ok: false, error: "Niepoprawne ID paczki." })

    const allowed = await query(
      `
      SELECT 1
      FROM parcel_locker.paczka p
      WHERE p.paczka_id = $1
        AND p.status = 'W_DRODZE'
        AND p.kurier_id = $2
      LIMIT 1
      `,
      [paczkaId, kurierId]
    )

    if (allowed.rowCount === 0) return res.status(403).json({ ok: false, error: "Brak dostępu do tej paczki (nie jest Twoja lub nie jest w transporcie)." })

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
    res.status(500).json({ ok: false, error: "Get destination lockers failed" })
  }
})

router.post("/paczki/:id/umiesc-w-automacie", requireAuth, requireRoles("KURIER"), async (req, res) => {
  const paczkaId = Number(req.params.id)
  const kurierId = req.user?.pracownikId
  const skrytkaId = Number(req.body?.skrytka_id)

  if (!Number.isInteger(paczkaId) || paczkaId <= 0) return res.status(400).json({ ok: false, error: "Niepoprawne ID paczki" })
  if (!Number.isInteger(skrytkaId) || skrytkaId <= 0) return res.status(400).json({ ok: false, error: "Niepoprawne skrytka_id" })
  if (!kurierId) return res.status(403).json({ ok: false, error: "Brak pracownikId w tokenie" })

  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const p = await client.query(
      `
      SELECT paczka_id, status, skrytka_id, docelowy_automat_id, kurier_id
      FROM parcel_locker.paczka
      WHERE paczka_id = $1
      FOR UPDATE
      `,
      [paczkaId]
    )

    if (p.rowCount === 0) {
      await client.query("ROLLBACK")
      return res.status(404).json({ ok: false, error: "Paczka nie istnieje" })
    }

    const pr = p.rows[0]

    if (Number(pr.kurier_id ?? 0) !== Number(kurierId)) {
      await client.query("ROLLBACK")
      return res.status(403).json({ ok: false, error: "Brak dostępu: ta paczka nie jest przypisana do Ciebie" })
    }

    if (String(pr.status || "").toUpperCase() !== "W_DRODZE" || pr.skrytka_id != null) {
      await client.query("ROLLBACK")
      return res.status(409).json({ ok: false, error: "Paczka nie jest w transporcie" })
    }

    const s = await client.query(
      `
      SELECT s.skrytka_id, s.status, s.automat_id, a.nazwa AS automat_nazwa
      FROM parcel_locker.skrytka s
      JOIN parcel_locker.automat a ON a.automat_id = s.automat_id
      WHERE s.skrytka_id = $1
      FOR UPDATE
      `,
      [skrytkaId]
    )

    if (s.rowCount === 0) {
      await client.query("ROLLBACK")
      return res.status(404).json({ ok: false, error: "Skrytka nie istnieje" })
    }

    const sr = s.rows[0]
    if (String(sr.status || "").toUpperCase() !== "WOLNA") {
      await client.query("ROLLBACK")
      return res.status(409).json({ ok: false, error: "Skrytka nie jest wolna" })
    }

    if (Number(sr.automat_id) !== Number(pr.docelowy_automat_id)) {
      await client.query("ROLLBACK")
      return res.status(409).json({ ok: false, error: "Skrytka nie należy do docelowego automatu." })
    }

    const upd = await client.query(
      `
      UPDATE parcel_locker.paczka
      SET
        skrytka_id = $2,
        status = 'W_AUTOMACIE',
        termin_odbioru = COALESCE(termin_odbioru, CURRENT_TIMESTAMP + INTERVAL '48 hours')
      WHERE paczka_id = $1
        AND kurier_id = $3
        AND status = 'W_DRODZE'
        AND skrytka_id IS NULL
      RETURNING paczka_id, numer_tracking, status, skrytka_id, data_nadania, termin_odbioru, data_odbioru, kurier_id
      `,
      [paczkaId, skrytkaId, kurierId]
    )

    if (upd.rowCount === 0) {
      await client.query("ROLLBACK")
      return res.status(409).json({ ok: false, error: "Nie udało się umieścić paczki (możliwy konflikt)" })
    }

    await client.query(
      `
      UPDATE parcel_locker.skrytka
      SET status = 'ZAJETA'
      WHERE skrytka_id = $1
      `,
      [skrytkaId]
    )

    await client.query(
      `
      INSERT INTO parcel_locker.zdarzeniepaczki (paczka_id, typ, opis)
      VALUES ($1, 'W_AUTOMACIE', $2)
      `,
      [paczkaId, `Umieszczona w automacie ${sr.automat_nazwa} (ID: ${sr.automat_id}), skrytka ${skrytkaId}`]
    )

    await client.query("COMMIT")
    res.json({ ok: true, paczka: upd.rows[0] })
  } catch (err) {
    try { await client.query("ROLLBACK") } catch {}

    const mapped = pgErrorToHttp(err)
    return res.status(mapped.status).json({ ok: false, error: mapped.error })
  } finally {
    client.release()
  }
})


export default router
