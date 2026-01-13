// backend/src/routes/auth.routes.js
import { Router } from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { query } from "../db.js"
import { requireAuth } from "../middleware/auth.js"
import { logInfo, logWarn, maskToken } from "../logger.js"

const router = Router()

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
