import { getElById } from "../utils.js"
import { apiFetch } from "../api.js"

const ENDPOINTS = {
  LIST: "/kurier/paczki",
  POOL: "/kurier/paczki/pool",
  EVENTS: (id) => `/paczki/${id}/zdarzenia`,
  START_TRANSPORT: (id) => `/kurier/paczki/${id}/podejmij`,
  PLACE_IN_LOCKER: (id) => `/kurier/paczki/${id}/umiesc-w-automacie`
}

const lockerSvgUrl = new URL("../../svg/parcel-locker.svg", import.meta.url).href

const escapeHtml = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")

const normalizeStatus = (s) => String(s || "").trim().toUpperCase()

const formatStatus = (s) => {
  const map = {
    CZEKA_NA_ZATWIERDZENIE: "Czeka na zatwierdzenie",
    NADANA: "Nadana",
    W_DRODZE: "W drodze",
    W_AUTOMACIE: "W automacie",
    ODEBRANA: "Odebrana",
    PRZETERMINOWANA: "Odesłana do nadawcy",
    ANULOWANA: "Anulowana"
  }

  return map[normalizeStatus(s)] || s || "-"
}

const getPackageId = (p) => p?.paczka_id ?? p?.id ?? null

const getDimsLabel = (p) => {
  const w = p?.szerokosc_cm ?? p?.szerokosc ?? p?.width_cm ?? null
  const h = p?.wysokosc_cm ?? p?.wysokosc ?? p?.height_cm ?? null
  const d = p?.glebokosc_cm ?? p?.glebokosc ?? p?.depth_cm ?? null

  if (w != null && h != null && d != null) return `${w}×${h}×${d} cm`

  return p?.rozmiar_kod ?? p?.rozmiarKod ?? p?.rozmiar ?? p?.wymiary ?? p?.dims ?? "-"
}

const getRequiredSizeCode = (p) =>
  String(p?.rozmiar_kod ?? p?.rozmiarKod ?? p?.rozmiar ?? "")
    .trim()
    .toUpperCase() || null

const sizeRank = (s) => {
  const map = { XS: 0, S: 1, M: 2, L: 3, XL: 4 }
  return map[String(s || "").trim().toUpperCase()] ?? -1
}

const getSenderLabel = (p) => {
  const email = p?.nadawca_email ?? p?.nadawcaEmail ?? null
  if (email) return email

  const id = p?.nadawca_id ?? p?.nadawcaId ?? null
  if (id) return `nadawca #${id}`

  return "-"
}

const getReceiverLabel = (p) => {
  const email = p?.odbiorca_email ?? p?.odbiorcaEmail ?? null
  if (email) return email

  const id = p?.odbiorca_id ?? p?.odbiorcaId ?? null
  if (id) return `odbiorca #${id}`

  return "-"
}

const getCurrentLockerLabel = (p) =>
  p?.automat_aktualny_nazwa ??
  p?.automatAktualnyNazwa ??
  p?.aktualny_automat ??
  p?.aktualnyAutomat ??
  p?.automat_aktualny ??
  p?.automatAktualny ??
  p?.automat?.nazwa ??
  p?.automat?.name ??
  "-"

const getTargetLockerLabel = (p) =>
  p?.docelowy_automat_nazwa ??
  p?.docelowy_automatNazwa ??
  p?.docelowyAutomatNazwa ??
  p?.automat_docelowy_nazwa ??
  p?.automatDocelowyNazwa ??
  p?.docelowy_automat ??
  p?.docelowyAutomat ??
  p?.automat_docelowy ??
  p?.automatDocelowy ??
  p?.automat_docelowy?.nazwa ??
  p?.automatDocelowy?.nazwa ??
  "-"

const getTargetAutomatCityDirect = (p) =>
  p?.docelowy_automat_miasto ??
  p?.docelowyAutomatMiasto ??
  p?.docelowy_automat_city ??
  p?.docelowyAutomatCity ??
  p?.automat_docelowy_miasto ??
  p?.automatDocelowyMiasto ??
  p?.automat_docelowy_city ??
  p?.automatDocelowyCity ??
  p?.docelowy_automat?.miasto ??
  p?.docelowy_automat?.city ??
  p?.automat_docelowy?.miasto ??
  p?.automat_docelowy?.city ??
  null

