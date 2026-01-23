import { Router } from "express"
import { query } from "../db.js"
import { requireAuth } from "../middleware/auth.js"
import { requireRoles } from "../middleware/requireRoles.js"

const router = Router()

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

export default router
