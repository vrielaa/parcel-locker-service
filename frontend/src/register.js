import { displayMessageForSeconds } from "./messages.js"
import { API_BASE } from "./api.js"

const getElById = (id) => document.getElementById(id)

const SELECTORS = {
  formId: "register-form",
  errorId: "register-error",
  emailId: "email",
  passwordId: "password",
  password2Id: "password2",
  firstNameId: "first-name",
  lastNameId: "last-name",
  phoneId: "phone",
  submitBtnId: "register-button",
  messageId: "db-message"
}

const normalizeEmail = (v) => String(v || "").trim().toLowerCase()
const normalizeText = (v) => String(v || "").trim()
const normalizePhone = (v) => {
  const s = String(v || "").trim()
  return s ? s : null
}

const setDisabled = (formEl, submitBtn, disabled) => {
  if (formEl) {
    const inputs = formEl.querySelectorAll("input, button, select, textarea")
    inputs.forEach((el) => (el.disabled = disabled))
  }

  if (submitBtn) submitBtn.disabled = disabled
}

const setError = (errorEl, text) => {
  if (!errorEl) return
  errorEl.textContent = text || ""
}

const readJsonSafe = async (res) => {
  try {
    return await res.json()
  } catch {
    return null
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const formEl = getElById(SELECTORS.formId)
  const errorEl = getElById(SELECTORS.errorId)

  const firstNameEl = getElById(SELECTORS.firstNameId)
  const lastNameEl = getElById(SELECTORS.lastNameId)
  const phoneEl = getElById(SELECTORS.phoneId)

  const emailEl = getElById(SELECTORS.emailId)
  const passwordEl = getElById(SELECTORS.passwordId)
  const password2El = getElById(SELECTORS.password2Id)

  const submitBtn = getElById(SELECTORS.submitBtnId)

  if (!formEl || !errorEl || !firstNameEl || !lastNameEl || !emailEl || !passwordEl || !password2El || !submitBtn) return

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault()
    setError(errorEl, "")

    const imie = normalizeText(firstNameEl.value)
    const nazwisko = normalizeText(lastNameEl.value)
    const telefon = normalizePhone(phoneEl?.value)

    const email = normalizeEmail(emailEl.value)
    const password = String(passwordEl.value || "")
    const password2 = String(password2El.value || "")

    if (!imie || !nazwisko || !email) {
      setError(errorEl, "Uzupełnij imię, nazwisko i email.")
      return
    }

    if (!password || password.length < 8) {
      setError(errorEl, "Hasło musi mieć min. 8 znaków.")
      return
    }

    if (password !== password2) {
      setError(errorEl, "Hasła nie są takie same.")
      return
    }

    setDisabled(formEl, submitBtn, true)
    // displayMessageForSeconds("Rejestracja...", 2, "db-message")

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imie,
          nazwisko,
          email,
          telefon,
          password,
          password2
        })
      })

      const data = await readJsonSafe(res)

      if (!res.ok) {
        setError(errorEl, data?.error || `Rejestracja nieudana (${res.status})`)
        setDisabled(formEl, submitBtn, false)
        return
      }

      const token = data?.token
      const rola = data?.rola
      const mustChange = data?.must_change_password

      if (!token || !rola) {
        setError(errorEl, "Brak tokena/roli w odpowiedzi z serwera.")
        setDisabled(formEl, submitBtn, false)
        return
      }

      localStorage.setItem("token", token)
      localStorage.setItem("rola", String(rola || "").toUpperCase())
      localStorage.removeItem("access_token")
      localStorage.removeItem("klient_id")
      localStorage.removeItem("klientId")
      localStorage.removeItem("userId")

      if (mustChange) {
        window.location.href = "change-password.html"
        return
      }

      window.location.href = "app.html"
    } catch (err) {
      setError(errorEl, err?.message || "Rejestracja nieudana.")
      setDisabled(formEl, submitBtn, false)
    }
  })
})
