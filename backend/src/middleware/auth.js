import jwt from "jsonwebtoken"
import { logWarn, logInfo, maskToken } from "../logger.js"

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ""
  const [type, token] = header.split(" ")

  if (type !== "Bearer" || !token) {
    logWarn("AUTH missing token", { path: req.originalUrl, ip: req.ip })
    res.status(401).json({ ok: false, error: "Brak tokena" })
    return
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = payload

    logInfo("AUTH ok", {
      path: req.originalUrl,
      ip: req.ip,
      token: maskToken(token),
      userId: payload.userId,
      rola: payload.rola
    })

    next()
  } catch (err) {
    logWarn("AUTH invalid token", {
      path: req.originalUrl,
      ip: req.ip,
      token: maskToken(token),
      error: err.message
    })
    res.status(401).json({ ok: false, error: "Niepoprawny token" })
  }
}

export function requireRole(roles = []) {
  return (req, res, next) => {
    const role = req.user?.rola
    if (!role || !roles.includes(role)) {
      res.status(403).json({ ok: false, error: "Brak uprawnień" })
      return
    }
    next()
  }
}
