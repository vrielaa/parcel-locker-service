import { Router } from "express"
import { query, pool } from "../db.js"
import { requireAuth } from "../middleware/auth.js"
import { requireRoles } from "../middleware/requireRoles.js"

const router = Router()


router.get("/paczki/:id/zdarzenia", requireAuth, async (req, res) => {
  const paczkaId = Number(req.params.id)
  if (!Number.isInteger(paczkaId) || paczkaId <= 0) return res.status(400).json({ ok: false, error: "Niepoprawne ID paczki." })

  if (req.user.rola === "KLIENT") {
    const own = await query(
      `
      SELECT 1
      FROM parcel_locker.paczka
      WHERE paczka_id = $1 AND (odbiorca_id = $2 OR nadawca_id = $2)
      LIMIT 1
      `,
      [paczkaId, req.user.klientId]
    )

    if (own.rowCount === 0) return res.status(403).json({ ok: false, error: "Forbidden" })
  }

  const info = await query(
    `
    SELECT
      s.automat_id,
      a.nazwa AS automat_nazwa,
      a.adres AS automat_adres
    FROM parcel_locker.paczka p
    LEFT JOIN parcel_locker.skrytka s ON s.skrytka_id = p.skrytka_id
    LEFT JOIN parcel_locker.automat a ON a.automat_id = s.automat_id
    WHERE p.paczka_id = $1
    LIMIT 1
    `,
    [paczkaId]
  )

  const result = await query(
    `
    SELECT zdarzenie_id, typ, czas, opis
    FROM parcel_locker.zdarzeniepaczki
    WHERE paczka_id = $1
    ORDER BY czas DESC
    `,
    [paczkaId]
  )

  const row = info.rows[0] || {}

  res.json({
    ok: true,
    zdarzenia: result.rows,
    automat_id: row.automat_id ?? null,
    automat_nazwa: row.automat_nazwa ?? null,
    automat_adres: row.automat_adres ?? null
  })
})

router.post("/paczki/:id/przedluzenia", requireAuth, requireRoles("KLIENT"), async (req, res) => {
  const paczkaId = Number(req.params.id)
  const ile_godzin = Number(req.body?.ile_godzin)

  if (!Number.isInteger(paczkaId) || paczkaId <= 0) {
    return res.status(400).json({ ok: false, error: "Niepoprawne ID paczki." })
  }

  if (!Number.isFinite(ile_godzin) || ile_godzin <= 0) {
    return res.status(400).json({ ok: false, error: "Niepoprawna liczba godzin." })
  }

  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const own = await client.query(
      `
      SELECT paczka_id, status, termin_odbioru
      FROM parcel_locker.paczka
      WHERE paczka_id = $1 AND odbiorca_id = $2
      FOR UPDATE
      LIMIT 1
      `,
      [paczkaId, req.user.klientId]
    )

    if (own.rowCount === 0) {
      await client.query("ROLLBACK")
      return res.status(403).json({ ok: false, error: "Forbidden" })
    }

    const { status, termin_odbioru } = own.rows[0]
    const statusUpper = String(status || "").toUpperCase()

    if (statusUpper !== "W_AUTOMACIE") {
      await client.query("ROLLBACK")
      return res.status(409).json({ ok: false, error: "Nie można przedłużyć paczki w tym statusie." })
    }

    if (!termin_odbioru || new Date(termin_odbioru).getTime() <= Date.now()) {
      await client.query("ROLLBACK")
      return res.status(409).json({ ok: false, error: "Minął termin odbioru – paczka została odesłana." })
    }

    await client.query(
      `
      INSERT INTO parcel_locker.przedluzenie(paczka_id, klient_id, ile_godzin)
      VALUES ($1, $2, $3)
      `,
      [paczkaId, req.user.klientId, ile_godzin]
    )

    const upd = await client.query(
      `
      UPDATE parcel_locker.paczka
      SET termin_odbioru = termin_odbioru + make_interval(hours => $3::int)
      WHERE paczka_id = $1 AND odbiorca_id = $2
      RETURNING termin_odbioru
      `,
      [paczkaId, req.user.klientId, ile_godzin]
    )

    await client.query(
      `
      INSERT INTO parcel_locker.zdarzeniepaczki(paczka_id, typ, opis)
      VALUES ($1, 'PRZEDLUZONA', $2)
      `,
      [paczkaId, `Przedłużenie o ${ile_godzin} godzin`]
    )

    await client.query("COMMIT")

    res.json({ ok: true, termin_odbioru: upd.rows[0]?.termin_odbioru })
  } catch (err) {
    try {
      await client.query("ROLLBACK")
    } catch {}
    res.status(500).json({ ok: false, error: "Błąd serwera." })
  } finally {
    client.release()
  }
})

