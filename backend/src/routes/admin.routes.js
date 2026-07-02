import { Router } from "express"
import bcrypt from "bcrypt"
import { query, pool } from "../db.js"
import { requireAuth } from "../middleware/auth.js"
import { requireRoles } from "../middleware/requireRoles.js"

const router = Router()

const roleKey = (role) => String(role || "").toUpperCase().trim()

const isDbBusinessRuleError = (err) => {
  const code = String(err?.code || "")
  if (code === "P0001") return true
  if (code === "23514") return true
  return false
}

const dbBusinessMessage = (err, fallback) => {
  const msg = String(err?.message || "").trim()
  return msg || fallback || "Operacja zablokowana przez regułę bazy danych."
}

router.get("/users", requireAuth, requireRoles("ADMIN"), async (req, res) => {
  try {
    const result = await query(
      `
      SELECT
        au.app_user_id,
        au.email,
        au.rola,
        au.must_change_password,

        au.klient_id,
        k.imie AS klient_imie,
        k.nazwisko AS klient_nazwisko,

        au.pracownik_id,
        p.imie AS pracownik_imie,
        p.nazwisko AS pracownik_nazwisko,
        p.rola AS pracownik_rola
      FROM parcel_locker.appuser au
      LEFT JOIN parcel_locker.klient k ON k.klient_id = au.klient_id
      LEFT JOIN parcel_locker.pracownik p ON p.pracownik_id = au.pracownik_id
      ORDER BY au.app_user_id DESC
      `
    )

    res.json({ ok: true, users: result.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: "Get users failed" })
  }
})

router.post("/users", requireAuth, requireRoles("ADMIN"), async (req, res) => {
  const role = roleKey(req.body?.role)
  const firstName = String(req.body?.imie || "").trim()
  const lastName = String(req.body?.nazwisko || "").trim()
  const email = String(req.body?.email || "").trim().toLowerCase()
  const phone = String(req.body?.telefon || "").trim()
  const password = String(req.body?.password || "").trim()

  if (!role || !firstName || !lastName || !email || !password) {
    return res.status(400).json({ ok: false, error: "Brak wymaganych pól." })
  }

  if (!["ADMIN", "OPERATOR", "KURIER", "KLIENT"].includes(role)) {
    return res.status(400).json({ ok: false, error: "Niepoprawna rola." })
  }

  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const existing = await client.query(
      `
      SELECT 1
      FROM parcel_locker.appuser
      WHERE email = $1
      LIMIT 1
      `,
      [email]
    )

    if (existing.rowCount > 0) {
      await client.query("ROLLBACK")
      return res.status(409).json({ ok: false, error: "Użytkownik o takim emailu już istnieje." })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    if (role === "KLIENT") {
      const createdClient = await client.query(
        `
        INSERT INTO parcel_locker.klient(imie, nazwisko, email, telefon)
        VALUES ($1, $2, $3, $4)
        RETURNING klient_id
        `,
        [firstName, lastName, email, phone || null]
      )

      const clientId = createdClient.rows[0]?.klient_id

      const createdUser = await client.query(
        `
        INSERT INTO parcel_locker.appuser(email, password_hash, rola, klient_id, pracownik_id, must_change_password)
        VALUES ($1, $2, 'KLIENT', $3, NULL, TRUE)
        RETURNING app_user_id
        `,
        [email, passwordHash, clientId]
      )

      await client.query("COMMIT")
      return res.status(201).json({ ok: true, user: { app_user_id: createdUser.rows[0]?.app_user_id } })
    }

    const createdEmployee = await client.query(
      `
      INSERT INTO parcel_locker.pracownik(imie, nazwisko, email, telefon, rola)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING pracownik_id
      `,
      [firstName, lastName, email, phone || null, role]
    )

    const employeeId = createdEmployee.rows[0]?.pracownik_id

    const createdUser = await client.query(
      `
      INSERT INTO parcel_locker.appuser(email, password_hash, rola, klient_id, pracownik_id, must_change_password)
      VALUES ($1, $2, $3, NULL, $4, TRUE)
      RETURNING app_user_id
      `,
      [email, passwordHash, role, employeeId]
    )

    await client.query("COMMIT")
    res.status(201).json({ ok: true, user: { app_user_id: createdUser.rows[0]?.app_user_id } })
  } catch (err) {
    try {
      await client.query("ROLLBACK")
    } catch {}
    console.error(err)

    if (isDbBusinessRuleError(err)) {
      return res.status(409).json({ ok: false, error: dbBusinessMessage(err, "Create user blocked") })
    }

    res.status(500).json({ ok: false, error: "Create user failed", message: err?.message || "Internal server error" })
  } finally {
    client.release()
  }
})

