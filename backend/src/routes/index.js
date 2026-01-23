import { Router } from "express"
import authRoutes from "./auth.routes.js"
import dbAdminRoutes from "./dbAdmin.routes.js"
import automatyRoutes from "./automaty.routes.js"
import paczkiRoutes from "./paczki.routes.js"
import meRoutes from "./me.routes.js"
import operatorRoutes from "./operator.routes.js"
import kurierRoutes from "./kurier.routes.js"
import adminRoutes from "./admin.routes.js"

const router = Router()

router.use("/auth", authRoutes)
router.use("/db", dbAdminRoutes)
router.use("/", automatyRoutes)
router.use("/", paczkiRoutes)
router.use("/me", meRoutes)
router.use("/operator", operatorRoutes)
router.use("/kurier", kurierRoutes)
router.use("/admin", adminRoutes)


export default router