const getTargetAutomatAddress = (p) =>
  p?.docelowy_automat_adres ??
  p?.docelowyAutomatAdres ??
  p?.automat_docelowy_adres ??
  p?.automatDocelowyAdres ??
  p?.docelowy_automat?.adres ??
  p?.docelowy_automat?.address ??
  p?.automat_docelowy?.adres ??
  p?.automat_docelowy?.address ??
  null

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

const getTargetCityLabel = (p) => {
  const direct = String(getTargetAutomatCityDirect(p) || "").trim()
  if (direct) return direct

  const inferred = inferCityFromAddress(getTargetAutomatAddress(p))
  if (inferred) return inferred

  return ""
}

const normalizeText = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ")

const resolveCurrentAutomatLabel = (p) => {
  const direct = String(getCurrentLockerLabel(p) || "-")
  if (direct !== "-") return direct

  const s = normalizeStatus(p?.status)
  if (s === "W_AUTOMACIE") return String(getTargetLockerLabel(p) || "-")

  return "-"
}

const getTargetAutomatId = (p) =>
  p?.docelowy_automat_id ??
  p?.docelowyAutomatId ??
  p?.automat_docelowy_id ??
  p?.automatDocelowyId ??
  p?.docelowy_automat?.automat_id ??
  p?.automat_docelowy?.automat_id ??
  p?.automat_docelowy?.id ??
  null

const ensureHistoryLabel = (eventsEl, labelId, labelText) => {
  if (!eventsEl) return null

  const existing = eventsEl.querySelector(`#${labelId}`)
  if (existing) return existing

  const label = document.createElement("p")
  label.id = labelId
  label.textContent = labelText

  return label
}

const getGridHost = (lockerDisplayEl) => lockerDisplayEl?.querySelector(".locker-display__grid") ?? null

const isSelectableLocker = (locker) => {
  const s = String(locker?.status ?? "").trim().toUpperCase()
  return s === "WOLNA" 
}

const getLockerSizeCode = (locker) =>
  String(locker?.rozmiar ?? locker?.rozmiar_kod ?? locker?.rozmiarKod ?? "")
    .trim()
    .toUpperCase() || null

