// src/features/lockerGrid.js
import { addClass, removeClass } from "../utils.js"

const getLockerId = (x) => x?.skrytka_id ?? x?.id ?? null
const getLockerSize = (x) => String(x?.rozmiar ?? x?.rozmiar_kod ?? x?.rozmiarKod ?? "").trim().toUpperCase()
const getLockerStatus = (x) => String(x?.status ?? "").trim().toUpperCase()

const sizeRank = (s) => {
  const map = { XS: 0, S: 1, M: 2, L: 3, XL: 4 }
  return map[String(s || "").toUpperCase()] ?? -1
}

export const createLockerGrid = ({
  containerEl,
  titleEl,
  gridHostEl,
  unitPx = 40,
  isSelectable = () => true,
  canSelect = () => ({ ok: true }),
  onSelect = () => {}
}) => {
  let selectedId = null
  let lastLayout = []
  let lastAutomatTitle = ""

  const clear = () => {
    if (titleEl) titleEl.textContent = ""
    if (gridHostEl) gridHostEl.innerHTML = ""
    if (containerEl) addClass(containerEl, "hidden")
    selectedId = null
    lastLayout = []
    lastAutomatTitle = ""
  }

  const show = () => {
    if (containerEl) removeClass(containerEl, "hidden")
  }

  const setTitle = (t) => {
    lastAutomatTitle = String(t || "")
    if (titleEl) titleEl.textContent = lastAutomatTitle
  }

  const setSelected = (id) => {
    selectedId = id != null ? String(id) : null
    gridHostEl?.querySelectorAll("[data-skrytka-id]").forEach((el) => {
      const isActive = selectedId && el.dataset.skrytkaId === selectedId
      if (isActive) el.classList.add("is-active")
      else el.classList.remove("is-active")
    })
  }

  const getSelectedId = () => selectedId

  const renderLayout = (layout) => {
    lastLayout = Array.isArray(layout) ? layout : []
    if (!gridHostEl) return

    gridHostEl.innerHTML = ""
    if (!Array.isArray(layout) || layout.length === 0) return

    const rows = layout[0]?.liczba_wierszy ?? 0
    const cols = layout[0]?.liczba_kolumn ?? 0
    if (!rows || !cols) return

    const gridContainer = document.createElement("div")
    addClass(gridContainer, "locker-display__grid-container")
    gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`
    gridContainer.style.gridTemplateRows = `repeat(${rows}, ${unitPx}px)`

    layout.forEach((locker) => {
      const id = getLockerId(locker)
      if (!id) return

      const size = getLockerSize(locker)
      const status = getLockerStatus(locker)

      const el = document.createElement("button")
      el.type = "button"
      addClass(el, "locker-display__locker")
      addClass(el, `locker-display__locker--status-${status}`)
      addClass(el, `locker-display__locker--size-${size}`)
      el.dataset.skrytkaId = String(id)

      el.style.gridColumnStart = locker.kolumna
      el.style.gridRowStart = locker.wiersz

      if (size === "M") el.style.gridRowEnd = "span 2"

      el.textContent = `${id}\n${size}`

      const selectable = !!isSelectable(locker)
      if (!selectable) el.disabled = true

      el.addEventListener("click", () => {
        if (!selectable) return

        const verdict = canSelect(locker, { selectedId })
        if (!verdict?.ok) {
          alert(verdict?.reason || "Nie można wybrać tej skrytki.")
          return
        }

        setSelected(id)
        onSelect(locker, { selectedId: String(id) })
      })

      gridContainer.appendChild(el)
    })

    gridHostEl.appendChild(gridContainer)
    setSelected(selectedId)
    show()
  }

  const isLockerTooSmall = (lockerSize, requiredSize) => {
    const a = sizeRank(lockerSize)
    const b = sizeRank(requiredSize)
    if (a < 0 || b < 0) return false
    return a < b
  }

  return {
    clear,
    show,
    setTitle,
    renderLayout,
    setSelected,
    getSelectedId,
    isLockerTooSmall
  }
}
