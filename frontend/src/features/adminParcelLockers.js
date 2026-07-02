import { getElById } from "../utils.js"
import { apiFetch } from "../api.js"

const ENDPOINTS = {
  CREATE: ["/admin/automaty"],
  FAULTY_LOCKERS: ["/admin/automaty/locker-faulty"],
  DELETE: (id) => [`/admin/automaty/${id}`],
  CITIES: ["/miasta"],

  MARK_LOCKER_REPAIRED: (parcelLockerId, lockerId) => [`/admin/automaty/${parcelLockerId}/lockers/${lockerId}/mark-repaired`]
}

const escapeHtml = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")

const normalizeText = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ")

const getParcelLockerId = (parcelLocker) => parcelLocker?.automat_id ?? parcelLocker?.id ?? parcelLocker?.automatId ?? null
const getParcelLockerName = (parcelLocker) =>
  parcelLocker?.nazwa ?? parcelLocker?.kod ?? parcelLocker?.name ?? parcelLocker?.automat_nazwa ?? parcelLocker?.automatNazwa ?? "-"
const getParcelLockerAddress = (parcelLocker) =>
  parcelLocker?.adres ?? parcelLocker?.address ?? parcelLocker?.automat_adres ?? parcelLocker?.automatAdres ?? ""
const getParcelLockerCity = (parcelLocker) =>
  parcelLocker?.miasto ?? parcelLocker?.city ?? parcelLocker?.automat_miasto ?? parcelLocker?.automatMiasto ?? ""

