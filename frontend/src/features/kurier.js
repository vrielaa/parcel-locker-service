import { getElById } from "../utils.js"
import { displayMessageForSeconds } from "../messages.js"
import { apiFetch } from "../api.js"

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

const fmtDims = (p) => {
  const a = Number(p?.szerokosc_cm ?? 0)
  const b = Number(p?.wysokosc_cm ?? 0)
  const c = Number(p?.glebokosc_cm ?? 0)
  if (!a || !b || !c) return "-"
  return `${a}×${b}×${c} cm`
}

const fmtAutomat = (nazwa, adres, id) => {
  if (!nazwa && !adres) return "-"
  const a = nazwa ? String(nazwa) : ""
  const b = adres ? String(adres) : ""
  const c = id ? ` (ID: ${id})` : ""
  return `${a}${c}${b ? `, ${b}` : ""}`
}

const renderEvents = (list) => {
  const rows = Array.isArray(list) ? list : []
  if (rows.length === 0) return `<div>-</div>`

  return rows
    .map((e) => {
      const typ = escapeHtml(e?.typ ?? "-")
      const opis = escapeHtml(e?.opis ?? "")
      const czas = e?.czas ? new Date(e.czas).toLocaleString() : "-"
      return `
        <div class="paczka-details__event">
          <div class="paczka-details__event-top">
            <span class="paczka-details__event-type">${typ}</span>
            <span class="paczka-details__event-time">${escapeHtml(czas)}</span>
          </div>
          ${opis ? `<div class="paczka-details__event-desc">${opis}</div>` : ""}
        </div>
      `
    })
    .join("")
}

const getId = (p) => p?.paczka_id ?? null
const getTracking = (p) => p?.numer_tracking ?? "-"
const getSenderEmail = (p) => p?.nadawca_email ?? "-"
const getReceiverEmail = (p) => p?.odbiorca_email ?? "-"

