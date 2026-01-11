import jwt from "jsonwebtoken"

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : null

  if (!token) return res.status(401).json({ ok: false, error: "Unauthorized" })

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ ok: false, error: "Unauthorized" })
  }
}

export function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "Unauthorized" })
    if (!roles.includes(req.user.rola)) return res.status(403).json({ ok: false, error: "Forbidden" })
    next()
  }
}
