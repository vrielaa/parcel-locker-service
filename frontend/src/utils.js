export const qs = (selector) => document.querySelector(selector)
export const qsa = (selector) => document.querySelectorAll(selector)
export const getElById = (id) => document.getElementById(id)

export const addClass = (el, className) => el.classList.add(className)
export const removeClass = (el, className) => el.classList.remove(className)
export const hasClass = (el, className) => el.classList.contains(className)




//package info helpers
export const getPickupDeadline = (p) =>
  p.termin_odbioru ?? p.odbior_do ?? p.terminOdbioru ?? p.odbiorDo ?? null

export const getReceiverLabel = (p) => {
  const email = p?.odbiorca_email ?? p?.odbiorcaEmail ?? null
  if (email) return email

  const id = p?.odbiorca_id ?? p?.odbiorcaId ?? null
  if (id) return `odbiorca #${id}`

  return "-"
}


export const isAfterDeadline = (p) => {
  const raw = getPickupDeadline(p)
  if (!raw) return false

  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return false

  return Date.now() > d.getTime()
}

export const getPackageId = (p) => p?.paczka_id ?? p?.id ?? null

export const getSenderLabel = (p) => {
  const email = p?.nadawca_email ?? p?.nadawcaEmail ?? null
  if (email) return email

  const id = p?.nadawca_id ?? p?.nadawcaId ?? null
  if (id) return `nadawca #${id}`

  return "-"
}

export const getTracking = (p) => p?.numer_tracking ?? p?.tracking ?? p?.numer ?? "-"

export const getLockerName = (p) =>
  p?.automat_nazwa ??
  p?.automatNazwa ??
  p?.nazwa_automatu ??
  p?.automat?.nazwa ??
  p?.automat?.name ??
  "-"

export const getLockerLocation = (p) =>
  p?.automat_adres ??
  p?.automatAdres ??
  p?.adres_automatu ??
  p?.automat?.adres ??
  p?.automat?.address ??
  "-"

export const normalizeRole = () => (localStorage.getItem("rola") || "").trim().toUpperCase()
export const normalizeStatus = (s) => String(s || "").trim().toUpperCase()

export const isArrivedStatus = (p) => {
  const s = normalizeStatus(p?.status)
  return s === "W_AUTOMACIE" || s === "ODEBRANA" || s === "PRZETERMINOWANA"
}

export const isInLocker = (p) => normalizeStatus(p?.status) === "W_AUTOMACIE"

export const formatPickupDeadline = (p) => {
  const raw = getPickupDeadline(p)
  if (!raw) return "-"
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return "-"
  return d.toLocaleString()
}