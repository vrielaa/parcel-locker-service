import { logInfo, maskToken } from "../logger.js"

export function requestLogger(req, res, next) {
  const auth = req.headers.authorization || ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""

  logInfo("HTTP", {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    token: token ? maskToken(token) : null
  })

  next()
}
