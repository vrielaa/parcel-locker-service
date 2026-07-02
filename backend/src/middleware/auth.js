import jwt from "jsonwebtoken"
import { logWarn, logInfo, maskToken } from "../logger.js"
import { getJwtSecret } from "../config.js"

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ""
  const [type, token] = header.split(" ")

  if (type !== "Bearer" || !token) {
    logWarn("AUTH missing token", { path: req.originalUrl, ip: req.ip })
    res.status(401).json({ ok: false, error: "Brak tokena" })
    return
  }

  try {
    const payload = jwt.verify(token, getJwtSecret())
    req.user = {
      ...payload,
      role: payload.role ?? payload.rola,
      rola: payload.rola ?? payload.role,
      clientId: payload.clientId ?? payload.klientId,
      employeeId: payload.employeeId ?? payload.pracownikId
    }

    logInfo("AUTH ok", {
      path: req.originalUrl,
      ip: req.ip,
      token: maskToken(token),
      appUserId: req.user.appUserId,
      role: req.user.role
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
