import { Router } from "express"
import { query, pool } from "../db.js"
import { requireAuth } from "../middleware/auth.js"
import { requireRoles } from "../middleware/requireRoles.js"

const router = Router()

router.get("/paczki/:id/zdarzenia", requireAuth, async (req, res) => {

 const paczkaId = Number(req.params.id)
  if (!Number.isInteger(paczkaId) || paczkaId <= 0) {
    return res.status(400).json({ ok: false, error: "Niepoprawne ID paczki." })
  }

  const role = String(req.user?.rola || "").trim().toUpperCase()

  const pRow = await query(
    `
    SELECT paczka_id, status, docelowy_automat_id
    FROM parcel_locker.paczka
    WHERE paczka_id = $1
    LIMIT 1
    `,
    [paczkaId]
  )

  if (pRow.rowCount === 0) return res.status(404).json({ ok: false, error: "Paczka nie istnieje" })

  const paczka = pRow.rows[0]
  const status = String(paczka.status || "").toUpperCase()

  if (role === "KLIENT") {
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

  if (role === "KURIER") {
    const kurierId = req.user?.pracownikId
    if (!kurierId) return res.status(403).json({ ok: false, error: "Brak pracownikId w tokenie" })

    if (status !== "NADANA") {
      const allowed = await query(
        `
        SELECT 1
        FROM parcel_locker.obslugaautomatu oa
        WHERE oa.kurier_id = $1
          AND oa.automat_id = $2
          AND oa.data_od <= CURRENT_TIMESTAMP
          AND (oa.data_do IS NULL OR oa.data_do >= CURRENT_TIMESTAMP)
        LIMIT 1
        `,
        [kurierId, paczka.docelowy_automat_id]
      )

      if (allowed.rowCount === 0) return res.status(403).json({ ok: false, error: "Forbidden" })
    }
  }

  const info = await query(
    `
    SELECT
      COALESCE(s.automat_id, p.docelowy_automat_id) AS automat_id,
      a.nazwa AS automat_nazwa,
      a.adres AS automat_adres
    FROM parcel_locker.paczka p
    LEFT JOIN parcel_locker.skrytka s ON s.skrytka_id = p.skrytka_id
    LEFT JOIN parcel_locker.automat a ON a.automat_id = COALESCE(s.automat_id, p.docelowy_automat_id)
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

  if (!Number.isInteger(paczkaId) || paczkaId <= 0) return res.status(400).json({ ok: false, error: "Niepoprawne ID paczki." })
  if (!Number.isFinite(ile_godzin) || ile_godzin <= 0) return res.status(400).json({ ok: false, error: "Niepoprawna liczba godzin." })

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
    try { await client.query("ROLLBACK") } catch {}
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

export default router
