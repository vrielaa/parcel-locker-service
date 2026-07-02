import { Router } from "express"
import { query, pool } from "../db.js"
import { requireAuth } from "../middleware/auth.js"
import { requireRoles } from "../middleware/requireRoles.js"

const router = Router()

router.get("/paczki/:id/zdarzenia", requireAuth, async (req, res) => {
  try {
    const packageId = Number(req.params.id)
    if (!Number.isInteger(packageId) || packageId <= 0) {
      return res.status(400).json({ ok: false, error: "Niepoprawne ID paczki." })
    }

    const role = String(req.user?.role || "").trim().toUpperCase()

    const packageResult = await query(
      `
      SELECT
        paczka_id,
        status,
        docelowy_automat_id,
        kurier_id,
        nadawca_id,
        odbiorca_id
      FROM parcel_locker.paczka
      WHERE paczka_id = $1
      LIMIT 1
      `,
      [packageId]
    )

    if (packageResult.rowCount === 0) return res.status(404).json({ ok: false, error: "Paczka nie istnieje" })

    const packageRow = packageResult.rows[0]
    const status = String(packageRow.status || "").trim().toUpperCase()

    if (role === "KLIENT") {
      const clientId = req.user?.clientId
      if (!clientId) return res.status(403).json({ ok: false, error: "Forbidden" })

      const ownsPackage =
        Number(packageRow.odbiorca_id ?? 0) === Number(clientId) ||
        Number(packageRow.nadawca_id ?? 0) === Number(clientId)

      if (!ownsPackage) return res.status(403).json({ ok: false, error: "Forbidden" })
    } else if (role === "KURIER") {
      const courierId = req.user?.employeeId
      if (!courierId) return res.status(403).json({ ok: false, error: "Brak employeeId w tokenie" })

      const isPool = status === "NADANA" && packageRow.kurier_id == null
      const isMine = packageRow.kurier_id != null && Number(packageRow.kurier_id) === Number(courierId)

      if (!isPool && !isMine) return res.status(403).json({ ok: false, error: "Forbidden" })
    } else if (role === "OPERATOR" || role === "ADMIN") {
      // ok
    } else {
      return res.status(403).json({ ok: false, error: "Forbidden" })
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
      [packageId]
    )

    const result = await query(
      `
      SELECT zdarzenie_id, typ, czas, opis
      FROM parcel_locker.zdarzeniepaczki
      WHERE paczka_id = $1
      ORDER BY czas DESC
      `,
      [packageId]
    )

    const row = info.rows[0] || {}

    res.json({
      ok: true,
      zdarzenia: result.rows,
      automat_id: row.automat_id ?? null,
      automat_nazwa: row.automat_nazwa ?? null,
      automat_adres: row.automat_adres ?? null
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: "Błąd serwera" })
  }
})


router.post("/paczki/:id/przedluzenia", requireAuth, requireRoles("KLIENT"), async (req, res) => {
  const packageId = Number(req.params.id)
  const extensionHours = Number(req.body?.ile_godzin)

  if (!Number.isInteger(packageId) || packageId <= 0) return res.status(400).json({ ok: false, error: "Niepoprawne ID paczki." })
  if (!Number.isFinite(extensionHours) || extensionHours <= 0) return res.status(400).json({ ok: false, error: "Niepoprawna liczba godzin." })

  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const ownedPackage = await client.query(
      `
      SELECT paczka_id, status, termin_odbioru
      FROM parcel_locker.paczka
      WHERE paczka_id = $1 AND odbiorca_id = $2
      FOR UPDATE
      LIMIT 1
      `,
      [packageId, req.user.clientId]
    )

    if (ownedPackage.rowCount === 0) {
      await client.query("ROLLBACK")
      return res.status(403).json({ ok: false, error: "Forbidden" })
    }

    const { status, termin_odbioru: pickupDeadline } = ownedPackage.rows[0]
    const statusUpper = String(status || "").toUpperCase()

    if (statusUpper !== "W_AUTOMACIE") {
      await client.query("ROLLBACK")
      return res.status(409).json({ ok: false, error: "Nie można przedłużyć paczki w tym statusie." })
    }

    if (!pickupDeadline || new Date(pickupDeadline).getTime() <= Date.now()) {
      await client.query("ROLLBACK")
      return res.status(409).json({ ok: false, error: "Minął termin odbioru – paczka została odesłana." })
    }

    await client.query(
      `
      INSERT INTO parcel_locker.przedluzenie(paczka_id, klient_id, ile_godzin)
      VALUES ($1, $2, $3)
      `,
      [packageId, req.user.clientId, extensionHours]
    )

    const updatedPackage = await client.query(
      `
      UPDATE parcel_locker.paczka
      SET termin_odbioru = termin_odbioru + make_interval(hours => $3::int)
      WHERE paczka_id = $1 AND odbiorca_id = $2
      RETURNING termin_odbioru
      `,
      [packageId, req.user.clientId, extensionHours]
    )

    await client.query(
      `
      INSERT INTO parcel_locker.zdarzeniepaczki(paczka_id, typ, opis)
      VALUES ($1, 'PRZEDLUZONA', $2)
      `,
      [packageId, `Przedłużenie o ${extensionHours} godzin`]
    )

    await client.query("COMMIT")

    res.json({ ok: true, termin_odbioru: updatedPackage.rows[0]?.termin_odbioru })
  } catch (err) {
    try { await client.query("ROLLBACK") } catch {}
    res.status(500).json({ ok: false, error: "Błąd serwera." })
  } finally {
    client.release()
  }
})

router.post("/paczki", requireAuth, requireRoles("OPERATOR"), async (req, res) => {
  const {
    numer_tracking: trackingNumber,
    szerokosc_cm: widthCm,
    wysokosc_cm: heightCm,
    glebokosc_cm: depthCm,
    nadawca_id: senderId,
    odbiorca_id: receiverId
  } = req.body

  const result = await query(
    `
    INSERT INTO parcel_locker.paczka
    (numer_tracking, szerokosc_cm, wysokosc_cm, glebokosc_cm, nadawca_id, odbiorca_id, status)
    VALUES ($1,$2,$3,$4,$5,$6,'NADANA')
    RETURNING paczka_id
    `,
    [trackingNumber, widthCm, heightCm, depthCm, senderId, receiverId]
  )

  const packageId = result.rows[0].paczka_id

  await query(
    `
    INSERT INTO parcel_locker.zdarzeniepaczki(paczka_id, typ, opis)
    VALUES ($1, 'UTWORZONA', 'Utworzono paczkę')
    `,
    [packageId]
  )

  res.json({ ok: true, paczka_id: packageId })
})

export default router
