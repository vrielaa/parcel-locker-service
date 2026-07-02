import "../sass/main.scss"
import { getElById } from "./utils.js"
import { displayMessageForSeconds } from "./messages.js"
import { apiFetch, clearToken } from "./api.js"

const form = getElById("change-password-form")
const msgId = "change-password-message"

if (!localStorage.getItem("token")) {
  window.location.href = "/login.html"
}

form.addEventListener("submit", async (e) => {
  e.preventDefault()

  const current_password = form.current_password.value
  const new_password = form.new_password.value

  if (!new_password || new_password.length < 8) {
    displayMessageForSeconds("Nowe hasło musi mieć min. 8 znaków.", 4, msgId)
    return
  }

  // displayMessageForSeconds("Zapisuję...", 2, msgId)

  try {
    const res = await apiFetch("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
      headers: {
        "Content-Type": "application/json"
      }
    })

    const data = await res.json()
    console.log("change-password response:", data)

    if (!res.ok || !data.ok) {
      displayMessageForSeconds("Błąd: " + (data.error || "Nieznany błąd"), 5, msgId)
      return
    }

    // displayMessageForSeconds("Hasło zmienione. Zaloguj się ponownie.", 3, msgId)

    clearToken()
    localStorage.removeItem("rola")

    setTimeout(() => {
      window.location.href = "/login.html"
    }, 900)
  } catch (err) {
    displayMessageForSeconds("Błąd: " + err.message, 5, msgId)
  }
})
