import { Router } from "express"
import { query } from "../db.js"
import { requireAuth } from "../middleware/auth.js"
import { requireRoles } from "../middleware/requireRoles.js"

const router = Router()

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

        p.docelowy_automat_id,
        a.nazwa AS docelowy_automat_nazwa,
        a.adres AS docelowy_automat_adres,

        n.email AS nadawca_email,
        o.email AS odbiorca_email
      FROM parcel_locker.paczka p
      JOIN parcel_locker.klient n ON n.klient_id = p.nadawca_id
      JOIN parcel_locker.klient o ON o.klient_id = p.odbiorca_id
      JOIN parcel_locker.obslugaautomatu oa
        ON oa.automat_id = p.docelowy_automat_id
       AND oa.kurier_id = $1
       AND oa.data_od <= CURRENT_TIMESTAMP
       AND (oa.data_do IS NULL OR oa.data_do >= CURRENT_TIMESTAMP)
      LEFT JOIN parcel_locker.automat a ON a.automat_id = p.docelowy_automat_id
      WHERE p.status IN ('NADANA', 'W_DRODZE', 'W_AUTOMACIE')
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
      JOIN parcel_locker.obslugaautomatu oa
        ON oa.automat_id = p.docelowy_automat_id
      WHERE p.paczka_id = $1
        AND p.status = 'W_DRODZE'
        AND oa.kurier_id = $2
        AND oa.data_od <= CURRENT_TIMESTAMP
        AND (oa.data_do IS NULL OR oa.data_do >= CURRENT_TIMESTAMP)
      LIMIT 1
      `,
      [paczkaId, kurierId]
    )

    if (allowed.rowCount === 0) return res.status(403).json({ ok: false, error: "Brak dostępu do docelowego automatu tej paczki." })

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

export default router