router.post("/paczki", requireAuth, requireRoles("OPERATOR"), async (req, res) => {
  const { numer_tracking, szerokosc_cm, wysokosc_cm, glebokosc_cm, nadawca_id, odbiorca_id } = req.body

  const result = await query(
    `
    INSERT INTO parcel_locker.paczka
    (numer_tracking, szerokosc_cm, wysokosc_cm, glebokosc_cm, nadawca_id, odbiorca_id, status)
    VALUES ($1,$2,$3,$4,$5,$6,'NADANA')
    RETURNING paczka_id
    `,
    [numer_tracking, szerokosc_cm, wysokosc_cm, glebokosc_cm, nadawca_id, odbiorca_id]
  )

  const paczkaId = result.rows[0].paczka_id

  await query(
    `
    INSERT INTO parcel_locker.zdarzeniepaczki(paczka_id, typ, opis)
    VALUES ($1, 'UTWORZONA', 'Utworzono paczkę')
    `,
    [paczkaId]
  )

  res.json({ ok: true, paczka_id: paczkaId })
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
      SELECT p.paczka_id, p.status, p.skrytka_id,
             s.automat_id,
             a.nazwa AS automat_nazwa
      FROM parcel_locker.paczka p
      JOIN parcel_locker.skrytka s ON s.skrytka_id = p.skrytka_id
      JOIN parcel_locker.automat a ON a.automat_id = s.automat_id
      WHERE p.paczka_id = $1
      FOR UPDATE
      `,
      [paczkaId]
    )

    if (p.rowCount === 0) {
      await client.query("ROLLBACK")
      return res.status(404).json({ ok: false, error: "Paczka nie istnieje albo nie jest w automacie" })
    }

    const row = p.rows[0]
    if (String(row.status || "").toUpperCase() !== "W_AUTOMACIE" || !row.skrytka_id) {
      await client.query("ROLLBACK")
      return res.status(409).json({ ok: false, error: "Paczki nie można podjąć w tym statusie" })
    }

    const allowed = await client.query(
      `
      SELECT 1
      FROM parcel_locker.obslugaautomatu oa
      WHERE oa.kurier_id = $1
        AND oa.automat_id = $2
        AND oa.data_od <= CURRENT_TIMESTAMP
        AND (oa.data_do IS NULL OR oa.data_do >= CURRENT_TIMESTAMP)
      LIMIT 1
      `,
      [kurierId, row.automat_id]
    )

    if (allowed.rowCount === 0) {
      await client.query("ROLLBACK")
      return res.status(403).json({ ok: false, error: "Kurier nie jest przypisany do tego automatu" })
    }

    await client.query(
      `
      UPDATE parcel_locker.skrytka
      SET status = 'WOLNA'
      WHERE skrytka_id = $1
      `,
      [row.skrytka_id]
    )

    const upd = await client.query(
      `
      UPDATE parcel_locker.paczka
      SET skrytka_id = NULL,
          status = 'W_DRODZE'
      WHERE paczka_id = $1
      RETURNING paczka_id, numer_tracking, status, skrytka_id, data_nadania, termin_odbioru, data_odbioru
      `,
      [paczkaId]
    )

    await client.query(
      `
      INSERT INTO parcel_locker.zdarzeniepaczki (paczka_id, typ, opis)
      VALUES
        ($1, 'WYJETA_Z_AUTOMATU', $2),
        ($1, 'W_DRODZE', 'Paczka w transporcie')
      `,
      [paczkaId, `Podjęta przez kuriera z automatu ${row.automat_nazwa} (ID: ${row.automat_id})`]
    )

    await client.query("COMMIT")
    res.json({ ok: true, paczka: upd.rows[0] })
  } catch (err) {
    try { await client.query("ROLLBACK") } catch {}
    res.status(500).json({ ok: false, error: "Błąd serwera" })
  } finally {
    client.release()
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
      SELECT paczka_id, status, skrytka_id
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

    const allowed = await client.query(
      `
      SELECT 1
      FROM parcel_locker.obslugaautomatu oa
      WHERE oa.kurier_id = $1
        AND oa.automat_id = $2
        AND oa.data_od <= CURRENT_TIMESTAMP
        AND (oa.data_do IS NULL OR oa.data_do >= CURRENT_TIMESTAMP)
      LIMIT 1
      `,
      [kurierId, sr.automat_id]
    )

    if (allowed.rowCount === 0) {
      await client.query("ROLLBACK")
      return res.status(403).json({ ok: false, error: "Kurier nie jest przypisany do tego automatu" })
    }

    const upd = await client.query(
      `
      UPDATE parcel_locker.paczka
      SET skrytka_id = $2,
          status = 'W_AUTOMACIE',
          termin_odbioru = COALESCE(termin_odbioru, CURRENT_TIMESTAMP + INTERVAL '48 hours')
      WHERE paczka_id = $1
      RETURNING paczka_id, numer_tracking, status, skrytka_id, data_nadania, termin_odbioru, data_odbioru
      `,
      [paczkaId, skrytkaId]
    )

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
    const msg = String(err?.message || "")
    if (msg.includes("Paczka nie mieści się w skrytce")) return res.status(409).json({ ok: false, error: "Paczka nie mieści się w skrytce" })
    if (msg.includes("Skrytka nie istnieje lub nie jest wolna")) return res.status(409).json({ ok: false, error: "Skrytka nie jest wolna" })
    res.status(500).json({ ok: false, error: "Błąd serwera" })
  } finally {
    client.release()
  }
})

export default router
