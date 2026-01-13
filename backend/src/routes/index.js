import { Router } from "express"
import authRoutes from "./auth.routes.js"
import dbAdminRoutes from "./dbAdmin.routes.js"
import automatyRoutes from "./automaty.routes.js"
import paczkiRoutes from "./paczki.routes.js"
import meRouter from "./me.routes.js"

const router = Router()

router.use("/auth", authRoutes)
router.use("/db", dbAdminRoutes)
router.use("/", automatyRoutes)
router.use("/", paczkiRoutes)
router.use("/me", meRouter)

export default router
