export const API_BASE = "/api"

export const getToken = () => localStorage.getItem("token")
export const setToken = (t) => localStorage.setItem("token", t)

export const clearToken = () => {
  localStorage.removeItem("token")
  localStorage.removeItem("rola")
}

export const redirectToLogin = (reason = "") => {
  console.warn("[redirectToLogin]", reason)
  console.trace()
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
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  })

  if (res.status === 401) {
    const data = await safeJson(res)
    const err = new Error("AUTH_REQUIRED")
    err.status = 401
    err.data = data
    err.path = path
    throw err
  }

  if (res.status === 403) {
    const data = await safeJson(res)
    const err = new Error("FORBIDDEN")
    err.status = 403
    err.data = data
    err.path = path
    throw err
  }

  return res
}

export async function callApi(path, options = {}) {
  try {
    const res = await apiFetch(path, options)
    const data = await safeJson(res)

    if (!res.ok) return null

    return data ?? { ok: true }
  } catch (err) {
    return null
  }
}

export const authGuard = async () => {
  const token = getToken()
  if (!token) return null

  try {
    const res = await apiFetch("/auth/me", { method: "GET" })
    const data = await res.json().catch(() => null)

    if (!res.ok || !data?.ok || !data?.user) return null

    return data.user
  } catch (err) {
    if (err?.status === 401 || err?.message === "AUTH_REQUIRED") {
      clearToken()
      return null
    }

    return null
  }
}