const createLockerGrid = ({ lockerDisplayEl, lockerNameEl, onSelectLocker }) => {
  const gridHostEl = getGridHost(lockerDisplayEl)

  let selectedLockerId = null

  const clear = () => {
    selectedLockerId = null
    if (lockerNameEl) lockerNameEl.textContent = ""
    if (gridHostEl) gridHostEl.innerHTML = ""
    lockerDisplayEl?.classList.add("hidden")
  }

  const setTitle = (t) => {
    if (lockerNameEl) lockerNameEl.textContent = String(t || "")
  }

  const setSelected = (id) => {
    selectedLockerId = id != null ? String(id) : null
    gridHostEl?.querySelectorAll("[data-skrytka-id]").forEach((el) => {
      const isActive = selectedLockerId && el.dataset.skrytkaId === selectedLockerId
      if (isActive) el.classList.add("is-active")
      else el.classList.remove("is-active")
    })
  }

  const render = (layout, { requiredSizeCode } = {}) => {
    if (!gridHostEl) return
    gridHostEl.innerHTML = ""

    if (!Array.isArray(layout) || layout.length === 0) {
      lockerDisplayEl?.classList.add("hidden")
      return
    }

    const rows = layout[0]?.liczba_wierszy ?? 0
    const cols = layout[0]?.liczba_kolumn ?? 0
    if (!rows || !cols) {
      lockerDisplayEl?.classList.add("hidden")
      return
    }

    const UNIT_PX = 40

    const gridContainer = document.createElement("div")
    gridContainer.className = "locker-display__grid-container"
    gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`
    gridContainer.style.gridTemplateRows = `repeat(${rows}, ${UNIT_PX}px)`

    layout.forEach((locker) => {
      const id = locker?.skrytka_id ?? locker?.id ?? null
      if (!id) return

      const size = getLockerSizeCode(locker) ?? ""
      const status = String(locker?.status ?? "").trim()

      const el = document.createElement("button")
      el.type = "button"
      el.className = "locker-display__locker"
      el.dataset.skrytkaId = String(id)

      el.classList.add(`locker-display__locker--status-${status}`)
      if (size) el.classList.add(`locker-display__locker--size-${size}`)

      el.style.gridColumnStart = locker.kolumna
      el.style.gridRowStart = locker.wiersz

      if (String(size).toUpperCase() === "M") el.style.gridRowEnd = "span 2"

      el.textContent = `${id}\n${size || ""}`

      const selectable = isSelectableLocker(locker)
      if (!selectable) el.disabled = true

      el.addEventListener("click", () => {
        if (!selectable) return

        if (requiredSizeCode) {
          const a = sizeRank(size)
          const b = sizeRank(requiredSizeCode)
          if (a >= 0 && b >= 0 && a < b) {
            alert("Ta skrytka jest za mała dla tej paczki. Wybierz większą.")
            return
          }
        }

        setSelected(id)
        if (typeof onSelectLocker === "function") onSelectLocker({ id: Number(id), size })
      })

      gridContainer.appendChild(el)
    })

    gridHostEl.appendChild(gridContainer)
    lockerDisplayEl?.classList.remove("hidden")

    if (selectedLockerId) setSelected(selectedLockerId)
  }

  return {
    clear,
    setTitle,
    render,
    setSelected,
    getSelectedId: () => (selectedLockerId ? Number(selectedLockerId) : null)
  }
}

const createCourierDetailsView = ({
  detailsWrapperEl,
  detailsBoxEl,

  statusValueEl,
  dimsValueEl,
  senderValueEl,
  receiverValueEl,

  currentLockerValueEl,
  targetLockerValueEl,

  skrytkaRowEl,
  skrytkaValueEl,

  hintEl,
  btnStartTransport,
  btnPlaceInLocker,

  eventsEl,

  lockerDisplayEl,
  lockerNameEl,

  actionsEl,

  onAfterAction
}) => {
  let currentPackage = null
  let selectedLockerId = null

  const grid = createLockerGrid({
    lockerDisplayEl,
    lockerNameEl,
    onSelectLocker: ({ id }) => {
      selectedLockerId = Number(id)
      if (skrytkaValueEl) skrytkaValueEl.textContent = `#${selectedLockerId}`
      skrytkaRowEl?.classList.remove("hidden")
    }
  })

  const show = () => {
    detailsWrapperEl?.classList.remove("hidden")
    detailsBoxEl?.classList.remove("hidden")
  }

  const hide = () => {
    detailsBoxEl?.classList.add("hidden")
    detailsWrapperEl?.classList.add("hidden")
  }

  const setHint = (text) => {
    if (!hintEl) return
    hintEl.textContent = text || ""
  }

  const setEventsText = (text) => {
    if (!eventsEl) return

    const label = ensureHistoryLabel(eventsEl, "kurier-package-history-label", "Historia paczki")
    eventsEl.replaceChildren()
    if (label) eventsEl.appendChild(label)

    const p = document.createElement("p")
    p.textContent = text || ""
    eventsEl.appendChild(p)
  }

  const sortEventsNewestFirst = (list) => {
    list.sort((a, b) => {
      const ta = a?.czas ? new Date(a.czas).getTime() : 0
      const tb = b?.czas ? new Date(b.czas).getTime() : 0
      return tb - ta
    })
    return list
  }

  const renderEventHtml = (z, idx, total) => {
    const typ = z?.typ ?? "-"
    const czas = z?.czas ? new Date(z.czas).toLocaleString() : "-"
    const withLine = idx !== total - 1

    return `
      <div class="paczka-event">
        <div class="paczka-event__timeline">
          <span class="paczka-event__dot"></span>
          ${withLine ? `<span class="paczka-event__line"></span>` : ``}
        </div>

        <div class="paczka-event__content">
          <div class="paczka-event__top">
            <span class="paczka-event__type">${escapeHtml(typ)}</span>
            <span class="paczka-event__time">${escapeHtml(czas)}</span>
          </div>
        </div>
      </div>
    `
  }

  const renderEvents = (zdarzenia) => {
    if (!eventsEl) return

    const label = ensureHistoryLabel(eventsEl, "kurier-package-history-label", "Historia paczki")
    eventsEl.replaceChildren()
    if (label) eventsEl.appendChild(label)

    const list = Array.isArray(zdarzenia) ? zdarzenia.slice() : []
    if (list.length === 0) {
      const p = document.createElement("p")
      p.textContent = "Brak zdarzeń dla tej paczki."
      eventsEl.appendChild(p)
      return
    }

    sortEventsNewestFirst(list)

    const wrapper = document.createElement("div")
    wrapper.className = "paczka-events"
    wrapper.innerHTML = list.map((z, idx) => renderEventHtml(z, idx, list.length)).join("")
    eventsEl.appendChild(wrapper)
  }

  const loadEvents = async (p) => {
    if (!p || !eventsEl) return

    try {
      setEventsText("Ładowanie zdarzeń...")

      const paczkaId = getPackageId(p)
      const res = await apiFetch(ENDPOINTS.EVENTS(paczkaId))
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        setEventsText(data?.error || `Błąd pobierania zdarzeń (${res.status})`)
        return
      }

      const zdarzenia = data?.zdarzenia ?? data?.rows ?? data
      renderEvents(zdarzenia)
    } catch (err) {
      setEventsText(err?.message || "Nie udało się pobrać zdarzeń.")
    }
  }

  const updateButtons = (p) => {
    const s = normalizeStatus(p?.status)

    const canStart = s === "NADANA"
    const canPlace = s === "W_DRODZE"

    if (btnStartTransport) {
      btnStartTransport.disabled = !canStart
      if (canStart) btnStartTransport.classList.remove("hidden")
      else btnStartTransport.classList.add("hidden")
    }

    if (btnPlaceInLocker) {
      btnPlaceInLocker.disabled = !canPlace
      if (canPlace) btnPlaceInLocker.classList.remove("hidden")
      else btnPlaceInLocker.classList.add("hidden")
    }

    if (actionsEl) {
      if (canStart || canPlace) actionsEl.classList.remove("hidden")
      else actionsEl.classList.add("hidden")
    }

    if (canPlace) setHint("Wybierz skrytkę na siatce automatu i umieść paczkę w automacie.")
    else if (canStart) setHint("Rozpocznij transport paczki.")
    else setHint("")
  }

  const clear = () => {
    currentPackage = null
    selectedLockerId = null

    statusValueEl && (statusValueEl.textContent = "")
    dimsValueEl && (dimsValueEl.textContent = "")
    senderValueEl && (senderValueEl.textContent = "")
    receiverValueEl && (receiverValueEl.textContent = "")

    currentLockerValueEl && (currentLockerValueEl.textContent = "")
    targetLockerValueEl && (targetLockerValueEl.textContent = "")

    skrytkaValueEl && (skrytkaValueEl.textContent = "")
    skrytkaRowEl?.classList.add("hidden")

    setHint("")
    if (eventsEl) eventsEl.replaceChildren()

    grid.clear()

    if (actionsEl) actionsEl.classList.add("hidden")
  }

  const loadTargetAutomatLayoutIfNeeded = async (p) => {
    selectedLockerId = null
    skrytkaValueEl && (skrytkaValueEl.textContent = "")
    skrytkaRowEl?.classList.add("hidden")
    grid.clear()

    const s = normalizeStatus(p?.status)
    if (s !== "W_DRODZE") return

    const automatId = getTargetAutomatId(p)
    if (!automatId) return

    try {
      const automatLabel = getTargetLockerLabel(p)
      grid.setTitle(`Automat docelowy: ${automatLabel} (ID: ${automatId})`)

      const res = await apiFetch(`/automaty/${automatId}`)
      const layout = await res.json().catch(() => null)

      if (!Array.isArray(layout) || layout.length === 0) {
        grid.clear()
        return
      }

      const requiredSizeCode = getRequiredSizeCode(p)
      grid.render(layout, { requiredSizeCode })
    } catch {
      grid.clear()
    }
  }

  const render = async (p) => {
    if (!p) {
      clear()
      hide()
      return
    }

    currentPackage = p

    statusValueEl && (statusValueEl.textContent = formatStatus(p?.status))
    dimsValueEl && (dimsValueEl.textContent = String(getDimsLabel(p) || "-"))
    senderValueEl && (senderValueEl.textContent = String(getSenderLabel(p) || "-"))
    receiverValueEl && (receiverValueEl.textContent = String(getReceiverLabel(p) || "-"))

    currentLockerValueEl && (currentLockerValueEl.textContent = resolveCurrentAutomatLabel(p))
    targetLockerValueEl && (targetLockerValueEl.textContent = String(getTargetLockerLabel(p) || "-"))

    updateButtons(p)

    eventsEl && setEventsText("Ładowanie zdarzeń...")
    await loadEvents(p)

    await loadTargetAutomatLayoutIfNeeded(p)

    show()
  }

  const bindActionsOnce = () => {
    if (btnStartTransport && btnStartTransport.dataset.bound !== "1") {
      btnStartTransport.dataset.bound = "1"
      btnStartTransport.type = "button"

      btnStartTransport.addEventListener("click", async () => {
        if (!currentPackage) return

        const s = normalizeStatus(currentPackage?.status)
        if (s !== "NADANA") return

        const paczkaId = getPackageId(currentPackage)
        if (!paczkaId) return

        try {
          btnStartTransport.disabled = true
          const prevText = btnStartTransport.textContent
          btnStartTransport.textContent = "Przetwarzanie..."

          const res = await apiFetch(ENDPOINTS.START_TRANSPORT(paczkaId), { method: "POST" })
          const data = await res.json().catch(() => null)

          if (!res.ok) {
            alert(data?.error || `Błąd rozpoczęcia transportu (${res.status})`)
            btnStartTransport.textContent = prevText
            btnStartTransport.disabled = false
            return
          }

          alert("Transport rozpoczęty.")
          if (typeof onAfterAction === "function") await onAfterAction(paczkaId)
        } catch (err) {
          alert(err?.message || "Nie udało się rozpocząć transportu.")
        } finally {
          btnStartTransport.disabled = false
          btnStartTransport.textContent = "Rozpocznij transport"
        }
      })
    }

    if (btnPlaceInLocker && btnPlaceInLocker.dataset.bound !== "1") {
      btnPlaceInLocker.dataset.bound = "1"
      btnPlaceInLocker.type = "button"

      btnPlaceInLocker.addEventListener("click", async () => {
        if (!currentPackage) return

        const s = normalizeStatus(currentPackage?.status)
        if (s !== "W_DRODZE") return

        const paczkaId = getPackageId(currentPackage)
        if (!paczkaId) return

        if (!selectedLockerId || !Number.isInteger(Number(selectedLockerId))) {
          alert("Wybierz skrytkę na siatce automatu.")
          return
        }

        try {
          btnPlaceInLocker.disabled = true
          const prevText = btnPlaceInLocker.textContent
          btnPlaceInLocker.textContent = "Przetwarzanie..."

          const res = await apiFetch(ENDPOINTS.PLACE_IN_LOCKER(paczkaId), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ skrytka_id: Number(selectedLockerId) })
          })

          const data = await res.json().catch(() => null)

          if (!res.ok) {
            alert(data?.error || `Błąd umieszczenia w automacie (${res.status})`)
            btnPlaceInLocker.textContent = prevText
            btnPlaceInLocker.disabled = false
            return
          }

          alert("Paczka umieszczona w automacie.")

          if (currentPackage) {
            currentPackage.status = "W_AUTOMACIE"
            currentPackage.skrytka_id = Number(selectedLockerId)

            currentLockerValueEl && (currentLockerValueEl.textContent = resolveCurrentAutomatLabel(currentPackage))
            targetLockerValueEl && (targetLockerValueEl.textContent = String(getTargetLockerLabel(currentPackage) || "-"))

            selectedLockerId = null
            skrytkaValueEl && (skrytkaValueEl.textContent = "")
            skrytkaRowEl?.classList.add("hidden")

            grid.clear()
            updateButtons(currentPackage)
            setHint("")
          }

          if (typeof onAfterAction === "function") await onAfterAction(paczkaId)
        } catch (err) {
          alert(err?.message || "Nie udało się umieścić paczki w automacie.")
        } finally {
          btnPlaceInLocker.disabled = false
          btnPlaceInLocker.textContent = "Umieść w automacie"
        }
      })
    }
  }

  bindActionsOnce()

  return {
    setPackage: (p) => render(p),
    clearAndHide: () => render(null),
    getPackage: () => currentPackage
  }
}