export function initKurierPanel() {
  const listEl = getElById("kurier-paczki-list")
  const detailsEl = getElById("kurier-paczka-details")

  const titleEl = getElById("kurier-paczka-title")
  const eventsEl = getElById("kurier-paczka-zdarzenia")

  const statusEl = getElById("kurier-status-value")
  const dimsEl = getElById("kurier-dims-value")
  const senderEl = getElById("kurier-sender-value")
  const receiverEl = getElById("kurier-receiver-value")
  const aktualnyAutomatEl = getElById("kurier-aktualny-automat-value")
  const docelowyAutomatEl = getElById("kurier-docelowy-automat-value")

  const skrytkaRowEl = getElById("kurier-skrytka-row")
  const skrytkaSelect = getElById("kurier-skrytka-select")
  const hintEl = getElById("kurier-hint")

  const deliverBtn = getElById("kurier-dostarcz-btn")
  const pickupBtn = getElById("kurier-odebrana-btn")

  if (!listEl || !detailsEl || !titleEl || !eventsEl || !deliverBtn || !pickupBtn) return

  let all = []
  let selectedId = null
  let isLoading = false
  let skrytki = []

  const showDetails = () => detailsEl.classList.remove("hidden")
  const hideDetails = () => detailsEl.classList.add("hidden")

  const setHint = (t) => {
    if (!hintEl) return
    hintEl.textContent = t || ""
  }

  const showSkrytkaRow = () => skrytkaRowEl && skrytkaRowEl.classList.remove("hidden")
  const hideSkrytkaRow = () => skrytkaRowEl && skrytkaRowEl.classList.add("hidden")

  const resetSelect = () => {
    if (!skrytkaSelect) return
    skrytkaSelect.replaceChildren()
    skrytkaSelect.disabled = true
    skrytki = []
  }

  const fillSelect = (rows) => {
    if (!skrytkaSelect) return
    resetSelect()

    const list = Array.isArray(rows) ? rows : []
    skrytki = list

    const opt0 = document.createElement("option")
    opt0.value = ""
    opt0.textContent = list.length ? "Wybierz skrytkę..." : "Brak wolnych skrytek"
    opt0.disabled = true
    opt0.selected = true
    skrytkaSelect.appendChild(opt0)

    list.forEach((s) => {
      const opt = document.createElement("option")
      opt.value = String(s.skrytka_id)
      opt.textContent = `#${s.skrytka_id} | ${s.rozmiar_kod} | r${s.wiersz} k${s.kolumna}`
      skrytkaSelect.appendChild(opt)
    })

    skrytkaSelect.disabled = list.length === 0
  }

  const clearDetails = () => {
    titleEl.textContent = ""
    statusEl && (statusEl.textContent = "")
    dimsEl && (dimsEl.textContent = "")
    senderEl && (senderEl.textContent = "")
    receiverEl && (receiverEl.textContent = "")
    aktualnyAutomatEl && (aktualnyAutomatEl.textContent = "")
    docelowyAutomatEl && (docelowyAutomatEl.textContent = "")
    eventsEl.innerHTML = ""
    resetSelect()
    hideSkrytkaRow()
    setHint("")
    deliverBtn.disabled = true
    pickupBtn.disabled = true
    hideDetails()
  }

  const loadEvents = async (id) => {
    const res = await apiFetch(`/paczki/${id}/zdarzenia`)
    const data = await res.json().catch(() => null)
    if (!res.ok) return []
    return Array.isArray(data?.zdarzenia) ? data.zdarzenia : []
  }

  const loadSkrytkiDocelowe = async (id) => {
    const res = await apiFetch(`/kurier/paczki/${id}/skrytki-docelowe`)
    const data = await res.json().catch(() => null)
    if (!res.ok) return []
    return Array.isArray(data?.skrytki) ? data.skrytki : []
  }

  const setDetails = async (p) => {
    if (!p) {
      clearDetails()
      return
    }

    const id = getId(p)
    const tracking = getTracking(p)
    const st = normalizeStatus(p?.status)

    titleEl.textContent = `#${id} | ${tracking}`
    statusEl && (statusEl.textContent = formatStatus(p?.status))
    dimsEl && (dimsEl.textContent = fmtDims(p))
    senderEl && (senderEl.textContent = String(getSenderEmail(p)))
    receiverEl && (receiverEl.textContent = String(getReceiverEmail(p)))

    aktualnyAutomatEl &&
      (aktualnyAutomatEl.textContent = fmtAutomat(p?.aktualny_automat_nazwa, p?.aktualny_automat_adres, p?.aktualny_automat_id))

    docelowyAutomatEl &&
      (docelowyAutomatEl.textContent = fmtAutomat(p?.docelowy_automat_nazwa, p?.docelowy_automat_adres, p?.docelowy_automat_id))

    setHint("")
    resetSelect()
    hideSkrytkaRow()

    deliverBtn.disabled = true
    pickupBtn.disabled = true

    showDetails()

    const ev = await loadEvents(id).catch(() => [])
    eventsEl.innerHTML = renderEvents(ev)

    if (st === "NADANA") {
      pickupBtn.disabled = false
      deliverBtn.disabled = true
      setHint("")
      return
    }

    if (st === "W_DRODZE") {
      pickupBtn.disabled = true

      showSkrytkaRow()
      const lockers = await loadSkrytkiDocelowe(id).catch(() => [])
      fillSelect(lockers)

      deliverBtn.disabled = true
      if (lockers.length === 0) {
        setHint("Brak wolnych skrytek pasujących do paczki w docelowym automacie.")
      }
      return
    }

    if (st === "W_AUTOMACIE") {
      pickupBtn.disabled = true
      deliverBtn.disabled = true
      hideSkrytkaRow()
      resetSelect()
      setHint("Paczka czeka na odbiór klienta.")
      return
    }

    deliverBtn.disabled = true
    pickupBtn.disabled = true
  }

  const renderList = () => {
    listEl.replaceChildren()

    if (!Array.isArray(all) || all.length === 0) {
      const p = document.createElement("p")
      p.textContent = "Brak paczek do obsługi."
      listEl.appendChild(p)
      clearDetails()
      return
    }

    all.forEach((p) => {
      const id = String(getId(p))
      const tracking = String(getTracking(p))
      const st = formatStatus(p?.status)

      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "paczki__item"
      btn.dataset.paczkaId = id

      btn.innerHTML = `
        <div class="paczki__item-left">
          <div class="paczki__item-title">${escapeHtml(tracking)}</div>
          <div class="paczki__item-sub">${escapeHtml(getSenderEmail(p))} → ${escapeHtml(getReceiverEmail(p))}</div>
        </div>
        <div class="paczki__item-right">${escapeHtml(st)}</div>
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

  const load = async () => {
    if (isLoading) return
    isLoading = true

    try {
      clearDetails()
      displayMessageForSeconds("Ładowanie paczek kuriera...", 2, "db-message")

      const res = await apiFetch("/kurier/paczki")

      console.log("Kurier paczki response:", res)
      const data = await res.json().catch(() => null)
      console.log("Kurier paczki data:", data)

      if (!res.ok) {
        all = []
        renderList()
        displayMessageForSeconds(data?.error || `Błąd (${res.status})`, 4, "db-message")
        return
      }

      all = Array.isArray(data?.paczki) ? data.paczki : []
      renderList()

      if (selectedId) {
        const picked = all.find((x) => String(getId(x)) === String(selectedId)) || null
        if (picked) await setDetails(picked)
        else {
          selectedId = null
          clearDetails()
        }
      }
    } finally {
      isLoading = false
    }
  }

  const pickupSelected = async () => {
    if (!selectedId) return
    pickupBtn.disabled = true
    setHint("")

    try {
      const res = await apiFetch(`/kurier/paczki/${selectedId}/podejmij`, { method: "POST" })    
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        setHint(data?.error || `Błąd (${res.status})`)
        pickupBtn.disabled = false
        return
      }

      displayMessageForSeconds("Rozpoczęto transport (W_DRODZE).", 3, "db-message")
      selectedId = null
      await load()
    } catch (err) {
      setHint(err?.message || "Nie udało się rozpocząć transportu.")
      pickupBtn.disabled = false
    }
  }

  const deliverSelected = async () => {
    if (!selectedId) return

    const skrytka_id = Number(skrytkaSelect?.value ?? 0)
    if (!Number.isInteger(skrytka_id) || skrytka_id <= 0) {
      setHint("Wybierz skrytkę docelową.")
      return
    }

    deliverBtn.disabled = true
    setHint("")

    try {
      const res = await apiFetch(`/kurier/paczki/${selectedId}/umiesc-w-automacie`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skrytka_id })
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        setHint(data?.error || `Błąd (${res.status})`)
        deliverBtn.disabled = false
        return
      }

      displayMessageForSeconds("Umieszczono paczkę w automacie (W_AUTOMACIE).", 3, "db-message")
      selectedId = null
      await load()
    } catch (err) {
      setHint(err?.message || "Nie udało się umieścić paczki.")
      deliverBtn.disabled = false
    }
  }

  if (listEl.dataset.bound !== "1") {
    listEl.dataset.bound = "1"

    pickupBtn.addEventListener("click", () => {
      pickupSelected()
    })

    deliverBtn.addEventListener("click", () => {
      deliverSelected()
    })

    skrytkaSelect &&
      skrytkaSelect.addEventListener("change", () => {
        const st = normalizeStatus(all.find((x) => String(getId(x)) === String(selectedId))?.status)
        if (st !== "W_DRODZE") return

        const v = Number(skrytkaSelect.value || 0)
        deliverBtn.disabled = !(Number.isInteger(v) && v > 0)
      })
  }

  load()
}
