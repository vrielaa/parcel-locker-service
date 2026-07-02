import { qs, getElById, addClass, removeClass } from "../utils.js"
import { displayMessageForSeconds } from "../messages.js"
import { apiFetch } from "../api.js"
import { createLockerGrid } from "./lockerGrid.js"

const ENDPOINTS = {
  CITIES: "/miasta",
  AUTOMATS_IN_CITY: (miasto) => `/automaty?miasto=${encodeURIComponent(miasto)}`,
  AUTOMAT_LAYOUT: (id) => `/automaty/${id}`,
  MARK_LOCKER_DAMAGED: (id) => `/kurier/skrytki/${id}/status`
}

const getAutomatId = (a) => a?.automat_id ?? a?.id ?? null
const getAutomatName = (a) => a?.nazwa ?? a?.kod ?? a?.name ?? "-"
const getAutomatAddress = (a) => a?.adres ?? a?.address ?? "-"

const normalizeStatus = (s) => String(s ?? "").trim().toUpperCase()

export function initKurierReport() {
  const viewEl = getElById("view-report-problem")
  if (!viewEl) return

  const role = (localStorage.getItem("rola") || "").toUpperCase()
  if (!["KURIER", "ADMIN", "OPERATOR"].includes(role)) return

  const formEl = viewEl.querySelector("#report-problem-form")
  const citySelectEl = viewEl.querySelector("#report-locker-select-city")
  const listEl = viewEl.querySelector(".report-locker-list")

  const lockerDisplayEl = viewEl.querySelector("#report-locker-display")
  const lockerNameEl = viewEl.querySelector("#report-locker-name")
  const lockerInfoEl = viewEl.querySelector("#report-locker-info")
  const gridHostEl = viewEl.querySelector("#report-locker-grid")

  const descriptionEl = viewEl.querySelector("#report-description")

  const selectedAutomatLabelEl = viewEl.querySelector("#report-selected-automat")
  const selectedLockerLabelEl = viewEl.querySelector("#report-selected-locker")

  const automatIdEl = viewEl.querySelector("#report-automat-id")
  const lockerIdEl = viewEl.querySelector("#report-locker-id")

  const submitBtn = viewEl.querySelector("#report-submit")
  const goBackBtn = viewEl.querySelector("#report-go-back")

  if (
    !formEl ||
    !citySelectEl ||
    !listEl ||
    !lockerDisplayEl ||
    !lockerNameEl ||
    !lockerInfoEl ||
    !gridHostEl ||
    !descriptionEl ||
    !selectedAutomatLabelEl ||
    !selectedLockerLabelEl ||
    !automatIdEl ||
    !lockerIdEl ||
    !submitBtn ||
    !goBackBtn
  )
    return

  let currentCity = ""
  let selectedAutomat = null
  let automatsReqId = 0

  const grid = createLockerGrid({
    containerEl: lockerDisplayEl,
    titleEl: lockerNameEl,
    gridHostEl,
    isSelectable: (locker) => {
      const s = normalizeStatus(locker?.status)
      return s === "WOLNA" || s === "ZAJETA"
    },
    canSelect: (locker) => {
      const s = normalizeStatus(locker?.status)
      if (s === "USZKODZONA") return { ok: false, reason: "Ta skrytka jest już uszkodzona." }
      return { ok: true }
    },
    onSelect: (locker) => {
      const id = locker?.skrytka_id ?? locker?.id ?? null
      if (!id) return

      lockerIdEl.value = String(id)
      selectedLockerLabelEl.textContent = `#${id}`
      updateSubmitDisabled()
    }
  })

  const updateSubmitDisabled = () => {
    submitBtn.disabled = !(automatIdEl.value && lockerIdEl.value && String(descriptionEl.value || "").trim())
  }

  const resetSelection = () => {
    selectedAutomat = null

    automatIdEl.value = ""
    lockerIdEl.value = ""

    selectedAutomatLabelEl.textContent = "—"
    selectedLockerLabelEl.textContent = "—"

    descriptionEl.value = ""
    updateSubmitDisabled()

    grid.clear()
  }

  const showAutomats = () => {
    grid.clear()
    removeClass(listEl, "hidden")
    addClass(lockerDisplayEl, "hidden")
    addClass(lockerInfoEl, "hidden")
    addClass(goBackBtn, "hidden")
  }

  const showGrid = () => {
    addClass(listEl, "hidden")
    removeClass(lockerDisplayEl, "hidden")
    removeClass(lockerInfoEl, "hidden")
    removeClass(goBackBtn, "hidden")
  }

  const renderAutomatsList = (automaty) => {
    listEl.replaceChildren()

    const list = Array.isArray(automaty) ? automaty : []
    if (!list.length) {
      const p = document.createElement("p")
      p.textContent = "Brak automatów w tym mieście."
      listEl.appendChild(p)
      return
    }

    list.forEach((a) => {
      const id = getAutomatId(a)
      const name = String(getAutomatName(a) || "-")
      const addr = String(getAutomatAddress(a) || "-")

      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "btn report-locker-list__item"
      btn.textContent = `${name} - ${addr}`

      btn.addEventListener("click", () => void displayLockerDetails({ id, name, addr }))
      listEl.appendChild(btn)
    })
  }

  const loadCities = async () => {
    citySelectEl.replaceChildren()

    const opt = document.createElement("option")
    opt.value = ""
    opt.textContent = "Wybierz miasto"
    opt.disabled = true
    opt.selected = true
    citySelectEl.appendChild(opt)

    try {
      const res = await apiFetch(ENDPOINTS.CITIES)
      const data = await res.json().catch(() => null)
      const cities = Array.isArray(data) ? data : data?.miasta ?? []

      ;(Array.isArray(cities) ? cities : []).forEach((c) => {
        const o = document.createElement("option")
        o.value = String(c)
        o.textContent = String(c)
        citySelectEl.appendChild(o)
      })
    } catch {
      displayMessageForSeconds("Nie udało się pobrać listy miast.", 4, "db-message")
    }
  }

  const loadAutomatsInCity = async (miasto) => {
    currentCity = miasto
    resetSelection()

    const reqId = ++automatsReqId

    listEl.replaceChildren()
    showAutomats()

    try {
      const res = await apiFetch(ENDPOINTS.AUTOMATS_IN_CITY(miasto))
      const data = await res.json().catch(() => null)

      if (reqId !== automatsReqId) return

      const automaty = (data?.automaty ?? data?.rows ?? data) || []
      renderAutomatsList(automaty)
    } catch {
      if (reqId !== automatsReqId) return
      displayMessageForSeconds("Błąd pobierania automatów.", 5, "db-message")
      renderAutomatsList([])
    }
  }

  const displayLockerDetails = async ({ id, name, addr }) => {
    if (!id) return

    selectedAutomat = { id: Number(id), name: String(name), addr: String(addr) }

    automatIdEl.value = String(id)
    lockerIdEl.value = ""

    selectedAutomatLabelEl.textContent = `${name} (#${id})`
    selectedLockerLabelEl.textContent = "—"

    updateSubmitDisabled()

    try {
      const res = await apiFetch(ENDPOINTS.AUTOMAT_LAYOUT(id))
      const layout = await res.json().catch(() => null)

      if (!Array.isArray(layout) || layout.length === 0) {
        displayMessageForSeconds("Brak danych automatu.", 3, "db-message")
        grid.clear()
        return
      }

      grid.setTitle(`Automat: ${name} (ID: ${id})`)
      grid.renderLayout(layout)
      showGrid()
    } catch {
      displayMessageForSeconds("Nie udało się pobrać layoutu automatu.", 5, "db-message")
      grid.clear()
    }
  }

  const reloadSelectedAutomatLayout = async () => {
    const automatId = Number(automatIdEl.value)
    if (!Number.isInteger(automatId) || automatId <= 0) return

    try {
      const res = await apiFetch(ENDPOINTS.AUTOMAT_LAYOUT(automatId))
      const layout = await res.json().catch(() => null)

      if (!Array.isArray(layout) || layout.length === 0) {
        grid.clear()
        return
      }

      const name = selectedAutomat?.name || "Automat"
      grid.setTitle(`Automat: ${name} (ID: ${automatId})`)
      grid.renderLayout(layout)
      showGrid()
    } catch {
      grid.clear()
    }
  }

  if (citySelectEl.dataset.bound !== "1") {
    citySelectEl.dataset.bound = "1"
    citySelectEl.addEventListener("change", () => {
      const miasto = String(citySelectEl.value || "").trim()
      if (!miasto) return
      void loadAutomatsInCity(miasto)
    })
  }

  if (descriptionEl.dataset.bound !== "1") {
    descriptionEl.dataset.bound = "1"
    descriptionEl.addEventListener("input", () => updateSubmitDisabled())
  }

  if (goBackBtn.dataset.bound !== "1") {
    goBackBtn.dataset.bound = "1"
    goBackBtn.type = "button"
    goBackBtn.addEventListener("click", () => {
      if (!currentCity) return
      showAutomats()
      void loadAutomatsInCity(currentCity)
    })
  }

  if (formEl.dataset.bound !== "1") {
    formEl.dataset.bound = "1"
    formEl.addEventListener("submit", async (e) => {
      e.preventDefault()

      const automatId = Number(String(automatIdEl.value || "").trim())
      const skrytkaId = Number(String(lockerIdEl.value || "").trim())
      const desc = String(descriptionEl.value || "").trim()

      if (!Number.isInteger(automatId) || automatId <= 0) return
      if (!Number.isInteger(skrytkaId) || skrytkaId <= 0) return
      if (!desc) return

      submitBtn.disabled = true

      try {
        const res = await apiFetch(ENDPOINTS.MARK_LOCKER_DAMAGED(skrytkaId), {
        method: "PUT",
        body: JSON.stringify({ opis: desc })
        })

        const data = await res.json().catch(() => null)

        if (!res.ok) {
          displayMessageForSeconds(data?.error || `Błąd oznaczania skrytki (${res.status})`, 5, "db-message")
          updateSubmitDisabled()
          return
        }

        displayMessageForSeconds("Skrytka została oznaczona jako uszkodzona.", 4, "db-message")

        lockerIdEl.value = ""
        selectedLockerLabelEl.textContent = "—"
        descriptionEl.value = ""
        updateSubmitDisabled()

        await reloadSelectedAutomatLayout()
      } catch (err) {
        displayMessageForSeconds(err?.message || "Nie udało się oznaczyć skrytki jako uszkodzonej.", 5, "db-message")
        updateSubmitDisabled()
      }
    })
  }

  void loadCities()
  resetSelection()
  showAutomats()
}
