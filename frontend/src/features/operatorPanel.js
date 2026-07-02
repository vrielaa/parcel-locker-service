import { getElById } from "../utils.js"
import { displayMessageForSeconds } from "../messages.js"
import { apiFetch } from "../api.js"

const endpoint = "/operator/paczki/pending"

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
    PRZETERMINOWANA: "Przeterminowana",
    ANULOWANA: "Anulowana"
  }

  return map[normalizeStatus(s)] || s || "-"
}

const toLocal = (d) => {
  if (!d) return "-"
  const x = new Date(d)
  if (Number.isNaN(x.getTime())) return "-"
  return x.toLocaleString()
}

const getId = (p) => p?.paczka_id ?? p?.id ?? null
const getTracking = (p) => p?.numer_tracking ?? p?.tracking ?? p?.numer ?? "-"
const getSenderEmail = (p) => p?.nadawca_email ?? p?.nadawcaEmail ?? "-"
const getReceiverEmail = (p) => p?.odbiorca_email ?? p?.odbiorcaEmail ?? "-"
const getCreated = (p) => p?.data_nadania ?? p?.created_at ?? p?.dataNadania ?? null

const getDimsText = (p) => {
  const w = p?.szerokosc_cm ?? null
  const h = p?.wysokosc_cm ?? null
  const d = p?.glebokosc_cm ?? null
  if (!Number.isFinite(Number(w)) || !Number.isFinite(Number(h)) || !Number.isFinite(Number(d))) return "-"
  return `${w} × ${h} × ${d} cm`
}

const getDestAutomatText = (p) => {
  const name = p?.docelowy_automat_nazwa ?? p?.automat_nazwa ?? "-"
  const addr = p?.docelowy_automat_adres ?? p?.automat_adres ?? ""
  return addr ? `${name} — ${addr}` : name
}

