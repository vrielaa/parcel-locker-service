import { getElById } from "../utils.js"

export function initLogout() {
  const btn = getElById("logout-button")
  if (!btn) return

  btn.addEventListener("click", () => {
    localStorage.removeItem("token")
    localStorage.removeItem("rola")
    window.location.href = "/login.html"
  })
}