const createCourierListView = ({ listEl, cityFilterEl, cityClearEl, onSelectPackage }) => {
  let packagesButtons = []
  let selectedId = null

  let allPackages = []
  let visiblePackages = []

  let selectedCity = ""

  const clearList = () => {
    if (!listEl) return
    listEl.innerHTML = ""
    packagesButtons = []
  }

  const renderEmpty = (msg) => {
    clearList()
    if (!listEl) return
    const p = document.createElement("p")
    p.textContent = msg || "Brak paczek."
    listEl.appendChild(p)
  }

  const findById = (id) => allPackages.find((p) => String(getPackageId(p)) === String(id)) || null

  const isVisibleId = (id) => visiblePackages.some((p) => String(getPackageId(p)) === String(id))

  const selectById = (id) => {
    const pkg = findById(id)
    selectedId = pkg ? String(getPackageId(pkg)) : null

    packagesButtons.forEach((b) => b.classList.remove("is-active"))

    const activeBtn = packagesButtons.find((b) => b.dataset.paczkaId === String(selectedId))
    if (activeBtn) activeBtn.classList.add("is-active")

    if (typeof onSelectPackage === "function") onSelectPackage(pkg)
  }

  const clearSelection = () => {
    selectedId = null
    packagesButtons.forEach((b) => b.classList.remove("is-active"))
    if (typeof onSelectPackage === "function") onSelectPackage(null)
  }

  const applyCityFilter = (list) => {
    const city = String(selectedCity || "").trim()
    if (!city) return list

    const want = normalizeText(city)
    return list.filter((p) => normalizeText(getTargetCityLabel(p)) === want)
  }

  const renderList = (packages) => {
    visiblePackages = Array.isArray(packages) ? packages : []
    clearList()

    if (!Array.isArray(packages) || packages.length === 0) {
      renderEmpty("Brak paczek.")
      return
    }

    packagesButtons = packages.map((p) => {
      const id = getPackageId(p)
      const status = formatStatus(p?.status)
      const sender = getSenderLabel(p)
      const receiver = getReceiverLabel(p)

      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "view-klient__lista-paczek__buttons-button"
      btn.dataset.paczkaId = String(id)

      btn.innerHTML = `
        <span class="view-klient__lista-paczek__buttons-button__mail">${escapeHtml(sender)} → ${escapeHtml(receiver)}</span>
        <span class="view-klient__lista-paczek__buttons-button__status">${escapeHtml(status)}</span>
        <img class="view-klient__lista-paczek__buttons-button__locker-svg" src="${lockerSvgUrl}" alt="Parcel Locker Icon" />
      `

      btn.addEventListener("click", () => {
        const clickedId = String(getPackageId(p))
        if (selectedId && clickedId === selectedId) {
          clearSelection()
          return
        }
        selectById(clickedId)
      })

      listEl.appendChild(btn)
      return btn
    })

    if (selectedId) {
      if (isVisibleId(selectedId)) selectById(selectedId)
      else clearSelection()
    }
  }

  const rerenderWithCurrentFilter = () => {
    const filtered = applyCityFilter(allPackages)
    renderList(filtered)
  }

  const setCityOptions = (miasta) => {
    if (!cityFilterEl) return

    const prev = String(selectedCity || cityFilterEl.value || "").trim()

    cityFilterEl.replaceChildren()

    const optAll = document.createElement("option")
    optAll.value = ""
    optAll.textContent = "Wszystkie miasta"
    cityFilterEl.appendChild(optAll)

    const list = Array.isArray(miasta) ? miasta.slice() : []
    list
      .map((m) => String(m || "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "pl"))
      .forEach((miasto) => {
        const opt = document.createElement("option")
        opt.value = miasto
        opt.textContent = miasto
        cityFilterEl.appendChild(opt)
      })

    if (prev) {
      const match = Array.from(cityFilterEl.options).find((o) => normalizeText(o.value) === normalizeText(prev))
      if (match) {
        selectedCity = match.value
        cityFilterEl.value = match.value
      } else {
        selectedCity = ""
        cityFilterEl.value = ""
      }
    } else {
      selectedCity = ""
      cityFilterEl.value = ""
    }
  }

  const bindFiltersOnce = () => {
    if (cityFilterEl && cityFilterEl.dataset.bound !== "1") {
      cityFilterEl.dataset.bound = "1"
      cityFilterEl.addEventListener("change", () => {
        selectedCity = String(cityFilterEl.value || "").trim()
        rerenderWithCurrentFilter()
      })
    }

    if (cityClearEl && cityClearEl.dataset.bound !== "1") {
      cityClearEl.dataset.bound = "1"
      cityClearEl.type = "button"
      cityClearEl.addEventListener("click", () => {
        selectedCity = ""
        if (cityFilterEl) cityFilterEl.value = ""
        rerenderWithCurrentFilter()
      })
    }
  }

  const reload = async (opts = {}) => {
    if (opts.selectedId !== undefined) selectedId = opts.selectedId ? String(opts.selectedId) : null

    try {
      const tasks = [apiFetch(ENDPOINTS.LIST), apiFetch(ENDPOINTS.POOL)]
      if (cityFilterEl) tasks.push(apiFetch(`/miasta`))

      const [resMine, resPool, resCities] = await Promise.all(tasks)

      const dataMine = await resMine.json().catch(() => null)
      const dataPool = await resPool.json().catch(() => null)

      if (resCities) {
        const miasta = await resCities.json().catch(() => [])
        if (resCities.ok) setCityOptions(miasta)
      }

      if (!resMine.ok && !resPool.ok) {
        const errMsg = dataMine?.error || dataPool?.error || `Błąd pobierania paczek`
        allPackages = []
        renderEmpty(errMsg)
        clearSelection()
        return
      }

      const mine = (dataMine?.paczki ?? dataMine?.rows ?? dataMine) || []
      const pool = (dataPool?.paczki ?? dataPool?.rows ?? dataPool) || []

      const byId = new Map()
      ;[...pool, ...mine].forEach((p) => {
        const id = getPackageId(p)
        if (id != null) byId.set(String(id), p)
      })

      allPackages = Array.from(byId.values())

      rerenderWithCurrentFilter()

      if (!selectedId) clearSelection()
      else if (!isVisibleId(selectedId)) clearSelection()
    } catch (err) {
      allPackages = []
      renderEmpty(err?.message || "Nie udało się pobrać paczek.")
      clearSelection()
    }
  }

  bindFiltersOnce()

  return {
    reload,
    selectById,
    clearSelection,
    getSelectedId: () => selectedId,
    getLastPackages: () => allPackages
  }
}


export function initKurierPanel() {
  const role = (localStorage.getItem("rola") || "").toUpperCase()
  if (role !== "KURIER") return

  const listEl = getElById("kurier-paczki-list")
  const detailsWrapperEl = getElById("kurier-paczka-details")
  const detailsBoxEl = getElById("kurier-paczka-details_box")

  const statusValueEl = getElById("kurier-status-value")
  const dimsValueEl = getElById("kurier-dims-value")
  const senderValueEl = getElById("kurier-sender-value")
  const receiverValueEl = getElById("kurier-receiver-value")

  const currentLockerValueEl = getElById("kurier-aktualny-automat-value")
  const targetLockerValueEl = getElById("kurier-docelowy-automat-value")

  const skrytkaRowEl = getElById("kurier-skrytka-row")
  const skrytkaValueEl = getElById("kurier-skrytka-value")

  const hintEl = getElById("kurier-hint")

  const btnStartTransport = getElById("kurier-odebrana-btn")
  const btnPlaceInLocker = getElById("kurier-dostarcz-btn")

  const eventsEl = getElById("kurier-paczka-zdarzenia")

  const lockerDisplayEl = getElById("kurier-locker-display")
  const lockerNameEl = getElById("kurier-locker-name")

  const cityFilterEl = getElById("kurier-city-filter")
  const cityClearEl = getElById("kurier-city-filter-clear")

  const actionsEl =
    getElById("kurier-actions") ||
    detailsBoxEl?.querySelector(".view-kurier__paczka-details__box-actions") ||
    null

  if (!listEl || !detailsWrapperEl || !detailsBoxEl) return

  let listView = null

  const detailsView = createCourierDetailsView({
    detailsWrapperEl,
    detailsBoxEl,

    statusValueEl,
    dimsValueEl,
    senderValueEl,
    receiverValueEl,

    currentLockerValueEl,
    targetLockerValueEl,

    skrytkaRowEl,
    skrytkaValueEl,

    hintEl,
    btnStartTransport,
    btnPlaceInLocker,

    eventsEl,

    lockerDisplayEl,
    lockerNameEl,

    actionsEl,

    onAfterAction: async (paczkaId) => {
      await listView?.reload({ selectedId: String(paczkaId) })
      listView?.selectById(String(paczkaId))
    }
  })

  listView = createCourierListView({
    listEl,
    cityFilterEl,
    cityClearEl,
    onSelectPackage: (p) => detailsView.setPackage(p)
  })

  detailsView.clearAndHide()
  listView.reload()
}