export function initOperatorPanel() {
  const role = (localStorage.getItem("rola") || "").trim().toUpperCase()
  if (role !== "OPERATOR" && role !== "ADMIN") return

  const panelEl = getElById("operator-panel")
  if (!panelEl) return

  const listEl = getElById("operator-pending-list")
  const msgEl = getElById("operator-pending-message")

  const searchEl = getElById("operator-search")
  const refreshBtn = getElById("operator-refresh-btn")

  const detailsBox = getElById("operator-details-box")
  const approveBtn = getElById("operator-approve-btn")

  const statusValue = getElById("operator-status-value")
  const trackingValue = getElById("operator-tracking-value")
  const senderValue = getElById("operator-sender-value")
  const receiverValue = getElById("operator-receiver-value")
  const createdValue = getElById("operator-created-value")
  const dimsValue = getElById("operator-dims-value")
  const lockerValue = getElById("operator-locker-value")
  const hintEl = getElById("operator-hint")

  if (!listEl || !msgEl || !searchEl || !refreshBtn || !detailsBox || !approveBtn) return

  let all = []
  let filtered = []
  let selectedId = null
  let isLoading = false

  const setMessage = (t) => {
    msgEl.textContent = t || ""
    // if (t) displayMessageForSeconds(t, 2, "db-message")
  }

  const showDetails = () => detailsBox.classList.remove("hidden")
  const hideDetails = () => detailsBox.classList.add("hidden")

  const clearDetails = () => {
    statusValue && (statusValue.textContent = "")
    trackingValue && (trackingValue.textContent = "")
    senderValue && (senderValue.textContent = "")
    receiverValue && (receiverValue.textContent = "")
    createdValue && (createdValue.textContent = "")
    dimsValue && (dimsValue.textContent = "")
    lockerValue && (lockerValue.textContent = "")
    hintEl && (hintEl.textContent = "")
    approveBtn.disabled = true
    hideDetails()
  }

  const setDetails = async (p) => {
    if (!p) {
      clearDetails()
      return
    }

    const id = getId(p)
    if (!id) {
      clearDetails()
      hintEl && (hintEl.textContent = "Brak ID paczki.")
      return
    }

    statusValue && (statusValue.textContent = formatStatus(p?.status))
    trackingValue && (trackingValue.textContent = String(getTracking(p) || "-"))
    senderValue && (senderValue.textContent = String(getSenderEmail(p) || "-"))
    receiverValue && (receiverValue.textContent = String(getReceiverEmail(p) || "-"))
    createdValue && (createdValue.textContent = toLocal(getCreated(p)))
    dimsValue && (dimsValue.textContent = getDimsText(p))
    lockerValue && (lockerValue.textContent = getDestAutomatText(p))

    hintEl && (hintEl.textContent = "Skrytkę wybierze kurier w docelowym automacie.")
    approveBtn.disabled = false
    showDetails()
  }

  const applyFilter = () => {
    const q = String(searchEl.value || "").trim().toLowerCase()

    if (!q) {
      filtered = all.slice()
      return
    }

    filtered = all.filter((p) => {
      const id = String(getId(p) ?? "")
      const tr = String(getTracking(p) ?? "").toLowerCase()
      const se = String(getSenderEmail(p) ?? "").toLowerCase()
      const re = String(getReceiverEmail(p) ?? "").toLowerCase()

      return id.includes(q) || tr.includes(q) || se.includes(q) || re.includes(q)
    })
  }

  const renderList = () => {
    listEl.replaceChildren()

    if (!Array.isArray(filtered) || filtered.length === 0) {
      setMessage("Brak paczek do zatwierdzenia.")
      clearDetails()
      return
    }

    setMessage("")

    filtered.forEach((p) => {
      const id = String(getId(p))
      const tracking = String(getTracking(p))
      const sender = String(getSenderEmail(p))
      const receiver = String(getReceiverEmail(p))

      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "operator-panel__item"
      btn.dataset.paczkaId = id

      btn.innerHTML = `
        <div class="operator-panel__item-left">
          <div class="operator-panel__item-tracking">${escapeHtml(tracking)}</div>
          <div class="operator-panel__item-emails">${escapeHtml(sender)} → ${escapeHtml(receiver)}</div>
        </div>
        <div class="operator-panel__item-right">${escapeHtml(formatStatus(p?.status))}</div>
      `

      if (selectedId && selectedId === id) btn.classList.add("is-active")

      btn.addEventListener("click", async () => {
        if (selectedId === id) {
          selectedId = null
          renderList()
          clearDetails()
          return
        }

        selectedId = id
        renderList()
        await setDetails(p)
      })

      listEl.appendChild(btn)
    })
  }

  const loadPending = async () => {
    if (isLoading) return
    isLoading = true

    try {
      setMessage("Ładowanie paczek...")
      clearDetails()

      const res = await apiFetch(endpoint)
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        setMessage(data?.error || `Błąd pobierania (${res.status})`)
        all = []
        filtered = []
        renderList()
        return
      }

      const list = data?.paczki ?? data?.rows ?? data ?? []
      all = Array.isArray(list) ? list : []

      applyFilter()

      if (selectedId) {
        const picked = filtered.find((x) => String(getId(x)) === String(selectedId)) || null
        if (!picked) selectedId = null
      }

      renderList()

      if (selectedId) {
        const picked = filtered.find((x) => String(getId(x)) === String(selectedId)) || null
        if (picked) await setDetails(picked)
        else clearDetails()
      }
    } catch (err) {
      setMessage(err?.message || "Nie udało się pobrać paczek.")
      all = []
      filtered = []
      renderList()
    } finally {
      isLoading = false
    }
  }

  const approveSelected = async () => {
    if (!selectedId) return

    const p = filtered.find((x) => String(getId(x)) === String(selectedId)) || null
    if (!p) return

    approveBtn.disabled = true
    hintEl && (hintEl.textContent = "")

    try {
      const res = await apiFetch(`/operator/paczki/${selectedId}/approve`, {
        method: "POST"
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        const msg = data?.error || `Błąd zatwierdzania (${res.status})`
        hintEl && (hintEl.textContent = msg)
        approveBtn.disabled = false
        return
      }

      // displayMessageForSeconds("Zatwierdzono paczkę.", 3, "db-message")

      selectedId = null
      await loadPending()
    } catch (err) {
      hintEl && (hintEl.textContent = err?.message || "Nie udało się zatwierdzić.")
      approveBtn.disabled = false
    }
  }

  if (panelEl.dataset.bound !== "1") {
    panelEl.dataset.bound = "1"

    searchEl.addEventListener("input", () => {
      applyFilter()
      renderList()

      if (selectedId) {
        const picked = filtered.find((x) => String(getId(x)) === String(selectedId)) || null
        if (!picked) {
          selectedId = null
          clearDetails()
        }
      }
    })

    refreshBtn.addEventListener("click", () => {
      loadPending()
    })

    approveBtn.addEventListener("click", () => {
      approveSelected()
    })
  }

  loadPending()
}
