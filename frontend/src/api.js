//api.js
import { displayMessageForSeconds } from "./messages.js"

export const API_BASE = "/api"

export const getToken = () => localStorage.getItem("token")
export const setToken = (t) => localStorage.setItem("token", t)
export const clearToken = () => {
  localStorage.removeItem("token")
  localStorage.removeItem("rola")
}

export const redirectToLogin = () => {
  window.location.href = "/login.html"
}

const safeJson = async (res) => {
  const contentType = res.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) return null

  try {
    return await res.json()
  } catch {
    return null
  }
}

export const apiFetch = async (path, options = {}) => {
  const token = getToken()

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  })

  if (res.status === 401) {
    clearToken()
    redirectToLogin()
    throw new Error("AUTH_REQUIRED")
  }

  if (res.status === 403) {
    throw new Error("FORBIDDEN")
  }

  return res
}


export async function callApi(path, options = {}, messageOutputId = "db-message") {
  displayMessageForSeconds("Ładowanie...", 2, messageOutputId)

  try {
      const res = await apiFetch(path, options)
      const data = await safeJson(res)

      if (!res.ok) {
        const msg = data?.error || `HTTP ${res.status}`
        displayMessageForSeconds("Błąd: " + msg, 5, messageOutputId)
        return null
      }

      displayMessageForSeconds("Sukces: " + JSON.stringify(data ?? { ok: true }), 5, messageOutputId)
      return data ?? { ok: true }
    } catch (err) {
      if (err?.message === "AUTH_REQUIRED") return null
      if (err?.message === "FORBIDDEN") return null

      clearToken()
      redirectToLogin()
      return null
  }

}

export const authGuard = async () => {
  const token = getToken()

  if (!token) {
    redirectToLogin()
    return null
  }

  try {
    const res = await apiFetch("/auth/me", { method: "GET" })
    const data = await safeJson(res)

    if (!res.ok || !data?.ok) {
      clearToken()
      redirectToLogin()
      return null
    }

    return data.user
  } catch (err) {
    if (err?.message === "AUTH_REQUIRED") return null

    clearToken()
    redirectToLogin()
    return null
  }
}
