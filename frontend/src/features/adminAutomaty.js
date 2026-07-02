import { getElById } from "../utils.js"
import { apiFetch } from "../api.js"

const ENDPOINTS = {
  CREATE: ["/admin/automaty"],
  FAULTY_LOCKERS: ["/admin/automaty/locker-faulty"],
  DELETE: (id) => [`/admin/automaty/${id}`],
  CITIES: ["/miasta"],

  MARK_LOCKER_REPAIRED: (automatId, lockerId) => [`/admin/automaty/${automatId}/lockers/${lockerId}/mark-repaired`]
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

const getAutomatId = (a) => a?.automat_id ?? a?.id ?? a?.automatId ?? null
const getAutomatName = (a) => a?.nazwa ?? a?.kod ?? a?.name ?? a?.automat_nazwa ?? a?.automatNazwa ?? "-"
const getAutomatAddress = (a) => a?.adres ?? a?.address ?? a?.automat_adres ?? a?.automatAdres ?? ""
const getAutomatCity = (a) => a?.miasto ?? a?.city ?? a?.automat_miasto ?? a?.automatMiasto ?? ""

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

const renderFaultyAutomatsButtons = (listEl, automaty, onSelect) => {
  listEl.replaceChildren()

  const list = Array.isArray(automaty) ? automaty.slice() : []
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

const renderFaultyLockersList = ({ listEl, automat, onBack, onRepair }) => {
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
  title.textContent = `${automat?.name || "Automat"} (#${automat?.id || "?"}) — uszkodzone skrytki: ${Number(automat?.faultyCount || 0)}`

  head.appendChild(backBtn)
  head.appendChild(title)
  listEl.appendChild(head)

  const ids = Array.isArray(automat?.faultyIds) ? automat.faultyIds.slice() : []
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

export function initAdminAutomatyPanel() {
  const role = (localStorage.getItem("rola") || "").toUpperCase()
  if (role !== "ADMIN") return

  const usersViewEl = getElById("admin-users-view")
  const automatyViewEl = getElById("admin-automaty-view")
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

  const kodEl = getElById("admin-automaty-name")
  const cityEl = getElById("admin-automaty-city")
  const addressEl = getElById("admin-automaty-address")

  const gpsEl = getElById("admin-automaty-gps-coords")
  const colsEl = getElById("admin-automaty-num-columns")
  const rowsEl = getElById("admin-automaty-num-rows")

  const listEl = getElById("admin-automaty-list")
  const citiesEl = getElById("admin-automaty-cities")
  const cityListEl = getElById("admin-automaty-city-list")

  if (
    !automatyViewEl ||
    !addBtn ||
    !formBoxEl ||
    !formEl ||
    !kodEl ||
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
  let automatsReqId = 0

  let faultyRowsCache = []
  let selectedFaultyAutomat = null

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

    if (automatyViewEl) automatyViewEl.classList.add("hidden")
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

    kodEl.disabled = disabled
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

  const createAutomat = async ({ kod, adres, miasto, wspolrzedne, liczbaWierszy, liczbaKolumn }) => {
    const payload = {
      kod,
      adres,
      miasto,
      wspolrzedne,
      liczbaWierszy,
      liczbaKolumn
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

  const deleteAutomat = async (id) => {
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
    const miasta = result?.ok ? result.data : []
    const list = Array.isArray(miasta) ? miasta : []

    citiesButtons = list
      .map((m) => String(m || "").trim())
      .filter(Boolean)
      .map((miasto) => {
        const btn = document.createElement("button")
        btn.type = "button"
        btn.className = "btn admin-automaty__city-btn"
        btn.textContent = miasto
        btn.dataset.city = miasto
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

  const renderAutomatsInCityList = (automaty, miasto) => {
    cityListEl.replaceChildren()

    const list = Array.isArray(automaty) ? automaty.slice() : []
    if (!list.length) {
      const p = document.createElement("p")
      p.textContent = `Brak automatów w mieście: ${miasto}`
      cityListEl.appendChild(p)
      return
    }

    list
      .map((a) => {
        const id = getAutomatId(a)
        const name = String(getAutomatName(a) || "-").trim()
        const address = String(getAutomatAddress(a) || "").trim()
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
          const r = await deleteAutomat(a.id)
          setDisabled(false)

          if (!r.ok) {
            alert(r.error || "Nie udało się usunąć automatu.")
            return
          }

          alert("Automat usunięty.")
          await loadAutomatyInCity(currentCity)
        })

        actions.appendChild(del)
        row.appendChild(text)
        row.appendChild(actions)

        cityListEl.appendChild(row)
      })
  }

  const loadAutomatyInCity = async (miasto) => {
    currentCity = miasto

    const reqId = ++automatsReqId
    setDisabled(true)

    try {
      const result = await tryFetchJson([`/automaty?miasto=${encodeURIComponent(miasto)}`], { method: "GET" })
      if (reqId !== automatsReqId) return

      if (!result?.ok) {
        const status = result?.res?.status
        const msg = result?.data?.error || (status ? `Błąd pobierania automatów (${status})` : "Błąd pobierania automatów")
        renderAutomatsInCityList([], miasto)
        alert(msg)
        return
      }

      const list = normalizeListResponse(result.data)
      renderAutomatsInCityList(list, miasto)
    } finally {
      if (reqId === automatsReqId) setDisabled(false)
    }
  }

  const loadFaultyAutomaty = async () => {
    setDisabled(true)

    try {
      const result = await tryFetchJson(ENDPOINTS.FAULTY_LOCKERS, { method: "GET" })

      if (!result?.ok) {
        const status = result?.res?.status
        const msg = result?.data?.error || (status ? `Błąd pobierania awarii (${status})` : "Błąd pobierania awarii")
        faultyRowsCache = []
        selectedFaultyAutomat = null
        renderFaultyAutomatsButtons(listEl, [], () => {})
        alert(msg)
        return
      }

      faultyRowsCache = normalizeFaultyRowsResponse(result.data)
      selectedFaultyAutomat = null

      showFaultyAutomats()
    } finally {
      setDisabled(false)
    }
  }

  const showFaultyAutomats = () => {
    selectedFaultyAutomat = null

    renderFaultyAutomatsButtons(listEl, faultyRowsCache, (automat) => {
      selectedFaultyAutomat = automat
      showFaultyLockers(automat)
    })
  }

  const showFaultyLockers = (automat) => {
    renderFaultyLockersList({
      listEl,
      automat,
      onBack: () => {
        showFaultyAutomats()
      },
      onRepair: async ({ lockerId, btn, row }) => {
        const automatId = Number(automat?.id)
        const skrytkaId = Number(lockerId)

        if (!Number.isInteger(automatId) || automatId <= 0) return
        if (!Number.isInteger(skrytkaId) || skrytkaId <= 0) return

        btn.disabled = true
        const prev = btn.textContent
        btn.textContent = "Przetwarzanie..."

        const result = await tryFetchJson(ENDPOINTS.MARK_LOCKER_REPAIRED(automatId, skrytkaId), {
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

        automat.faultyIds = (automat.faultyIds || []).filter((x) => Number(x) !== Number(skrytkaId))
        automat.faultyCount = Math.max(0, Number(automat.faultyCount || 0) - 1)

        faultyRowsCache = faultyRowsCache
          .map((a) => {
            if (String(a.id) !== String(automat.id)) return a
            return {
              ...a,
              faultyIds: automat.faultyIds,
              faultyCount: automat.faultyCount
            }
          })
          .filter((a) => Number(a.faultyCount || 0) > 0)

        if (automat.faultyCount <= 0) {
          await loadFaultyAutomaty()
          return
        }

        showFaultyLockers(automat)
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
      if (currentCity) await loadAutomatyInCity(currentCity)
      return
    }

    if (currentCity) await loadAutomatyInCity(currentCity)
  }

  const switchToFaultyMode = async () => {
    mode = "FAULTY"
    hideForm()
    showFaultyUi()
    if (titleEl) titleEl.textContent = "Automaty z uszkodzonymi skrytkami"
    await loadFaultyAutomaty()
  }

  const onAddClick = () => {
    hideForm()
    showFaultyUi()
    listEl.classList.add("hidden")

    showForm("Dodaj nowy automat")

    colsEl.value = "13"
    rowsEl.value = "6"
    gpsEl.value = ""

    kodEl.focus()
  }

  const onCancel = () => {
    hideForm()
    if (mode === "FAULTY") void switchToFaultyMode()
    else if (mode === "ALL") void switchToAllMode()
    else hideAllUi()
  }

  const onSubmit = async (e) => {
    e.preventDefault()

    const kod = String(kodEl.value || "").trim()
    const miasto = String(cityEl.value || "").trim()
    const adres = String(addressEl.value || "").trim()

    const wspolrzedne = String(gpsEl.value || "").trim()
    const liczbaKolumn = Number.parseInt(String(colsEl.value || "").trim(), 10)
    const liczbaWierszy = Number.parseInt(String(rowsEl.value || "").trim(), 10)

    if (!kod || !miasto || !adres || !wspolrzedne) return

    if (!Number.isInteger(liczbaKolumn) || liczbaKolumn <= 0) {
      alert("Liczba kolumn musi być liczbą całkowitą > 0.")
      return
    }

    if (!Number.isInteger(liczbaWierszy) || liczbaWierszy <= 0) {
      alert("Liczba rzędów musi być liczbą całkowitą > 0.")
      return
    }

    if (liczbaWierszy % 2 !== 0) {
      alert("Liczba rzędów musi być parzysta.")
      return
    }

    setDisabled(true)

    try {
      const result = await createAutomat({
        kod,
        adres,
        miasto,
        wspolrzedne,
        liczbaWierszy,
        liczbaKolumn
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

      const miasto = btn.dataset.city
      if (!miasto) return

      void loadAutomatyInCity(miasto)
    })
  }

  hideAllUi()
}
