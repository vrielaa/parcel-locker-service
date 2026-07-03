import { qs, getElById, addClass, removeClass } from "../utils.js"
import { displayMessageForSeconds } from "../messages.js"
import { apiFetch } from "../api.js"
import { createLockerGrid } from "./lockerGrid.js"

const ENDPOINTS = {
  CITIES: "/miasta",
  PARCEL_LOCKERS_IN_CITY: (city) => `/automaty?miasto=${encodeURIComponent(city)}`,
  PARCEL_LOCKER_LAYOUT: (id) => `/automaty/${id}`,
  MARK_LOCKER_DAMAGED: (id) => `/kurier/skrytki/${id}/status`
}

const getParcelLockerId = (parcelLocker) => parcelLocker?.automat_id ?? parcelLocker?.id ?? null
const getParcelLockerName = (parcelLocker) => parcelLocker?.nazwa ?? parcelLocker?.kod ?? parcelLocker?.name ?? "-"
const getParcelLockerAddress = (parcelLocker) => parcelLocker?.adres ?? parcelLocker?.address ?? "-"

const normalizeStatus = (s) => String(s ?? "").trim().toUpperCase()

export function initCourierReport() {
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

  const selectedParcelLockerLabelEl = viewEl.querySelector("#report-selected-parcel-locker")
  const selectedLockerLabelEl = viewEl.querySelector("#report-selected-locker")

  const parcelLockerIdEl = viewEl.querySelector("#report-parcel-locker-id")
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
    !selectedParcelLockerLabelEl ||
    !selectedLockerLabelEl ||
    !parcelLockerIdEl ||
    !lockerIdEl ||
    !submitBtn ||
    !goBackBtn
  )
    return

  let currentCity = ""
  let selectedParcelLocker = null
  let parcelLockersRequestId = 0

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
    submitBtn.disabled = !(parcelLockerIdEl.value && lockerIdEl.value && String(descriptionEl.value || "").trim())
  }

  const resetSelection = () => {
    selectedParcelLocker = null

    parcelLockerIdEl.value = ""
    lockerIdEl.value = ""

    selectedParcelLockerLabelEl.textContent = "—"
    selectedLockerLabelEl.textContent = "—"

    descriptionEl.value = ""
    updateSubmitDisabled()

    grid.clear()
  }

  const showParcelLockers = () => {
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

  const renderParcelLockersList = (parcelLockers) => {
    listEl.replaceChildren()

    const list = Array.isArray(parcelLockers) ? parcelLockers : []
    if (!list.length) {
      const p = document.createElement("p")
      p.textContent = "Brak automatów w tym mieście."
      listEl.appendChild(p)
      return
    }

    list.forEach((parcelLocker) => {
      const id = getParcelLockerId(parcelLocker)
      const name = String(getParcelLockerName(parcelLocker) || "-")
      const addr = String(getParcelLockerAddress(parcelLocker) || "-")

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

  const loadParcelLockersInCity = async (city) => {
    currentCity = city
    resetSelection()

    const requestId = ++parcelLockersRequestId

    listEl.replaceChildren()
    showParcelLockers()

    try {
      const res = await apiFetch(ENDPOINTS.PARCEL_LOCKERS_IN_CITY(city))
      const data = await res.json().catch(() => null)

      if (requestId !== parcelLockersRequestId) return

      const parcelLockers = (data?.automaty ?? data?.rows ?? data) || []
      renderParcelLockersList(parcelLockers)
    } catch {
      if (requestId !== parcelLockersRequestId) return
      displayMessageForSeconds("Błąd pobierania automatów.", 5, "db-message")
      renderParcelLockersList([])
    }
  }

  const displayLockerDetails = async ({ id, name, addr }) => {
    if (!id) return

    selectedParcelLocker = { id: Number(id), name: String(name), addr: String(addr) }

    parcelLockerIdEl.value = String(id)
    lockerIdEl.value = ""

    selectedParcelLockerLabelEl.textContent = `${name} (#${id})`
    selectedLockerLabelEl.textContent = "—"

    updateSubmitDisabled()

    try {
      const res = await apiFetch(ENDPOINTS.PARCEL_LOCKER_LAYOUT(id))
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

  const reloadSelectedParcelLockerLayout = async () => {
    const parcelLockerId = Number(parcelLockerIdEl.value)
    if (!Number.isInteger(parcelLockerId) || parcelLockerId <= 0) return

    try {
      const res = await apiFetch(ENDPOINTS.PARCEL_LOCKER_LAYOUT(parcelLockerId))
      const layout = await res.json().catch(() => null)

      if (!Array.isArray(layout) || layout.length === 0) {
        grid.clear()
        return
      }

      const name = selectedParcelLocker?.name || "Automat"
      grid.setTitle(`Automat: ${name} (ID: ${parcelLockerId})`)
      grid.renderLayout(layout)
      showGrid()
    } catch {
      grid.clear()
    }
  }

  if (citySelectEl.dataset.bound !== "1") {
    citySelectEl.dataset.bound = "1"
    citySelectEl.addEventListener("change", () => {
      const city = String(citySelectEl.value || "").trim()
      if (!city) return
      void loadParcelLockersInCity(city)
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
      showParcelLockers()
      void loadParcelLockersInCity(currentCity)
    })
  }

  if (formEl.dataset.bound !== "1") {
    formEl.dataset.bound = "1"
    formEl.addEventListener("submit", async (e) => {
      e.preventDefault()

      const parcelLockerId = Number(String(parcelLockerIdEl.value || "").trim())
      const lockerId = Number(String(lockerIdEl.value || "").trim())
      const desc = String(descriptionEl.value || "").trim()

      if (!Number.isInteger(parcelLockerId) || parcelLockerId <= 0) return
      if (!Number.isInteger(lockerId) || lockerId <= 0) return
      if (!desc) return

      submitBtn.disabled = true

      try {
        const res = await apiFetch(ENDPOINTS.MARK_LOCKER_DAMAGED(lockerId), {
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

        await reloadSelectedParcelLockerLayout()
      } catch (err) {
        displayMessageForSeconds(err?.message || "Nie udało się oznaczyć skrytki jako uszkodzonej.", 5, "db-message")
        updateSubmitDisabled()
      }
    })
  }

  void loadCities()
  resetSelection()
  showParcelLockers()
}
