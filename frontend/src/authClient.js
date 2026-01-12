//authClient.js
import { API_BASE } from "./api.js"

export const getToken = () => localStorage.getItem("token")
export const clearToken = () => {
  localStorage.removeItem("token")
  localStorage.removeItem("rola")
}

export async function fetchMe() {
  const token = getToken()
  if (!token) return null

  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  if (!res.ok) return null

  const data = await res.json()
  if (!data.ok) return null

  return data.user
}
