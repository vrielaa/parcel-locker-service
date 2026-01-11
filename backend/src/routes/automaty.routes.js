import { Router } from "express"
import { getAllMiasta, getAutomatyInCity, getAutomatInfoById } from "../utils.js"

const router = Router()

router.get("/miasta", async (req, res) => {
  const miasta = await getAllMiasta()
  res.json(miasta)
})

router.get("/automaty", async (req, res) => {
  const miasto = req.query.miasto
  if (!miasto) return res.json([])
  const automaty = await getAutomatyInCity(miasto)
  res.json(automaty)
})

router.get("/automaty/:id", async (req, res) => {
  const automatId = req.params.id
  const automatInfo = await getAutomatInfoById(automatId)

  if (!automatInfo) return res.status(404).json({ ok: false, error: "Automat not found" })
  res.json(automatInfo)
})

export default router
