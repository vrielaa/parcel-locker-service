//automat.js
import { qs, qsa, getElById, addClass, removeClass, hasClass } from "../utils.js"
import { displayMessageForSeconds } from "../messages.js"
import { API_BASE, apiFetch } from "../api.js"

export function initAutomatsView() {
    const buttonsCitiesContainer = getElById("buttons-cities")
    const listLockersInCityContainer = qs(".list-lockers-in-city")
    const lockerDisplay = qs(".locker-display")
    const lockerDisplayGrid = qs(".locker-display__grid")
    const goBackBtn = getElById("go-back-button")
    const getLockersBtn = getElById("get-automaty")
    const lockerName = getElById("locker-name")

    if (!buttonsCitiesContainer || !listLockersInCityContainer || !lockerDisplay || !lockerDisplayGrid || !lockerName || !goBackBtn || !getLockersBtn) return

    let citiesButtons = []
    let currentCity = null


    const resetAndHideLockerDisplay = () => {
    lockerName.textContent = ""
    lockerDisplayGrid.innerHTML = ""

    addClass(lockerDisplay, "hidden")
    }


    const showCities = async () => {
        console.log("showCities")
    
        resetAndHideLockerDisplay()

        listLockersInCityContainer.innerHTML = ""
        listLockersInCityContainer.classList.remove("hidden")

        addClass(goBackBtn, "hidden")

        if (citiesButtons.length === 0) await loadCitiesButtons()
        console.log(citiesButtons)
        buttonsCitiesContainer.innerHTML = ""
        citiesButtons.forEach((button) => {
            console.log("Appending button for city:", button.dataset.city)
        buttonsCitiesContainer.appendChild(button)
        })
    }

    const hideCities = () => {
        buttonsCitiesContainer.innerHTML = ""
    }

    const showAutomats = () => {
        resetAndHideLockerDisplay()
        listLockersInCityContainer.classList.remove("hidden")
        goBackBtn.classList.add("hidden")
    }

    const showGrid = () => {
        listLockersInCityContainer.classList.add("hidden")
        lockerDisplay.classList.remove("hidden")
        goBackBtn.classList.remove("hidden")
    }

    const loadCitiesButtons = async () => {
        displayMessageForSeconds("Ładowanie miast...", 2, "db-message")

        try {
            const res = await fetch(`${API_BASE}/miasta`)
            const miasta = await res.json()

        citiesButtons = miasta.map((miasto) => {
            const button = document.createElement("button")
            button.textContent = miasto
            button.dataset.city = miasto
            addClass(button, "buttons-cities__city-button")
            return button
        })

        displayMessageForSeconds("Miasta załadowane", 2, "db-message")
        } catch (err) {
        displayMessageForSeconds("Błąd: " + err.message, 5, "db-message")
        }
    }

    const listLockersInCityAndDisplay = async (miasto) => {
        console.log("listLockersInCityAndDisplay:", miasto)
        currentCity = miasto

        listLockersInCityContainer.innerHTML = ""
        showAutomats()

        try {
        const res = await apiFetch(`/automaty?miasto=${encodeURIComponent(miasto)}`)
        const automaty = await res.json()

        automaty.forEach((automat) => {
            const button = document.createElement("button")
            button.textContent = `${automat.nazwa} - ${automat.adres}`
            addClass(button, "list-lockers-in-city__locker-button")
            button.addEventListener("click", () => displayLockerDetails(automat))
            listLockersInCityContainer.appendChild(button)
        })
        } catch (err) {
        displayMessageForSeconds("Błąd: " + err.message, 5, "db-message")
        }
    }

    const displayLockerGrid = (layout) => {
        hideCities()
        lockerDisplayGrid.innerHTML = ""

        if (!Array.isArray(layout) || layout.length === 0) return

        const rows = layout[0].liczba_wierszy
        const cols = layout[0].liczba_kolumn
        const UNIT_PX = 40

        const gridContainer = document.createElement("div")
        addClass(gridContainer, "locker-display__grid-container")

        gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`
        gridContainer.style.gridTemplateRows = `repeat(${rows}, ${UNIT_PX}px)`

        layout.forEach((locker) => {
        if (!locker.skrytka_id) return

        const lockerDiv = document.createElement("div")

        addClass(lockerDiv, "locker-display__locker")
        addClass(lockerDiv, `status-${locker.status}`)
        addClass(lockerDiv, `size-${locker.rozmiar}`)

        lockerDiv.style.gridColumnStart = locker.kolumna
        lockerDiv.style.gridRowStart = locker.wiersz

        if (locker.rozmiar === "M") lockerDiv.style.gridRowEnd = "span 2"

        lockerDiv.textContent = `${locker.skrytka_id}\n${locker.rozmiar}`

        gridContainer.appendChild(lockerDiv)
        })

        lockerDisplayGrid.appendChild(gridContainer)
    }

    const displayLockerDetails = async (automat) => {
        try {
        const res = await apiFetch(`/automaty/${automat.automat_id}`)
        const layout = await res.json()

        if (!Array.isArray(layout) || layout.length === 0) {
            displayMessageForSeconds("Brak danych automatu.", 3, "db-message")
            return
        }

        lockerName.textContent = `Automat: ${automat.nazwa} (ID: ${automat.automat_id})`

        displayLockerGrid(layout)
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
    })

    goBackBtn.addEventListener("click", async () => {
        console.log("goBackBtn clicked")
        console.log("currentCity:", currentCity)
        if (!currentCity) return
        showCities()
        await listLockersInCityAndDisplay(currentCity)
    })
}
