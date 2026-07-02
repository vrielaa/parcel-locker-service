import { getElById } from "../utils.js"
import { displayMessageForSeconds } from "../messages.js"
import { apiFetch } from "../api.js"

const ENDPOINTS = {
  KLIENT: "/me/paczki",
  KURIER: "/kurier/paczki"
}

const lockerSvgUrl = new URL("../../svg/parcel-locker.svg", import.meta.url).href

const escapeHtml = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")

const formatStatus = (s) => {
  const map = {
    NADANA: "Nadana",
    W_DRODZE: "W drodze",
    W_AUTOMACIE: "W automacie",
    ODEBRANA: "Odebrana",
    PRZETERMINOWANA: "Odesłana do nadawcy",
    ANULOWANA: "Anulowana"
  }

  return map[String(s || "").toUpperCase()] || s || "-"
}

const getPickupDeadline = (p) =>
  p.termin_odbioru ?? p.odbior_do ?? p.terminOdbioru ?? p.odbiorDo ?? null

const getReceiverLabel = (p) => {
  const email = p?.odbiorca_email ?? null
  if (email) return email

  const id = p?.odbiorca_id ?? null
  if (id) return `odbiorca #${id}`

  return "-"
}
const parsePickupDeadline = (p) => {
  const raw = getPickupDeadline(p)
  if (!raw) return null

  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null

  return d
}

const isAfterDeadline = (p, now = new Date()) => {
  const d = parsePickupDeadline(p)
  if (!d) return false
  return now.getTime() > d.getTime()
}

const formatPickupDeadline = (p) => {
  const d = parsePickupDeadline(p)
  if (!d) return "-"
  return d.toLocaleString()
}

const getJwtPayload = () => {
  const token = localStorage.getItem("token") || localStorage.getItem("access_token") || ""

  const parts = String(token).split(".")
  if (parts.length !== 3) return null

  try {
    const b64 = parts[1].replaceAll("-", "+").replaceAll("_", "/")
    const pad = "=".repeat((4 - (b64.length % 4)) % 4)
    return JSON.parse(atob(b64 + pad))
  } catch {
    return null
  }
}

  const getMyClientId = () => {

    const p = getJwtPayload()
    const id = p?.klientId ?? null;
    
    return Number(id);
  }

const getPackageId = (p) => p?.paczka_id ?? p?.id ?? null

const getSenderLabel = (p) => {
  const email = p?.nadawca_email ?? p?.nadawcaEmail ?? null
  if (email) return email

  const id = p?.nadawca_id ?? p?.nadawcaId ?? null
  if (id) return `nadawca #${id}`

  return "-"
}



const getTracking = (p) => p?.numer_tracking ?? p?.tracking ?? p?.numer ?? "-"

const getLockerName = (p) =>
  p?.automat_nazwa ??
  p?.automatNazwa ??
  p?.nazwa_automatu ??
  p?.automat?.nazwa ??
  p?.automat?.name ??
  "-"

const getLockerLocation = (p) =>
  p?.automat_adres ??
  p?.automatAdres ??
  p?.adres_automatu ??
  p?.automat?.adres ??
  p?.automat?.address ??
  "-"

const normalizeRole = () => (localStorage.getItem("rola") || "").trim().toUpperCase()
const normalizeStatus = (s) => String(s || "").trim().toUpperCase()

const isArrivedStatus = (p) => {
  const s = normalizeStatus(p?.status)
  return s === "W_AUTOMACIE" || s === "ODEBRANA" || s === "PRZETERMINOWANA"
}

const isInLocker = (p) => normalizeStatus(p?.status) === "W_AUTOMACIE"


