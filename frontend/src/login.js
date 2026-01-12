//login.js
import "../sass/main.scss"

import { getElById } from "./utils.js"
import { displayMessageForSeconds } from "./messages.js"
import { API_BASE, setToken, clearToken } from "./api.js"
import { initDbAdminControls } from "./features/dbAdmin.js"

const form = getElById("login-form")
const submitBtn = getElById("login-button")
const loginErrorEl = getElById("login-error")

const clearTokenBtn = getElById("clear-token-button")

if (localStorage.getItem("token")) {
  window.location.href = "/app.html"
}

const goApp = () => {
  window.location.href = "/app.html"
}

clearTokenBtn.addEventListener("click", () => {
  clearToken()
  localStorage.removeItem("rola")
  displayMessageForSeconds("Token usunięty.", 3, "db-message")
})

submitBtn.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    form.dispatchEvent(new Event("submit"))
  }
})

form.addEventListener("submit", async (e) => {
  e.preventDefault()

  const email = form.email.value.trim()
  const password = form.password.value

  if (!email || !password) {
    displayMessageForSeconds("Uzupełnij email i hasło.", 3, "db-message")
    return
  }

  displayMessageForSeconds("Logowanie...", 2, "db-message")

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    })

    const data = await res.json()

    if (!res.ok || !data.ok) {
      displayMessageForSeconds("Błąd logowania: " + (data.error || "Nieznany błąd"), 5, "db-message")

      form.password.value = ""
      form.email.value = ""

      if( res.status === 401 ) {
        loginErrorEl.textContent = "Nieprawidłowy email lub hasło."
        return
      }else if( res.status === 403 ) {
        loginErrorEl.textContent = "Konto nieaktywne. Skontaktuj się z administratorem."
        return
      }else{
        loginErrorEl.textContent = "Błąd logowania. Spróbuj ponownie."
        return
      }
    }

    setToken(data.token)
    localStorage.setItem("rola", data.rola)

    displayMessageForSeconds("Zalogowano. Rola: " + data.rola, 3, "db-message")

    setTimeout(() => {
      if (data.must_change_password) {
        window.location.href = "/change-password.html"
        return
      }
      goApp()
    }, 900)
  } catch (err) {
    displayMessageForSeconds("Błąd: " + err.message, 5, "db-message")
    
  }
})

form.addEventListener("click", (e) => {
  if (!e.target.matches("input, textarea, select")) return
  loginErrorEl.textContent = ""
})


initDbAdminControls()