router.delete("/users/:id", requireAuth, requireRoles("ADMIN"), async (req, res) => {
  const appUserId = Number(req.params.id)
  if (!Number.isInteger(appUserId) || appUserId <= 0) {
    return res.status(400).json({ ok: false, error: "Niepoprawne ID użytkownika." })
  }

  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const userResult = await client.query(
      `
      SELECT app_user_id, rola, klient_id, pracownik_id
      FROM parcel_locker.appuser
      WHERE app_user_id = $1
      FOR UPDATE
      `,
      [appUserId]
    )

    if (userResult.rowCount === 0) {
      await client.query("ROLLBACK")
      return res.status(404).json({ ok: false, error: "Użytkownik nie istnieje." })
    }

    const user = userResult.rows[0]
    const role = roleKey(user?.rola)

    if (role === "KLIENT" && user?.klient_id) {
      await client.query(`DELETE FROM parcel_locker.klient WHERE klient_id = $1`, [user.klient_id])
    } else if (user?.pracownik_id) {
      await client.query(`DELETE FROM parcel_locker.pracownik WHERE pracownik_id = $1`, [user.pracownik_id])
    } else {
      await client.query(`DELETE FROM parcel_locker.appuser WHERE app_user_id = $1`, [appUserId])
    }

    await client.query("COMMIT")
    res.json({ ok: true })
  } catch (err) {
    try {
      await client.query("ROLLBACK")
    } catch {}
    console.error(err)

    if (isDbBusinessRuleError(err)) {
      return res.status(409).json({ ok: false, error: dbBusinessMessage(err, "Delete user blocked") })
    }

    res.status(500).json({ ok: false, error: "Delete user failed", message: err?.message || "Internal server error" })
  } finally {
    client.release()
  }
})

router.get("/clients/:id/paczki", requireAuth, requireRoles("ADMIN"), async (req, res) => {
  const clientId = Number(req.params.id)
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return res.status(400).json({ ok: false, error: "Niepoprawne ID klienta." })
  }

  const mode = String(req.query?.mode || "sent").trim().toLowerCase()
  const isSent = mode !== "received"

  try {
    const clientResult = await query(
      `
      SELECT klient_id, email
      FROM parcel_locker.klient
      WHERE klient_id = $1
      `,
      [clientId]
    )

    if (clientResult.rowCount === 0) return res.status(404).json({ ok: false, error: "Klient nie istnieje." })

    const packagesResult = await query(
      `
      SELECT
        p.paczka_id,
        p.numer_tracking,
        p.status,
        p.data_nadania,
        p.docelowy_automat_id,
        a.nazwa AS docelowy_automat_nazwa,
        a.adres AS docelowy_automat_adres,
        (a.nazwa || ' — ' || a.adres) AS docelowy_automat_label
      FROM parcel_locker.paczka p
      LEFT JOIN parcel_locker.automat a ON a.automat_id = p.docelowy_automat_id
      WHERE ${isSent ? "p.nadawca_id = $1" : "p.odbiorca_id = $1"}
      ORDER BY p.data_nadania DESC
      `,
      [clientId]
    )

    res.json({ ok: true, client: clientResult.rows[0], paczki: packagesResult.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: "Get client packages failed" })
  }
})

router.post("/paczki/:id/simulate-pickup", requireAuth, requireRoles("ADMIN"), async (req, res) => {
  const packageId = Number(req.params.id)
  if (!Number.isInteger(packageId) || packageId <= 0) {
    return res.status(400).json({ ok: false, error: "Niepoprawne ID paczki." })
  }

  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const packageResult = await client.query(
      `
      SELECT paczka_id, status, skrytka_id
      FROM parcel_locker.paczka
      WHERE paczka_id = $1
      FOR UPDATE
      `,
      [packageId]
    )

    if (packageResult.rowCount === 0) {
      await client.query("ROLLBACK")
      return res.status(404).json({ ok: false, error: "Paczka nie istnieje." })
    }

    const packageRow = packageResult.rows[0]
    const status = String(packageRow?.status || "").toUpperCase()

    if (status !== "W_AUTOMACIE") {
      await client.query("ROLLBACK")
      return res.status(409).json({ ok: false, error: "Paczka nie jest w automacie." })
    }

    await client.query(
      `
      UPDATE parcel_locker.paczka
      SET status = 'ODEBRANA',
          data_odbioru = CURRENT_TIMESTAMP
      WHERE paczka_id = $1
      `,
      [packageId]
    )

    if (packageRow?.skrytka_id) {
      await client.query(
        `
        UPDATE parcel_locker.skrytka
        SET status = 'WOLNA'
        WHERE skrytka_id = $1
        `,
        [packageRow.skrytka_id]
      )
    }

    await client.query(
      `
      INSERT INTO parcel_locker.zdarzeniepaczki(paczka_id, typ, opis)
      VALUES ($1, 'ODEBRANA', 'Paczka odebrana (symulacja admina)')
      `,
      [packageId]
    )

    await client.query("COMMIT")
    res.json({ ok: true })
  } catch (err) {
    try {
      await client.query("ROLLBACK")
    } catch {}
    console.error(err)

    if (isDbBusinessRuleError(err)) {
      return res.status(409).json({ ok: false, error: dbBusinessMessage(err, "Operation blocked") })
    }

    res.status(500).json({ ok: false, error: "Simulate pickup failed", message: err?.message || "Internal server error" })
  } finally {
    client.release()
  }
})