const createPackagesDetailsView = ({
  detailsBoxElement,
  eventsElement,
  lockerInfoEl,
  extendBtn,

  senderLabelEl,
  senderValueEl,

  receiverLabelEl,
  receiverValueEl,

  parcelNumberLabelEl,
  parcelNumberValueEl,

  lockerNameLabelEl,
  lockerNameValueEl,

  lockerLocationLabelEl,
  lockerLocationValueEl,

  statusRowEl,
  statusLabelEl,
  statusValueEl,

  deadlineRowEl,
  deadlineLabelEl,
  deadlineValueEl,

  onAfterExtend
}) => {
  let currentPackage = null

  const show = () => detailsBoxElement?.classList.remove("hidden")
  const hide = () => detailsBoxElement?.classList.add("hidden")

  const ensureHistoryLabel = () => {
    if (!eventsElement) return null

    const existing = eventsElement.querySelector("#package-history-label")
    if (existing) return existing

    const label = document.createElement("p")
    label.id = "package-history-label"
    label.textContent = "Historia paczki"

    return label
  }

  const setEventsText = (text) => {
    if (!eventsElement) return

    const label = ensureHistoryLabel()
    eventsElement.replaceChildren()

    if (label) eventsElement.appendChild(label)

    const p = document.createElement("p")
    p.textContent = text || ""
    eventsElement.appendChild(p)
  }

  const normalizeEvents = (eventsPayload) =>
    (Array.isArray(eventsPayload) ? eventsPayload.slice() : []).map((e) =>
      e && typeof e === "object" && typeof e.typ === "string"
        ? { ...e, typ: e.typ.replaceAll("_", " ") }
        : e
    )


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

  const renderEvents = (eventsPayload) => {
    if (!eventsElement) return

    const label = ensureHistoryLabel()
    eventsElement.replaceChildren()

    if (label) eventsElement.appendChild(label)

    const events = normalizeEvents(eventsPayload)
    if (events.length === 0) {
      const p = document.createElement("p")
      p.textContent = "Brak zdarzeń dla tej paczki."
      eventsElement.appendChild(p)
      return
    }

    sortEventsNewestFirst(events)

    const wrapper = document.createElement("div")
    wrapper.className = "paczka-events"
    wrapper.innerHTML = events.map((event, idx) => renderEventHtml(event, idx, events.length)).join("")

    eventsElement.appendChild(wrapper)
  }

  const loadEvents = async (p) => {
    if (!p || !eventsElement) return

    try {
      setEventsText("Ładowanie zdarzeń...")

      const packageId = getPackageId(p)
      const res = await apiFetch(`/paczki/${packageId}/zdarzenia`)
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        setEventsText(data?.error || `Błąd pobierania zdarzeń (${res.status})`)
        return
      }

      const events = data?.zdarzenia ?? data?.rows ?? data
      renderEvents(events)
    } catch (err) {
      setEventsText(err?.message || "Nie udało się pobrać zdarzeń.")
    }
  }

  const updateExtendButtonState = (p) => {
    if (!extendBtn) return

    const role = normalizeRole()
    const status = normalizeStatus(p?.status)
    const myId = getMyClientId()

    const isMeReceiver = Number(p?.odbiorca_id ?? null) === myId

    const canExtend =
      role === "KLIENT" &&
      status === "W_AUTOMACIE" &&
      !!p &&
      isMeReceiver 
      && !isAfterDeadline(p)

    if (canExtend) {
      extendBtn.classList.remove("hidden")
      extendBtn.disabled = false
      return
    }

    extendBtn.classList.add("hidden")
    extendBtn.disabled = true
  }

  const clear = () => {
    senderLabelEl && (senderLabelEl.textContent = "")
    senderValueEl && (senderValueEl.textContent = "")

    receiverLabelEl && (receiverLabelEl.textContent = "")
    receiverValueEl && (receiverValueEl.textContent = "")

    parcelNumberLabelEl && (parcelNumberLabelEl.textContent = "")
    parcelNumberValueEl && (parcelNumberValueEl.textContent = "")

    lockerNameLabelEl && (lockerNameLabelEl.textContent = "")
    lockerNameValueEl && (lockerNameValueEl.textContent = "")

    lockerLocationLabelEl && (lockerLocationLabelEl.textContent = "")
    lockerLocationValueEl && (lockerLocationValueEl.textContent = "")

    lockerInfoEl?.classList.add("hidden")

    statusLabelEl && (statusLabelEl.textContent = "")
    statusValueEl && (statusValueEl.textContent = "")

    deadlineLabelEl && (deadlineLabelEl.textContent = "")
    deadlineValueEl && (deadlineValueEl.textContent = "")
    deadlineRowEl?.classList.add("hidden")

    eventsElement && setEventsText("")

    updateExtendButtonState(null)
  }

  const render = (p) => {
    if (!p) {
      currentPackage = null
      clear()
      hide()
      return
    }

    currentPackage = p

    senderLabelEl && (senderLabelEl.textContent = "Nadawca:")
    senderValueEl && (senderValueEl.textContent = String(getSenderLabel(p) || "-"))

    receiverLabelEl && (receiverLabelEl.textContent = "Odbiorca:")
    receiverValueEl && (receiverValueEl.textContent = String(getReceiverLabel(p) || "-"))

    parcelNumberLabelEl && (parcelNumberLabelEl.textContent = "Numer tracking:")
    parcelNumberValueEl && (parcelNumberValueEl.textContent = String(getTracking(p) || "-"))

    statusLabelEl && (statusLabelEl.textContent = "Status:")
    statusValueEl && (statusValueEl.textContent = formatStatus(p?.status))

    if (isInLocker(p)) {
      deadlineLabelEl && (deadlineLabelEl.textContent = "Odbiór do:")
      deadlineValueEl && (deadlineValueEl.textContent = formatPickupDeadline(p))
      deadlineRowEl?.classList.remove("hidden")
    } else {
      deadlineValueEl && (deadlineValueEl.textContent = "")
      deadlineRowEl?.classList.add("hidden")
    }

    const arrived = isArrivedStatus(p)

    if (!arrived) {
      lockerNameLabelEl && (lockerNameLabelEl.textContent = "")
      lockerNameValueEl && (lockerNameValueEl.textContent = "")
      lockerLocationLabelEl && (lockerLocationLabelEl.textContent = "")
      lockerLocationValueEl && (lockerLocationValueEl.textContent = "")
      lockerInfoEl?.classList.add("hidden")
    } else {
      lockerNameLabelEl && (lockerNameLabelEl.textContent = "Automat:")
      lockerNameValueEl && (lockerNameValueEl.textContent = String(getLockerName(p) || "-"))

      lockerLocationLabelEl && (lockerLocationLabelEl.textContent = "Lokalizacja:")
      lockerLocationValueEl && (lockerLocationValueEl.textContent = String(getLockerLocation(p) || "-"))

      lockerInfoEl?.classList.remove("hidden")
    }

    updateExtendButtonState(p)

    eventsElement && setEventsText("Ładowanie zdarzeń...")
    loadEvents(p)

    show()
  }

  const bindExtendOnce = () => {
    if (!extendBtn) return
    extendBtn.type = "button"

    if (extendBtn.dataset.bound === "1") return
    extendBtn.dataset.bound = "1"

    extendBtn.addEventListener("click", async () => {
      if (!currentPackage) return

      const packageId = getPackageId(currentPackage)
      if (!packageId) return

      const extensionHours = 24

      try {
        extendBtn.disabled = true
        const prevText = extendBtn.textContent
        extendBtn.textContent = "Przedłużanie..."

        const res = await apiFetch(`/paczki/${packageId}/przedluzenia`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ile_godzin: extensionHours })
        })

        const data = await res.json().catch(() => null)

        if (!res.ok) {
          alert(data?.error || `Błąd przedłużania paczki (${res.status})`)
          extendBtn.textContent = prevText
          extendBtn.disabled = false
          return
        }

        alert("Paczka została pomyślnie przedłużona.")
        if (typeof onAfterExtend === "function") await onAfterExtend(packageId)
      } catch (err) {
        alert(err?.message || "Nie udało się przedłużyć paczki.")
      } finally {
        extendBtn.disabled = false
        extendBtn.textContent = "Przedłuż"
      }
    })
  }

  bindExtendOnce()

  return {
    setPackage: (p) => render(p),
    clearAndHide: () => render(null)
  }
}