const inferCityFromAddress = (addr) => {
  const s = String(addr || "").trim()
  if (!s) return ""

  const parts = s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)

  if (!parts.length) return ""

  const lettersOnly = parts.find((p) => /[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/.test(p) && !/\d/.test(p))
  if (lettersOnly) return lettersOnly

  const last = parts[parts.length - 1].replace(/\d{2}-\d{3}/g, "").trim()
  if (last && /[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/.test(last)) return last

  return ""
}

const normalizeListResponse = (data) => {
  const list = data?.automaty ?? data?.rows ?? data
  return Array.isArray(list) ? list : []
}

const tryFetchJson = async (paths, opts) => {
  let last = null

  for (const path of paths) {
    try {
      const res = await apiFetch(path, opts)
      const data = await res.json().catch(() => null)
   
      if (res.ok) return { ok: true, res, data, path }
      last = { ok: false, res, data, path }
    } catch (err) {
      last = { ok: false, error: err }
    }
  }

  return last || { ok: false, error: new Error("Brak odpowiedzi z API.") }
}

const normalizeFaultyRowsResponse = (data) => {
  const list = data?.lockers ?? data?.rows ?? data
  const rows = Array.isArray(list) ? list : []

  return rows
    .map((r) => {
      const id = r?.automat_id != null ? String(r.automat_id) : ""
      const name = String(r?.nazwa ?? r?.automat_nazwa ?? "-").trim()
      const address = String(r?.adres ?? r?.automat_adres ?? "").trim()
      const city = String(r?.miasto ?? r?.automat_miasto ?? "").trim() || inferCityFromAddress(address)

      const faultyCount = Number(r?.faulty_lockers_count ?? r?.uszkodzone_skrytki ?? r?.faulty_count ?? 0) || 0
      const faultyIdsRaw = r?.faulty_lockers_ids ?? r?.faulty_lockers_ids ?? r?.faulty_ids ?? r?.ids ?? []
      const faultyIds = (Array.isArray(faultyIdsRaw) ? faultyIdsRaw : [])
        .map((x) => Number(x))
        .filter((x) => Number.isInteger(x) && x > 0)

      return {
        id,
        name,
        address,
        city,
        faultyCount,
        faultyIds
      }
    })
    .filter((a) => a.id && a.faultyCount > 0)
    .sort((a, b) => {
      if (b.faultyCount !== a.faultyCount) return b.faultyCount - a.faultyCount

      const ca = normalizeText(a.city)
      const cb = normalizeText(b.city)
      if (ca !== cb) return ca.localeCompare(cb, "pl")

      const na = normalizeText(a.name)
      const nb = normalizeText(b.name)
      if (na !== nb) return na.localeCompare(nb, "pl")

      return a.id.localeCompare(b.id)
    })
}

const renderFaultyParcelLockerButtons = (listEl, parcelLockers, onSelect) => {
  listEl.replaceChildren()

  const list = Array.isArray(parcelLockers) ? parcelLockers.slice() : []
  if (!list.length) {
    const p = document.createElement("p")
    p.textContent = "Brak automatów z awariami."
    listEl.appendChild(p)
    return
  }

  list.forEach((a) => {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "btn admin-automaty__faulty-btn"

    const title = `${a.name} (#${a.id})`
    const city = a.city || "-"
    const count = Number(a.faultyCount || 0)

    btn.innerHTML = `
      <div class="admin-automaty__faulty-btn__top">
        <span class="admin-automaty__faulty-btn__title">${escapeHtml(title)}</span>
        <span class="admin-automaty__faulty-btn__count">${escapeHtml(count)}</span>
      </div>
      <div class="admin-automaty__faulty-btn__bottom">
        <span class="admin-automaty__faulty-btn__city">${escapeHtml(city)}</span>
        <span class="admin-automaty__faulty-btn__addr">${escapeHtml(a.address || "-")}</span>
      </div>
    `

    btn.addEventListener("click", () => {
      if (typeof onSelect === "function") onSelect(a)
    })

    listEl.appendChild(btn)
  })
}

const renderFaultyLockersList = ({ listEl, parcelLocker, onBack, onRepair }) => {
  listEl.replaceChildren()

  const head = document.createElement("div")
  head.className = "admin-automaty__faulty-head"

  const backBtn = document.createElement("button")
  backBtn.type = "button"
  backBtn.className = "btn admin-automaty__faulty-back"
  backBtn.textContent = "Wróć"

  backBtn.addEventListener("click", () => {
    if (typeof onBack === "function") onBack()
  })

  const title = document.createElement("h4")
  title.className = "admin-automaty__faulty-title"
  title.textContent = `${parcelLocker?.name || "Automat"} (#${parcelLocker?.id || "?"}) — uszkodzone skrytki: ${Number(parcelLocker?.faultyCount || 0)}`

  head.appendChild(backBtn)
  head.appendChild(title)
  listEl.appendChild(head)

  const ids = Array.isArray(parcelLocker?.faultyIds) ? parcelLocker.faultyIds.slice() : []
  if (!ids.length) {
    const p = document.createElement("p")
    p.textContent = "Brak uszkodzonych skrytek dla tego automatu."
    listEl.appendChild(p)
    return
  }

  ids
    .slice()
    .sort((a, b) => Number(a) - Number(b))
    .forEach((lockerId) => {
      const row = document.createElement("div")
      row.className = "admin-automaty__faulty-locker-row"

      const left = document.createElement("div")
      left.className = "admin-automaty__faulty-locker-left"
      left.innerHTML = `<strong>Skrytka #${escapeHtml(lockerId)}</strong>`

      const actions = document.createElement("div")
      actions.className = "admin-automaty__faulty-locker-actions"

      const repairBtn = document.createElement("button")
      repairBtn.type = "button"
      repairBtn.className = "btn admin-automaty__faulty-locker-repair"
      repairBtn.textContent = "Oznacz jako naprawiona"

      repairBtn.addEventListener("click", async () => {
        if (typeof onRepair !== "function") return
        await onRepair({ lockerId, btn: repairBtn, row })
      })

      actions.appendChild(repairBtn)
      row.appendChild(left)
      row.appendChild(actions)
      listEl.appendChild(row)
    })
}

export function initAdminParcelLockersPanel() {
  const role = (localStorage.getItem("rola") || "").toUpperCase()
  if (role !== "ADMIN") return

  const usersViewEl = getElById("admin-users-view")
  const parcelLockersViewEl = getElById("admin-automaty-view")
  const clientViewEl = getElById("admin-client-view")

  const titleEl = getElById("admin-automaty-title")
  const backBtn = getElById("admin-automaty-back")

  const addBtn = getElById("admin-automaty-btn-add")
  const faultyBtn = getElById("admin-automaty-btn-faulty")
  const allBtn = getElById("admin-automaty-btn-all")

  const formBoxEl = getElById("admin-automaty-form-box")
  const formTitleEl = getElById("admin-automaty-form-title")
  const formEl = getElById("admin-automaty-form")
  const cancelBtn = getElById("admin-automaty-form-cancel")

  const codeEl = getElById("admin-automaty-name")
  const cityEl = getElById("admin-automaty-city")
  const addressEl = getElById("admin-automaty-address")

  const gpsEl = getElById("admin-automaty-gps-coords")
  const colsEl = getElById("admin-automaty-num-columns")
  const rowsEl = getElById("admin-automaty-num-rows")

  const listEl = getElById("admin-automaty-list")
  const citiesEl = getElById("admin-automaty-cities")
  const cityListEl = getElById("admin-automaty-city-list")

  if (
    !parcelLockersViewEl ||
    !addBtn ||
    !formBoxEl ||
    !formEl ||
    !codeEl ||
    !cityEl ||
    !addressEl ||
    !gpsEl ||
    !colsEl ||
    !rowsEl ||
    !listEl ||
    !citiesEl ||
    !cityListEl
  )
    return

  let mode = ""
  let citiesButtons = []
  let citiesLoaded = false
  let currentCity = ""
  let parcelLockersRequestId = 0

  let faultyRowsCache = []
  let selectedFaultyParcelLocker = null

  const hideForm = () => {
    formBoxEl.classList.add("hidden")
    formEl.reset()
  }

  const setActiveModeButton = (which) => {
    ;[addBtn, faultyBtn, allBtn].forEach((b) => b && b.classList.remove("isActive"))

    if (which === "ADD" && addBtn) addBtn.classList.add("isActive")
    if (which === "FAULTY" && faultyBtn) faultyBtn.classList.add("isActive")
    if (which === "ALL" && allBtn) allBtn.classList.add("isActive")
  }

  const hideAllUi = () => {
    hideForm()

    citiesEl.classList.add("hidden")
    cityListEl.classList.add("hidden")
    listEl.classList.add("hidden")

    citiesEl.replaceChildren()
    cityListEl.replaceChildren()
    listEl.replaceChildren()

    currentCity = ""
    mode = ""
    if (titleEl) titleEl.textContent = "Zarządzanie automatami"
    setActiveModeButton("")
  }

  const showUsersView = () => {
    hideForm()

    if (parcelLockersViewEl) parcelLockersViewEl.classList.add("hidden")
    if (clientViewEl) clientViewEl.classList.add("hidden")
    if (usersViewEl) usersViewEl.classList.remove("hidden")
  }

  const showForm = (title) => {
    if (formTitleEl) formTitleEl.textContent = String(title || "")
    formBoxEl.classList.remove("hidden")
  }

  const showAllUi = () => {
    citiesEl.classList.remove("hidden")
    cityListEl.classList.remove("hidden")
    listEl.classList.add("hidden")
  }

  const showFaultyUi = () => {
    citiesEl.classList.add("hidden")
    cityListEl.classList.add("hidden")
    listEl.classList.remove("hidden")
  }

  const setDisabled = (disabled) => {
    addBtn.disabled = disabled
    if (faultyBtn) faultyBtn.disabled = disabled
    if (allBtn) allBtn.disabled = disabled

    codeEl.disabled = disabled
    cityEl.disabled = disabled
    addressEl.disabled = disabled
    gpsEl.disabled = disabled
    colsEl.disabled = disabled
    rowsEl.disabled = disabled

    const submitBtn = formEl.querySelector('button[type="submit"]')
    if (submitBtn) submitBtn.disabled = disabled

    if (cancelBtn) cancelBtn.disabled = disabled
    if (backBtn) backBtn.disabled = disabled
  }

  const createParcelLocker = async ({ code, address, city, gpsCoordinates, rowCount, columnCount }) => {
    const payload = {
      kod: code,
      adres: address,
      miasto: city,
      wspolrzedne: gpsCoordinates,
      liczbaWierszy: rowCount,
      liczbaKolumn: columnCount
    }

    const result = await tryFetchJson(ENDPOINTS.CREATE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })

    if (!result?.ok) {
      const status = result?.res?.status
      return { ok: false, error: result?.data?.error || (status ? `Błąd tworzenia automatu (${status})` : "Błąd tworzenia automatu") }
    }

    return { ok: true, data: result.data }
  }

  const deleteParcelLocker = async (id) => {
    const result = await tryFetchJson(ENDPOINTS.DELETE(id), { method: "DELETE" })

    if (!result?.ok) {
      const status = result?.res?.status
      return { ok: false, error: result?.data?.error || (status ? `Błąd usuwania automatu (${status})` : "Błąd usuwania automatu") }
    }

    return { ok: true }
  }

  const loadCitiesButtons = async () => {
    if (citiesLoaded) return

    const result = await tryFetchJson(ENDPOINTS.CITIES, { method: "GET" })
    const cities = result?.ok ? result.data : []
    const list = Array.isArray(cities) ? cities : []

    citiesButtons = list
      .map((m) => String(m || "").trim())
      .filter(Boolean)
      .map((city) => {
        const btn = document.createElement("button")
        btn.type = "button"
        btn.className = "btn admin-automaty__city-btn"
        btn.textContent = city
        btn.dataset.city = city
        return btn
      })

    citiesLoaded = true
  }

  const renderCityButtons = () => {
    citiesEl.replaceChildren()

    if (!citiesButtons.length) {
      const p = document.createElement("p")
      p.textContent = "Brak miast."
      citiesEl.appendChild(p)
      return
    }

    citiesButtons.forEach((b) => citiesEl.appendChild(b))
  }

  const renderParcelLockersInCityList = (parcelLockers, city) => {
    cityListEl.replaceChildren()

    const list = Array.isArray(parcelLockers) ? parcelLockers.slice() : []
    if (!list.length) {
      const p = document.createElement("p")
      p.textContent = `Brak automatów w mieście: ${city}`
      cityListEl.appendChild(p)
      return
    }

    list
      .map((parcelLocker) => {
        const id = getParcelLockerId(parcelLocker)
        const name = String(getParcelLockerName(parcelLocker) || "-").trim()
        const address = String(getParcelLockerAddress(parcelLocker) || "").trim()
        return { id: id != null ? String(id) : "", name, address }
      })
      .sort((a, b) => normalizeText(a.name).localeCompare(normalizeText(b.name), "pl"))
      .forEach((a) => {
        const row = document.createElement("div")
        row.className = "admin-automaty__city-item"

        const text = document.createElement("div")
        text.className = "admin-automaty__city-item-text"
        text.innerHTML = `<strong>${escapeHtml(a.name)}</strong> — ${escapeHtml(a.address || "-")}`

        const actions = document.createElement("div")
        actions.className = "admin-automaty__city-item-actions"

        const del = document.createElement("button")
        del.type = "button"
        del.className = "btn admin-automaty__city-item-delete"
        del.textContent = "Usuń"
        del.disabled = !a.id

        del.addEventListener("click", async () => {
          const ok = confirm(`Na pewno usunąć automat "${a.name}" (#${a.id})?`)
          if (!ok) return

          setDisabled(true)
          const response = await deleteParcelLocker(a.id)
          setDisabled(false)

          if (!response.ok) {
            alert(response.error || "Nie udało się usunąć automatu.")
            return
          }

          alert("Automat usunięty.")
          await loadParcelLockersInCity(currentCity)
        })

        actions.appendChild(del)
        row.appendChild(text)
        row.appendChild(actions)

        cityListEl.appendChild(row)
      })
  }

  const loadParcelLockersInCity = async (city) => {
    currentCity = city

    const requestId = ++parcelLockersRequestId
    setDisabled(true)

    try {
      const result = await tryFetchJson([`/automaty?miasto=${encodeURIComponent(city)}`], { method: "GET" })
      if (requestId !== parcelLockersRequestId) return

      if (!result?.ok) {
        const status = result?.res?.status
        const msg = result?.data?.error || (status ? `Błąd pobierania automatów (${status})` : "Błąd pobierania automatów")
        renderParcelLockersInCityList([], city)
        alert(msg)
        return
      }

      const list = normalizeListResponse(result.data)
      renderParcelLockersInCityList(list, city)
    } finally {
      if (requestId === parcelLockersRequestId) setDisabled(false)
    }
  }

  const loadFaultyParcelLockers = async () => {
    setDisabled(true)

    try {
      const result = await tryFetchJson(ENDPOINTS.FAULTY_LOCKERS, { method: "GET" })

      if (!result?.ok) {
        const status = result?.res?.status
        const msg = result?.data?.error || (status ? `Błąd pobierania awarii (${status})` : "Błąd pobierania awarii")
        faultyRowsCache = []
        selectedFaultyParcelLocker = null
        renderFaultyParcelLockerButtons(listEl, [], () => {})
        alert(msg)
        return
      }

      faultyRowsCache = normalizeFaultyRowsResponse(result.data)
      selectedFaultyParcelLocker = null

      showFaultyParcelLockers()
    } finally {
      setDisabled(false)
    }
  }

  const showFaultyParcelLockers = () => {
    selectedFaultyParcelLocker = null

    renderFaultyParcelLockerButtons(listEl, faultyRowsCache, (parcelLocker) => {
      selectedFaultyParcelLocker = parcelLocker
      showFaultyLockers(parcelLocker)
    })
  }

  const showFaultyLockers = (parcelLocker) => {
    renderFaultyLockersList({
      listEl,
      parcelLocker,
      onBack: () => {
        showFaultyParcelLockers()
      },
      onRepair: async ({ lockerId, btn, row }) => {
        const parcelLockerId = Number(parcelLocker?.id)
        const repairedLockerId = Number(lockerId)

        if (!Number.isInteger(parcelLockerId) || parcelLockerId <= 0) return
        if (!Number.isInteger(repairedLockerId) || repairedLockerId <= 0) return

        btn.disabled = true
        const prev = btn.textContent
        btn.textContent = "Przetwarzanie..."

        const result = await tryFetchJson(ENDPOINTS.MARK_LOCKER_REPAIRED(parcelLockerId, repairedLockerId), {
          method: "PUT",
          body: JSON.stringify({ status: "WOLNA" })
        })

        if (!result?.ok) {
          const status = result?.res?.status
          const msg =
            result?.data?.error || (status ? `Błąd oznaczania jako naprawiona (${status})` : "Błąd oznaczania jako naprawiona")

          btn.disabled = false
          btn.textContent = prev
          alert(msg)
          return
        }

        if (row) row.remove()

        parcelLocker.faultyIds = (parcelLocker.faultyIds || []).filter((x) => Number(x) !== Number(repairedLockerId))
        parcelLocker.faultyCount = Math.max(0, Number(parcelLocker.faultyCount || 0) - 1)

        faultyRowsCache = faultyRowsCache
          .map((a) => {
            if (String(a.id) !== String(parcelLocker.id)) return a
            return {
              ...a,
              faultyIds: parcelLocker.faultyIds,
              faultyCount: parcelLocker.faultyCount
            }
          })
          .filter((a) => Number(a.faultyCount || 0) > 0)

        if (parcelLocker.faultyCount <= 0) {
          await loadFaultyParcelLockers()
          return
        }

        showFaultyLockers(parcelLocker)
      }
    })
  }

  const switchToAllMode = async () => {
    mode = "ALL"
    hideForm()
    showAllUi()
    if (titleEl) titleEl.textContent = "Wszystkie automaty (podział na miasta)"

    await loadCitiesButtons()
    renderCityButtons()

    if (!currentCity && citiesButtons.length) {
      currentCity = citiesButtons[0].dataset.city || ""
      citiesEl.querySelectorAll("button[data-city]").forEach((b) => b.classList.remove("isActive"))
      const first = citiesEl.querySelector("button[data-city]")
      if (first) first.classList.add("isActive")
      if (currentCity) await loadParcelLockersInCity(currentCity)
      return
    }

    if (currentCity) await loadParcelLockersInCity(currentCity)
  }

  const switchToFaultyMode = async () => {
    mode = "FAULTY"
    hideForm()
    showFaultyUi()
    if (titleEl) titleEl.textContent = "Automaty z uszkodzonymi skrytkami"
    await loadFaultyParcelLockers()
  }

  const onAddClick = () => {
    hideForm()
    showFaultyUi()
    listEl.classList.add("hidden")

    showForm("Dodaj nowy automat")

    colsEl.value = "13"
    rowsEl.value = "6"
    gpsEl.value = ""

    codeEl.focus()
  }

  const onCancel = () => {
    hideForm()
    if (mode === "FAULTY") void switchToFaultyMode()
    else if (mode === "ALL") void switchToAllMode()
    else hideAllUi()
  }

  const onSubmit = async (e) => {
    e.preventDefault()

    const code = String(codeEl.value || "").trim()
    const city = String(cityEl.value || "").trim()
    const address = String(addressEl.value || "").trim()

    const gpsCoordinates = String(gpsEl.value || "").trim()
    const columnCount = Number.parseInt(String(colsEl.value || "").trim(), 10)
    const rowCount = Number.parseInt(String(rowsEl.value || "").trim(), 10)

    if (!code || !city || !address || !gpsCoordinates) return

    if (!Number.isInteger(columnCount) || columnCount <= 0) {
      alert("Liczba kolumn musi być liczbą całkowitą > 0.")
      return
    }

    if (!Number.isInteger(rowCount) || rowCount <= 0) {
      alert("Liczba rzędów musi być liczbą całkowitą > 0.")
      return
    }

    if (rowCount % 2 !== 0) {
      alert("Liczba rzędów musi być parzysta.")
      return
    }

    setDisabled(true)

    try {
      const result = await createParcelLocker({
        code,
        address,
        city,
        gpsCoordinates,
        rowCount,
        columnCount
      })

      if (!result.ok) {
        alert(result.error || "Nie udało się dodać automatu.")
        setDisabled(false)
        return
      }

      alert("Automat dodany.")
      hideForm()

      if (mode === "FAULTY") {
        await switchToFaultyMode()
      } else if (mode === "ALL") {
        await switchToAllMode()
      } else {
        hideAllUi()
      }
    } catch (err) {
      alert(err?.message || "Nie udało się dodać automatu.")
    } finally {
      setDisabled(false)
    }
  }

  if (backBtn && backBtn.dataset.bound !== "1") {
    backBtn.dataset.bound = "1"
    backBtn.type = "button"
    backBtn.addEventListener("click", showUsersView)
  }

  if (addBtn.dataset.bound !== "1") {
    addBtn.dataset.bound = "1"
    addBtn.type = "button"
    addBtn.addEventListener("click", () => {
      setActiveModeButton("ADD")
      onAddClick()
    })
  }

  if (faultyBtn && faultyBtn.dataset.bound !== "1") {
    faultyBtn.dataset.bound = "1"
    faultyBtn.type = "button"
    faultyBtn.addEventListener("click", () => {
      setActiveModeButton("FAULTY")
      void switchToFaultyMode()
    })
  }

  if (allBtn && allBtn.dataset.bound !== "1") {
    allBtn.dataset.bound = "1"
    allBtn.type = "button"
    allBtn.addEventListener("click", () => {
      setActiveModeButton("ALL")
      void switchToAllMode()
    })
  }

  if (cancelBtn && cancelBtn.dataset.bound !== "1") {
    cancelBtn.dataset.bound = "1"
    cancelBtn.type = "button"
    cancelBtn.addEventListener("click", onCancel)
  }

  if (formEl.dataset.bound !== "1") {
    formEl.dataset.bound = "1"
    formEl.addEventListener("submit", onSubmit)
  }

  if (citiesEl && citiesEl.dataset.bound !== "1") {
    citiesEl.dataset.bound = "1"
    citiesEl.addEventListener("click", (e) => {
      const btn = e.target?.closest("button[data-city]")
      if (!btn) return

      citiesEl.querySelectorAll("button[data-city]").forEach((b) => b.classList.remove("isActive"))
      btn.classList.add("isActive")

      const city = btn.dataset.city
      if (!city) return

      void loadParcelLockersInCity(city)
    })
  }

  hideAllUi()
}
