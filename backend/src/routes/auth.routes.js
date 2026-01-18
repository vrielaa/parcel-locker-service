// backend/src/routes/auth.routes.js
import { Router } from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { requireAuth } from "../middleware/auth.js"
import { logInfo, logWarn, maskToken } from "../logger.js"
import { query, pool } from "../db.js"

const router = Router()

router.post("/register", async (req, res) => {
  const { imie, nazwisko, email, telefon, password, password2 } = req.body

  const imieTrim = String(imie || "").trim()
  const nazwiskoTrim = String(nazwisko || "").trim()
  const emailTrim = String(email || "").trim().toLowerCase()
  const telefonTrim = String(telefon || "").trim() || null

  if (!imieTrim || !nazwiskoTrim || !emailTrim) {
    return res.status(400).json({ ok: false, error: "Uzupełnij imię, nazwisko i email." })
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ ok: false, error: "Hasło musi mieć min. 8 znaków." })
  }

  if (password !== password2) {
    return res.status(400).json({ ok: false, error: "Hasła nie są takie same." })
  }

  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const existingAppUser = await client.query(
      `
      SELECT app_user_id
      FROM parcel_locker.appuser
      WHERE email = $1
      LIMIT 1
      `,
      [emailTrim]
    )

    if (existingAppUser.rowCount > 0) {
      await client.query("ROLLBACK")
      return res.status(409).json({ ok: false, error: "Konto o tym emailu już istnieje." })
    }

    const existingClient = await client.query(
      `
      SELECT klient_id
      FROM parcel_locker.klient
      WHERE email = $1
      LIMIT 1
      FOR UPDATE
      `,
      [emailTrim]
    )

    let klientId = null

    if (existingClient.rowCount === 0) {
      const ins = await client.query(
        `
        INSERT INTO parcel_locker.klient (imie, nazwisko, email, telefon)
        VALUES ($1, $2, $3, $4)
        RETURNING klient_id
        `,
        [imieTrim, nazwiskoTrim, emailTrim, telefonTrim]
      )

      klientId = ins.rows[0]?.klient_id ?? null
    } else {
      klientId = existingClient.rows[0]?.klient_id ?? null

      await client.query(
        `
        UPDATE parcel_locker.klient
        SET imie = $2,
            nazwisko = $3,
            telefon = $4
        WHERE klient_id = $1
        `,
        [klientId, imieTrim, nazwiskoTrim, telefonTrim]
      )
    }

    if (!klientId) {
      await client.query("ROLLBACK")
      return res.status(500).json({ ok: false, error: "Nie udało się utworzyć profilu klienta." })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const insUser = await client.query(
      `
      INSERT INTO parcel_locker.appuser (email, password_hash, rola, klient_id, must_change_password)
      VALUES ($1, $2, 'KLIENT', $3, FALSE)
      RETURNING app_user_id, rola, klient_id, must_change_password
      `,
      [emailTrim, passwordHash, klientId]
    )

    const user = insUser.rows[0]

    const token = jwt.sign(
      {
        appUserId: user.app_user_id,
        rola: user.rola,
        klientId: user.klient_id,
        pracownikId: null
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    )

    await client.query("COMMIT")

    logInfo("REGISTER ok", {
      ip: req.ip,
      email: emailTrim,
      appUserId: user.app_user_id,
      rola: user.rola,
      token: maskToken(token),
      exp: "2h"
    })

    res.json({ ok: true, token, rola: user.rola, must_change_password: user.must_change_password })
  } catch (err) {
    try { await client.query("ROLLBACK") } catch {}

    const msg = String(err?.message || "")

    if (msg.includes("duplicate key")) {
      return res.status(409).json({ ok: false, error: "Konto o tym emailu już istnieje." })
    }

    console.error(err)
    res.status(500).json({ ok: false, error: "Register failed" })
  } finally {
    client.release()
  }
})




router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body
    

    const result = await query(
      `
      SELECT app_user_id, email, password_hash, rola, klient_id, pracownik_id, must_change_password
      FROM parcel_locker.appuser
      WHERE email = $1
      LIMIT 1
      `,
      [email]
    )

    const user = result.rows[0]
    if (!user) {
      logWarn("LOGIN failed - no such user", { email, ip: req.ip })
      return res.status(401).json({ ok: false, error: "Bad credentials" })
    }

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      logWarn("LOGIN failed - wrong password", { email, ip: req.ip, appUserId: user.app_user_id })
      return res.status(401).json({ ok: false, error: "Bad credentials" })
    }

    const token = jwt.sign(
      {
        appUserId: user.app_user_id,
        rola: user.rola,
        klientId: user.klient_id,
        pracownikId: user.pracownik_id
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    )

    logInfo("LOGIN ok", {
      ip: req.ip,
      email,
      appUserId: user.app_user_id,
      rola: user.rola,
      token: maskToken(token),
      exp: "2h"
    })

    res.json({ ok: true, token, rola: user.rola, must_change_password: user.must_change_password })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: "Auth failed" })
  }
})

router.get("/me", requireAuth, async (req, res) => {
  try {
    const userId = req.user.appUserId

    const result = await query(
      `
      SELECT app_user_id, email, rola, klient_id, pracownik_id, must_change_password
      FROM parcel_locker.appuser
      WHERE app_user_id = $1
      `,
      [userId]
    )

    const user = result.rows[0]
    if (!user) return res.status(404).json({ ok: false, error: "User not found" })

    res.json({ ok: true, user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: "Me failed" })
  }
})

router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body

    if (!new_password || new_password.length < 8) {
      return res.status(400).json({ ok: false, error: "Hasło musi mieć min. 8 znaków." })
    }

    if (!current_password) {
      return res.status(400).json({ ok: false, error: "Podaj aktualne hasło." })
    }

    if (current_password === new_password) {
      return res.status(400).json({ ok: false, error: "Nowe hasło musi różnić się od aktualnego." })
    }

    const userId = req.user.appUserId

    const result = await query(
      `
      SELECT app_user_id, password_hash, must_change_password
      FROM parcel_locker.appuser
      WHERE app_user_id = $1
      LIMIT 1
      `,
      [userId]
    )

    const user = result.rows[0]
    if (!user) return res.status(404).json({ ok: false, error: "User not found" })

    const ok = await bcrypt.compare(current_password, user.password_hash)
    if (!ok) return res.status(401).json({ ok: false, error: "Aktualne hasło jest niepoprawne." })

    const newHash = await bcrypt.hash(new_password, 10)

    await query(
      `
      UPDATE parcel_locker.appuser
      SET password_hash = $1, must_change_password = FALSE
      WHERE app_user_id = $2
      `,
      [newHash, userId]
    )

    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: "Change password failed" })
  }
})


export default router
