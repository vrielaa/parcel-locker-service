import { Router } from "express"
import authRoutes from "./auth.routes.js"
import databaseAdminRoutes from "./databaseAdmin.routes.js"
import parcelLockerRoutes from "./parcelLockers.routes.js"
import packageRoutes from "./packages.routes.js"
import meRoutes from "./me.routes.js"
import operatorRoutes from "./operator.routes.js"
import courierRoutes from "./courier.routes.js"
import adminRoutes from "./admin.routes.js"

const router = Router()

router.use("/auth", authRoutes)
router.use("/db", databaseAdminRoutes)
router.use("/", parcelLockerRoutes)
router.use("/", packageRoutes)
router.use("/me", meRoutes)
router.use("/operator", operatorRoutes)
router.use("/kurier", courierRoutes)
router.use("/admin", adminRoutes)


export default router
