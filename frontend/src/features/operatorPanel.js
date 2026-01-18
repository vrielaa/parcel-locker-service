import { getElById } from "../utils.js"
import { displayMessageForSeconds } from "../messages.js"
import { apiFetch } from "../api.js"

const endpoint = "operator/paczki/pending"

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

const getDestLockerText = (p) => {
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
  const skrytkaSelect = getElById("operator-skrytka-select")
  const hintEl = getElById("operator-hint")

  if (!listEl || !msgEl || !searchEl || !refreshBtn || !detailsBox || !approveBtn || !skrytkaSelect) return

  let all = []
  let filtered = []
  let selectedId = null
  let isLoading = false

  const setMessage = (t) => {
    msgEl.textContent = t || ""
    if (t) displayMessageForSeconds(t)
  }

  const showDetails = () => detailsBox.classList.remove("hidden")
  const hideDetails = () => detailsBox.classList.add("hidden")

  const setSkrytkaOptions = (list) => {
    skrytkaSelect.replaceChildren()

    const ph = document.createElement("option")
    ph.value = ""
    ph.disabled = true
    ph.selected = true
    ph.textContent = list?.length ? "Wybierz skrytkę" : "Brak pasujących skrytek"
    skrytkaSelect.appendChild(ph)

    ;(Array.isArray(list) ? list : []).forEach((s) => {
      const id = s?.skrytka_id ?? null
      if (!id) return
      const w = s?.wiersz ?? "-"
      const k = s?.kolumna ?? "-"
      const r = s?.rozmiar_kod ?? "-"

      const opt = document.createElement("option")
      opt.value = String(id)
      opt.textContent = `#${id} (wiersz ${w}, kol ${k}) [${r}]`
      skrytkaSelect.appendChild(opt)
    })
  }

  const clearDetails = () => {
    statusValue && (statusValue.textContent = "")
    trackingValue && (trackingValue.textContent = "")
    senderValue && (senderValue.textContent = "")
    receiverValue && (receiverValue.textContent = "")
    createdValue && (createdValue.textContent = "")
    dimsValue && (dimsValue.textContent = "")
    lockerValue && (lockerValue.textContent = "")
    hintEl && (hintEl.textContent = "")
    setSkrytkaOptions([])
    approveBtn.disabled = true
    hideDetails()
  }

  const loadSkrytki = async (paczkaId) => {
    try {
      setSkrytkaOptions([])
      const res = await apiFetch(`/operator/paczki/${paczkaId}/skrytki`)
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        hintEl && (hintEl.textContent = data?.error || `Błąd pobierania skrytek (${res.status})`)
        approveBtn.disabled = true
        return
      }

      const list = data?.skrytki ?? data?.rows ?? data ?? []
      const sk = Array.isArray(list) ? list : []

      setSkrytkaOptions(sk)

      if (sk.length === 0) {
        approveBtn.disabled = true
        hintEl && (hintEl.textContent = "Brak pasujących skrytek w docelowym automacie.")
        return
      }

      approveBtn.disabled = false
      hintEl && (hintEl.textContent = "")
    } catch (err) {
      approveBtn.disabled = true
      hintEl && (hintEl.textContent = err?.message || "Nie udało się pobrać skrytek.")
    }
  }

  const setDetails = async (p) => {
    if (!p) {
      clearDetails()
      return
    }

    statusValue && (statusValue.textContent = formatStatus(p?.status))
    trackingValue && (trackingValue.textContent = String(getTracking(p) || "-"))
    senderValue && (senderValue.textContent = String(getSenderEmail(p) || "-"))
    receiverValue && (receiverValue.textContent = String(getReceiverEmail(p) || "-"))
    createdValue && (createdValue.textContent = toLocal(getCreated(p)))
    dimsValue && (dimsValue.textContent = getDimsText(p))
    lockerValue && (lockerValue.textContent = getDestLockerText(p))

    approveBtn.disabled = true
    hintEl && (hintEl.textContent = "Ładowanie skrytek...")
    showDetails()

    const id = getId(p)
    if (!id) {
      hintEl && (hintEl.textContent = "Brak ID paczki.")
      return
    }

    await loadSkrytki(id)
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
          await setDetails(null)
          return
        }

        selectedId = id
        renderList()
        await setDetails(p)
      })

      listEl.appendChild(btn)
    })

    if (selectedId) {
      const picked = filtered.find((x) => String(getId(x)) === String(selectedId)) || null
      setDetails(picked)
    } else {
      clearDetails()
    }
  }

  const loadPending = async () => {
    if (isLoading) return
    isLoading = true

    try {
      setMessage("Ładowanie paczek...")
      clearDetails()

      const res = await apiFetch(`/${endpoint}`)
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
        const stillExists = filtered.some((x) => String(getId(x)) === String(selectedId))
        if (!stillExists) selectedId = null
      }

      renderList()
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

    const pickedSkrytka = String(skrytkaSelect.value || "").trim()
    const skrytka_id = Number(pickedSkrytka)

    if (!Number.isInteger(skrytka_id) || skrytka_id <= 0) {
      hintEl && (hintEl.textContent = "Wybierz skrytkę.")
      return
    }

    const p = filtered.find((x) => String(getId(x)) === String(selectedId)) || null
    if (!p) return

    approveBtn.disabled = true
    hintEl && (hintEl.textContent = "")

    try {
      const res = await apiFetch(`/operator/paczki/${selectedId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skrytka_id })
      })

      console.log(selectedId, skrytka_id)

      console.log("approveSelected res:", await res.text())
      const data = await res.json().catch(() => null)
      console.log("approveSelected data:", data)

      if (!res.ok) {
        const msg = data?.error || `Błąd zatwierdzania (${res.status})`
        hintEl && (hintEl.textContent = msg)
        approveBtn.disabled = false
        return
      }

      displayMessageForSeconds("Zatwierdzono paczkę.", 3, "db-message")

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