router.post("/automaty", requireAuth, requireRoles("ADMIN"), async (req, res) => {

  const code = String(req.body?.kod || "").trim()
  const address = String(req.body?.adres || "").trim()
  const city = String(req.body?.miasto || "").trim()
  const gpsCoordinates = String(req.body?.wspolrzedne || "").trim()
  const rowCount = Number(req.body?.liczbaWierszy)
  const columnCount = Number(req.body?.liczbaKolumn)

  if (!code || !address || !city || !gpsCoordinates || !Number.isInteger(rowCount) || rowCount <= 0 || !Number.isInteger(columnCount) || columnCount <= 0 || rowCount % 2 !== 0) {
    return res.status(400).json({ ok: false, error: "Brak wymaganych pól lub niepoprawne wartości." })
  }
    
  try {
    const result = await query(
      `
      INSERT INTO parcel_locker.Automat(nazwa, adres, wspolrzedne_gps, status, liczba_wierszy, liczba_kolumn)
      VALUES ($1, $2 || ', ' || $3, $4, 'AKTYWNY', $5, $6)
      RETURNING automat_id
      `,
      [code, address, city, gpsCoordinates, rowCount, columnCount]
    )

    res.status(201).json({ ok: true, automat: { automat_id: result.rows[0]?.automat_id } })
  } catch (err) {
    console.error(err)

    if (isDbBusinessRuleError(err)) {
      return res.status(409).json({ ok: false, error: dbBusinessMessage(err, "Create automat blocked") })
    }

    res.status(500).json({ ok: false, error: "Create automat failed", message: err?.message || "Internal server error" })
  }

})

router.delete("/automaty/:id", requireAuth, requireRoles("ADMIN"), async (req, res) => {
  const parcelLockerId = Number(req.params.id)
  if (!Number.isInteger(parcelLockerId) || parcelLockerId <= 0) {
    return res.status(400).json({ ok: false, error: "Niepoprawne ID automatu." })
  }

  try {
    const result = await query(
      `
      DELETE FROM parcel_locker.automat
      WHERE automat_id = $1
      `,
      [parcelLockerId]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Automat nie istnieje." })
    }

    res.json({ ok: true })
  } catch (err) {
    console.error(err)

    if (isDbBusinessRuleError(err)) {
      return res.status(409).json({ ok: false, error: dbBusinessMessage(err, "Delete automat blocked") })
    }

    res.status(500).json({ ok: false, error: "Delete automat failed", message: err?.message || "Internal server error" })
  }
})

router.get("/automaty/locker-faulty", requireAuth, requireRoles("ADMIN"), async (req, res) => {

  try {
    const result = await query(
      `
        SELECT
            a.automat_id,
            a.nazwa,
            a.adres,
            parcel_locker.extract_city_from_address(a.adres) AS miasto,
            COUNT(s.skrytka_id) AS faulty_lockers_count,
            ARRAY_AGG(s.skrytka_id) AS faulty_lockers_ids
        FROM parcel_locker.automat a
        JOIN parcel_locker.skrytka s ON s.automat_id = a.automat_id
        WHERE s.status = 'USZKODZONA'
        GROUP BY a.automat_id, a.nazwa, a.adres
        HAVING COUNT(s.skrytka_id) > 0
        ORDER BY faulty_lockers_count DESC, a.automat_id ASC
        `,
        []
    )

    

    if (result.rowCount === 0) {
      return res.json({ ok: true, lockers: [] })
    }


    res.json({ ok: true, lockers: result.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: "Get faulty lockers failed" })
  }
})

router.put("/automaty/:parcelLockerId/lockers/:lockerId/mark-repaired", requireAuth, requireRoles("ADMIN"), async (req, res) => {
  const parcelLockerId = Number(req.params.parcelLockerId)
  const lockerId = Number(req.params.lockerId)

  if (!Number.isInteger(parcelLockerId) || parcelLockerId <= 0 || !Number.isInteger(lockerId) || lockerId <= 0) {
    return res.status(400).json({ ok: false, error: "Niepoprawne ID automatu lub skrytki." })
  }

  try {
    const result = await query(
      `
      UPDATE parcel_locker.skrytka
      SET status = 'WOLNA'
      WHERE skrytka_id = $1 AND automat_id = $2
      `,
      [lockerId, parcelLockerId]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Skrytka nie istnieje." })
    }

    res.json({ ok: true })
  } catch (err) {
    console.error(err)

    if (isDbBusinessRuleError(err)) {
      return res.status(409).json({ ok: false, error: dbBusinessMessage(err, "Mark locker faulty blocked") })
    }

    res.status(500).json({ ok: false, error: "Mark locker faulty failed", message: err?.message || "Internal server error" })
  }
})



export default router
