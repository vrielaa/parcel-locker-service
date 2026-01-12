import { Router } from "express"
import { query } from "../db.js"
import { requireAuth, requireRole } from "../middleware/auth.js"

const router = Router()

router.get("/me/paczki", requireAuth, requireRole(["KLIENT"]), async (req, res) => {
  const klientId = req.user.klientId

  const result = await query(
    `
    SELECT paczka_id, numer_tracking, status, termin_odbioru, skrytka_id
    FROM parcel_locker.paczka
    WHERE odbiorca_id = $1
    ORDER BY data_nadania DESC
    `,
    [klientId]
  )

  res.json({ ok: true, paczki: result.rows })
})

router.get("/paczki/:id/zdarzenia", requireAuth, async (req, res) => {
  const paczkaId = Number(req.params.id)

  if (req.user.rola === "KLIENT") {
    const own = await query(
      `
      SELECT 1
      FROM parcel_locker.paczka
      WHERE paczka_id = $1 AND odbiorca_id = $2
      LIMIT 1
      `,
      [paczkaId, req.user.klientId]
    )

    if (own.rowCount === 0) return res.status(403).json({ ok: false, error: "Forbidden" })
  }

  const result = await query(
    `
    SELECT zdarzenie_id, typ, czas, opis
    FROM parcel_locker.zdarzeniepaczki
    WHERE paczka_id = $1
    ORDER BY czas DESC
    `,
    [paczkaId]
  )

  res.json({ ok: true, zdarzenia: result.rows })
})

router.post("/paczki/:id/przedluzenia", requireAuth, requireRole(["KLIENT"]), async (req, res) => {
  const paczkaId = Number(req.params.id)
  const { ile_godzin } = req.body

  const own = await query(
    `
    SELECT termin_odbioru
    FROM parcel_locker.paczka
    WHERE paczka_id = $1 AND odbiorca_id = $2
    LIMIT 1
    `,
    [paczkaId, req.user.klientId]
  )

  if (own.rowCount === 0) return res.status(403).json({ ok: false, error: "Forbidden" })

  await query(
    `
    INSERT INTO parcel_locker.przedluzenie(paczka_id, klient_id, ile_godzin)
    VALUES ($1, $2, $3)
    `,
    [paczkaId, req.user.klientId, ile_godzin]
  )

  await query(
    `
    INSERT INTO parcel_locker.zdarzeniepaczki(paczka_id, typ, opis)
    VALUES ($1, 'PRZEDLUZONA', $2)
    `,
    [paczkaId, `Przedłużenie o ${ile_godzin} godzin`]
  )

  res.json({ ok: true })
})

router.post("/paczki", requireAuth, requireRole(["OPERATOR"]), async (req, res) => {
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
