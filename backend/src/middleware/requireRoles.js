export const requireRoles =
  (...roles) =>
  (req, res, next) => {
    const role = (req.user?.role || req.user?.rola || "").toUpperCase()
    const allowed = roles.map((r) => String(r).toUpperCase())

    if (!role) return res.status(401).json({ ok: false, error: "AUTH_REQUIRED" })
    if (!allowed.includes(role)) return res.status(403).json({ ok: false, error: "FORBIDDEN" })

    next()
  }