const createPackagesListView = ({
  messageEl,
  buttonsContainerEl,
  btnSentToMe,
  btnSentByMe,
  endpoint,
  onSelectPackage
}) => {
  let packagesButtons = []
  let packagesToMe = []
  let packagesFromMe = []
  let currentMode = "TO_ME"
  let selectedId = null

  const setMessage = (text) => {
    if (!messageEl) return
    messageEl.textContent = text || ""
    // if (text) displayMessageForSeconds(text)
  }

  const clearList = () => {
    if (!buttonsContainerEl) return
    buttonsContainerEl.innerHTML = ""
    packagesButtons = []
  }

  const setActiveToggle = (mode) => {
    if (!btnSentToMe || !btnSentByMe) return

    btnSentToMe.classList.remove("is-active")
    btnSentByMe.classList.remove("is-active")

    if (mode === "TO_ME") btnSentToMe.classList.add("is-active")
    if (mode === "BY_ME") btnSentByMe.classList.add("is-active")
  }





  const splitPackages = (packages) => {
    const list = Array.isArray(packages) ? packages : []
    const myId = getMyClientId()
    
    if (!myId) {
      packagesToMe = list
      packagesFromMe = []
      return
    }

    const isPending = (p) => normalizeStatus(p?.status) === "CZEKA_NA_ZATWIERDZENIE"


    packagesFromMe = list.filter((packageItem) => Number(packageItem?.nadawca_id ?? null) === myId)


    packagesToMe = list.filter((packageItem) => {
      const receiverId = Number(packageItem?.odbiorca_id ?? null)
      const senderId = Number(packageItem?.nadawca_id ?? null)

      if (receiverId !== myId) return false
      if (senderId === myId) return false
      if (isPending(packageItem)) return false

      return true
    })
  }


  const getCurrentPackages = () => (currentMode === "BY_ME" ? packagesFromMe : packagesToMe)

  const findPackageInCurrentMode = (id) => getCurrentPackages().find((p) => String(getPackageId(p)) === String(id)) || null

  const selectById = (id) => {
    const pkg = findPackageInCurrentMode(id)
    selectedId = pkg ? String(getPackageId(pkg)) : null

    packagesButtons.forEach((b) => b.classList.remove("is-active"))

    const activeBtn = packagesButtons.find((button) => button.dataset.packageId === String(selectedId))
    if (activeBtn) activeBtn.classList.add("is-active")

    if (typeof onSelectPackage === "function") onSelectPackage(pkg)
  }

  const clearSelection = () => {
    selectedId = null
    packagesButtons.forEach((b) => b.classList.remove("is-active"))
    if (typeof onSelectPackage === "function") onSelectPackage(null)
  }

  const renderList = (packages) => {
    clearList()

    if (!Array.isArray(packages) || packages.length === 0) {
      setMessage("Brak paczek.")
      return
    }

    setMessage("")

    packagesButtons = packages.map((p) => {
      const id = getPackageId(p)
      const who = currentMode === "BY_ME" ? getReceiverLabel(p) : getSenderLabel(p)
      const status = formatStatus(p?.status)

      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "view-klient__lista-paczek__buttons-button"
      btn.dataset.packageId = String(id)

      btn.innerHTML = `
        <span class="view-klient__lista-paczek__buttons-button__mail">${escapeHtml(who)}</span>
        <span class="view-klient__lista-paczek__buttons-button__status">${escapeHtml(status)}</span>
        ${
          status === "Odebrana" || status === "Odesłana do nadawcy"
            ? `<span class="view-klient__lista-paczek__buttons-button__delete">Usuń</span>`
            : ``
        }
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

      buttonsContainerEl.appendChild(btn)
      return btn
    })

    if (selectedId) selectById(selectedId)
  }

  const reload = async (opts = {}) => {
    if (!endpoint) {
      setMessage("Ta rola nie ma widoku paczek.")
      clearList()
      clearSelection()
      return
    }

    if (opts.mode) currentMode = opts.mode
    if (opts.selectedId !== undefined) selectedId = opts.selectedId ? String(opts.selectedId) : null

    try {
      const res = await apiFetch(endpoint)
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        setMessage(data?.error || `Błąd pobierania paczek (${res.status})`)
        clearList()
        clearSelection()
        return
      }

      const packages = data?.paczki ?? data?.rows ?? data
      splitPackages(packages)

      setMessage("")
      setActiveToggle(currentMode)
      renderList(getCurrentPackages())

      if (!selectedId) clearSelection()
    } catch (err) {
      setMessage(err?.message || "Nie udało się pobrać paczek.")
      clearList()
      clearSelection()
    }
  }

  const setMode = async (mode, opts = {}) => {
    currentMode = mode
    setActiveToggle(currentMode)

    if (!opts.keepSelection) selectedId = null
    renderList(getCurrentPackages())

    if (!selectedId) clearSelection()
  }

  if (btnSentToMe && btnSentToMe.dataset.bound !== "1") {
    btnSentToMe.dataset.bound = "1"

    btnSentToMe.addEventListener("click", () => {
      reload({ mode: "TO_ME", selectedId: null })
    })
  }

  if (btnSentByMe && btnSentByMe.dataset.bound !== "1") {
    btnSentByMe.dataset.bound = "1"

    btnSentByMe.addEventListener("click", () => {
      reload({ mode: "BY_ME", selectedId: null })
    })
  }


  return {
    reload,
    setMode,
    selectById,
    clearSelection,
    getSelectedId: () => selectedId
  }
}

export function initPackagesView() {
  const messagePackageListElement = getElById("lista-paczek-message")
  const buttonsPackagesContainer = getElById("lista-paczek-buttons")

  const detailsBoxElement = getElById("paczka-details-box")
  const generalInfoElement = getElById("general-info")

  const eventsElement = getElById("paczka-events")
  const lockerInfoEl = getElById("locker-info")

  const extendBtn = getElById("przedluz-btn")

  if (!messagePackageListElement || !buttonsPackagesContainer) return

  const senderLabelEl = getElById("sender-label") ?? null
  const senderValueEl = getElById("sender-value") ?? null

  const receiverLabelEl = getElById("receiver-label") ?? null
  const receiverValueEl = getElById("receiver-value") ?? null

  const parcelNumberLabelEl = getElById("parcel-number-label") ?? null
  const parcelNumberValueEl = getElById("parcel-number-value") ?? null

  const lockerNameLabelEl = getElById("locker-name-label") ?? null
  const lockerNameValueEl = getElById("locker-name-value") ?? null

  const statusRowEl = getElById("status-row") ?? null
  const statusLabelEl = getElById("status-label") ?? null
  const statusValueEl = getElById("status-value") ?? null

  const deadlineRowEl = getElById("deadline-row") ?? null
  const deadlineLabelEl = getElById("deadline-label") ?? null
  const deadlineValueEl = getElById("deadline-value") ?? null


  const lockerLocationLabelEl = getElById("locker-location-label") ?? null
  const lockerLocationValueEl = getElById("locker-location-value") ?? null

  const btnSentToMe = getElById("btn-sent-to-me")
  const btnSentByMe = getElById("btn-sent-by-me")

  const role = normalizeRole()
  const endpoint = ENDPOINTS[role]

  let listView = null

  const detailsView = createPackagesDetailsView({
    detailsBoxElement,
    eventsElement,
    lockerInfoEl,
    extendBtn,

    senderLabelEl,
    senderValueEl,

    receiverLabelEl,
    receiverValueEl,

    parcelNumberLabelEl,
    parcelNumberValueEl,

    lockerNameLabelEl,
    lockerNameValueEl,

    lockerLocationLabelEl,
    lockerLocationValueEl,

    statusRowEl,
    statusLabelEl,
    statusValueEl,

    deadlineRowEl,
    deadlineLabelEl,
    deadlineValueEl,

    onAfterExtend: async (packageId) => {
      await listView?.reload({ mode: "TO_ME", selectedId: String(packageId) })
      listView?.selectById(String(packageId))
    }
  })


  listView = createPackagesListView({
    messageEl: messagePackageListElement,
    buttonsContainerEl: buttonsPackagesContainer,
    btnSentToMe,
    btnSentByMe,
    endpoint,
    onSelectPackage: (p) => detailsView.setPackage(p)
  })

  detailsView.clearAndHide()
  listView.reload()
}
