import { qs, qsa, getElById, addClass, removeClass, hasClass } from "../utils.js"
import { displayMessageForSeconds } from "../messages.js"
import { apiFetch } from "../api.js"
import { createLockerGrid } from "./lockerGrid.js"

export function initAutomatsView() {
  const buttonsCitiesContainer = getElById("buttons-cities")
  const listLockersInCityContainer = qs(".list-lockers-in-city")
  const lockerDisplay = qs(".locker-display")
  const lockerDisplayGrid = qs(".locker-display__grid")
  const goBackBtn = getElById("go-back-button")
  const getLockersBtn = getElById("get-automaty")
  const lockerName = getElById("locker-name")
  const lockerInfoEl = getElById("locker-info")

  if (!buttonsCitiesContainer || !listLockersInCityContainer || !lockerDisplay || !lockerDisplayGrid || !lockerName || !goBackBtn || !getLockersBtn) return

  let citiesButtons = []
  let currentCity = null
  let automatsReqId = 0

  const grid = createLockerGrid({
    containerEl: lockerDisplay,
    titleEl: lockerName,
    gridHostEl: lockerDisplayGrid,
    isSelectable: () => false
  })

  const showCities = async () => {
    grid.clear()

    listLockersInCityContainer.innerHTML = ""
    listLockersInCityContainer.classList.remove("hidden")

    addClass(goBackBtn, "hidden")

    if (citiesButtons.length === 0) await loadCitiesButtons()

    buttonsCitiesContainer.innerHTML = ""
    citiesButtons.forEach((button) => {
      buttonsCitiesContainer.appendChild(button)
    })
  }

  const hideCities = () => {
    buttonsCitiesContainer.innerHTML = ""
  }

  const showAutomats = () => {
    grid.clear()
    listLockersInCityContainer.classList.remove("hidden")
    goBackBtn.classList.add("hidden")
  }

  const showGrid = () => {
    listLockersInCityContainer.classList.add("hidden")
    lockerDisplay.classList.remove("hidden")
    lockerInfoEl.classList.remove("hidden")
    goBackBtn.classList.remove("hidden")
  }

  const loadCitiesButtons = async () => {
    try {
      const res = await apiFetch(`/miasta`)
      const miasta = await res.json()

      citiesButtons = miasta.map((miasto) => {
        const button = document.createElement("button")
        button.textContent = miasto
        button.dataset.city = miasto
        addClass(button, "buttons-cities__city-button")
        return button
      })
    } catch {}
  }

const listLockersInCityAndDisplay = async (miasto) => {
  currentCity = miasto

  const reqId = ++automatsReqId

  listLockersInCityContainer.innerHTML = ""
  showAutomats()

  try {
    const res = await apiFetch(`/automaty?miasto=${encodeURIComponent(miasto)}`)
    const data = await res.json().catch(() => null)

    if (reqId !== automatsReqId) return

    const automaty = (data?.automaty ?? data?.rows ?? data) || []

    listLockersInCityContainer.innerHTML = ""

    automaty.forEach((automat) => {
      const button = document.createElement("button")
      button.textContent = `${automat.nazwa} - ${automat.adres}`
      addClass(button, "list-lockers-in-city__locker-button")
      button.addEventListener("click", () => displayLockerDetails(automat))
      listLockersInCityContainer.appendChild(button)
    })
  } catch (err) {
    if (reqId !== automatsReqId) return
    displayMessageForSeconds("Błąd: " + err.message, 5, "db-message")
  }
}


  const displayLockerDetails = async (automat) => {
    try {
      const res = await apiFetch(`/automaty/${automat.automat_id}`)
      const layout = await res.json()

      if (!Array.isArray(layout) || layout.length === 0) {
        displayMessageForSeconds("Brak danych automatu.", 3, "db-message")
        return
      }

      hideCities()
      grid.setTitle(`Automat: ${automat.nazwa} (ID: ${automat.automat_id})`)
      grid.renderLayout(layout)
      showGrid()
    } catch (err) {
      displayMessageForSeconds("Błąd: " + err.message, 5, "db-message")
    }
  }

  buttonsCitiesContainer.addEventListener("click", (e) => {
    if (!hasClass(e.target, "buttons-cities__city-button")) return

    qsa(".buttons-cities__city-button").forEach((b) => removeClass(b, "isActive"))
    addClass(e.target, "isActive")

    const miasto = e.target.dataset.city
    if (!miasto) return

    listLockersInCityAndDisplay(miasto)
  })

  getLockersBtn.addEventListener("click", async () => {
    await showCities()
    lockerInfoEl.classList.add("hidden")
  })

  goBackBtn.addEventListener("click", async () => {
    if (!currentCity) return
    await showCities()
    await listLockersInCityAndDisplay(currentCity)
  })
}
