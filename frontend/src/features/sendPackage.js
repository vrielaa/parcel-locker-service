// sendPackages.js
import { getElById } from "../utils.js"
import { displayMessageForSeconds } from "../messages.js"
import { apiFetch, API_BASE } from "../api.js"

const SELECTORS = {
  navBtnId: "nav-create-package",
  formId: "create-package-form",
  recipientEmailId: "recipient-email",
  lockerSelectId: "locker-select",
  citySelectId: "city-select",
  packageWidthId: "package-width",
  packageHeightId: "package-height",
  packageDepthId: "package-depth",
  packageSizeId: "package-size",
  packageSizeHintId: "package-size-hint"
}

const citiesCache = []

const escapeHtml = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")

const getLockerId = (a) => a?.automat_id ?? a?.id ?? a?.automatId ?? null
const getLockerName = (a) => a?.nazwa ?? a?.name ?? a?.automat_nazwa ?? a?.automatNazwa ?? "-"
const getLockerAddress = (a) => a?.adres ?? a?.address ?? a?.automat_adres ?? a?.automatAdres ?? ""
const getLockerCity = (a) => a?.miasto ?? a?.city ?? a?.automat_miasto ?? a?.automatMiasto ?? ""

const buildLockerLabel = (a) => {
  const name = getLockerName(a)
  const city = getLockerCity(a)
  const addr = getLockerAddress(a)
  const suffix = city ? city : addr ? addr : ""
  return suffix ? `${name} — ${suffix}` : name
}

const normalizeLockersResponse = (data) => {
  const list = data?.automaty ?? data?.lockers ?? data?.rows ?? data
  return Array.isArray(list) ? list : []
}

const loadCities = async () => {
  try {
    const res = await fetch(`${API_BASE}/miasta`)
    const miasta = await res.json()

    miasta.forEach((city) => {
      const c = String(city || "").trim()
      if (c && !citiesCache.includes(c)) citiesCache.push(c)
    })

    return citiesCache
  } catch (err) {
    displayMessageForSeconds("Błąd: " + err.message, 5, "db-message")
    return []
  }
}

const loadLockersInCity = async (miasto) => {
  try {
    const res = await apiFetch(`/automaty?miasto=${encodeURIComponent(miasto)}`)
    const automaty = await res.json()
    return automaty
  } catch (err) {
    displayMessageForSeconds("Błąd: " + err.message, 5, "db-message")
    return []
  }
}

const SIZES = [
  { key: "small", label: "Mała", dims: [8, 38, 64] },
  { key: "medium", label: "Średnia", dims: [19, 38, 64] },
  { key: "large", label: "Duża", dims: [41, 38, 64] }
]

const toNumber = (v) => {
  const s = String(v ?? "").trim().replace(",", ".")
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const sortDims = (dims) => dims.slice().sort((a, b) => a - b)

const fitsAnyOrientation = (pkgDims, lockerDims) => {
  const p = sortDims(pkgDims)
  const l = sortDims(lockerDims)
  return p[0] <= l[0] && p[1] <= l[1] && p[2] <= l[2]
}

const pickSmallestFittingSize = (pkgDims) => {
  for (const s of SIZES) {
    if (fitsAnyOrientation(pkgDims, s.dims)) return s
  }
  return null
}

export function initSendPackageView() {
  const navBtn = getElById(SELECTORS.navBtnId)
  const formEl = getElById(SELECTORS.formId)
  const emailEl = getElById(SELECTORS.recipientEmailId)

  const cityEl = getElById(SELECTORS.citySelectId)
  const lockerEl = getElById(SELECTORS.lockerSelectId)

  const widthEl = getElById(SELECTORS.packageWidthId)
  const heightEl = getElById(SELECTORS.packageHeightId)
  const depthEl = getElById(SELECTORS.packageDepthId)

  const sizeEl = getElById(SELECTORS.packageSizeId)
  const sizeHintEl = getElById(SELECTORS.packageSizeHintId)

  if (
    !navBtn ||
    !formEl ||
    !emailEl ||
    !cityEl ||
    !lockerEl ||
    !widthEl ||
    !heightEl ||
    !depthEl ||
    !sizeEl ||
    !sizeHintEl
  )
    return

  let lockersLoaded = false

  const setFormDisabled = (disabled) => {
    emailEl.disabled = disabled
    cityEl.disabled = disabled
    lockerEl.disabled = disabled
    widthEl.disabled = disabled
    heightEl.disabled = disabled
    depthEl.disabled = disabled
    sizeEl.disabled = disabled

    const submitBtn = formEl.querySelector('button[type="submit"]')
    if (submitBtn) submitBtn.disabled = disabled
  }

  const setCityOptions = async () => {
    await loadCities()

    cityEl.replaceChildren()

    const placeholder = document.createElement("option")
    placeholder.value = ""
    placeholder.disabled = true
    placeholder.selected = true
    placeholder.textContent = "Wybierz miasto"
    cityEl.appendChild(placeholder)

    citiesCache.forEach((city) => {
      const c = String(city || "").trim()
      if (!c) return

      const opt = document.createElement("option")
      opt.value = c
      opt.innerHTML = escapeHtml(c)
      cityEl.appendChild(opt)
    })
  }

  const setLockerOptions = (lockers) => {
    const list = normalizeLockersResponse(lockers)

    lockerEl.replaceChildren()

    const placeholder = document.createElement("option")
    placeholder.value = ""
    placeholder.disabled = true
    placeholder.selected = true
    placeholder.textContent = list.length ? "Wybierz automat" : "Brak automatów w tym mieście"
    lockerEl.appendChild(placeholder)

    list.forEach((automat) => {
      const id = getLockerId(automat)
      if (!id) return

      const opt = document.createElement("option")
      opt.value = String(id)
      opt.innerHTML = escapeHtml(buildLockerLabel(automat))
      lockerEl.appendChild(opt)
    })
  }

  const loadLockers = async () => {
    if (lockersLoaded) return

    const miasto = String(cityEl.value || "").trim()

    if (!miasto) {
      setLockerOptions([])
      return
    }

    const automaty = await loadLockersInCity(miasto)
    setLockerOptions(automaty)
    lockersLoaded = true
  }

  const getPackageDims = () => {
    const w = toNumber(widthEl.value)
    const h = toNumber(heightEl.value)
    const d = toNumber(depthEl.value)

    if (!w || !h || !d) return null
    if (w <= 0 || h <= 0 || d <= 0) return null

    return [w, h, d]
  }

  const updateSizeSuggestion = () => {
    const dims = getPackageDims()

    if (!dims) {
      sizeHintEl.textContent = ""
      sizeEl.value = ""
      return
    }

    const chosen = pickSmallestFittingSize(dims)

    if (!chosen) {
      sizeHintEl.textContent = "Proponowany rozmiar: brak (paczka za duża)"
      sizeEl.value = ""
      return
    }

    sizeHintEl.textContent = `Proponowany rozmiar: ${chosen.label}`
    sizeEl.value = chosen.key
  }

  const createPackage = async ({ recipientEmail, lockerId, szerokosc_cm, wysokosc_cm, glebokosc_cm }) => {
    const payload = {
      automat_id: Number(lockerId),
      szerokosc_cm,
      wysokosc_cm,
      glebokosc_cm,
      odbiorca: { email: recipientEmail }
    }

    const res =
      (await apiFetch("/me/paczki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(() => null)) ||
      (await apiFetch("/paczki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(() => null))

    if (!res) return { ok: false, error: "Brak połączenia z API." }

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      return { ok: false, error: data?.error || `Błąd nadawania paczki (${res.status})` }
    }

    return { ok: true, data }
  }

  const onCityChange = async () => {
    lockersLoaded = false
    setLockerOptions([])
    await loadLockers()
  }

  const onNavClick = async () => {
    setFormDisabled(false)
    await setCityOptions()
    updateSizeSuggestion()
  }

  const onSubmit = async (e) => {
    e.preventDefault()

    const recipientEmail = String(emailEl.value || "").trim()
    const lockerId = String(lockerEl.value || "").trim()

    const dims = getPackageDims()
    if (!dims) return

    const [szerokosc_cm, wysokosc_cm, glebokosc_cm] = dims

    if (!recipientEmail || !lockerId) return

    setFormDisabled(true)
    displayMessageForSeconds("Nadawanie paczki...", 2, "db-message")

    try {
      const result = await createPackage({
        recipientEmail,
        lockerId,
        szerokosc_cm,
        wysokosc_cm,
        glebokosc_cm
      })

      console.log("createPackage result:", result)

      if (!result.ok) {
        alert(result.error || "Nie udało się nadać paczki.")
        setFormDisabled(false)
        return
      }

      alert("Paczka została nadana.")
      formEl.reset()



      lockersLoaded = false
      setLockerOptions([])

      sizeHintEl.textContent = ""
      sizeEl.value = ""

      setFormDisabled(false)
    } catch (err) {
      alert(err?.message || "Nie udało się nadać paczki.")
      setFormDisabled(false)
    }
  }

  if (widthEl.dataset.bound !== "1") {
    widthEl.dataset.bound = "1"
    widthEl.addEventListener("input", updateSizeSuggestion)
  }

  if (heightEl.dataset.bound !== "1") {
    heightEl.dataset.bound = "1"
    heightEl.addEventListener("input", updateSizeSuggestion)
  }

  if (depthEl.dataset.bound !== "1") {
    depthEl.dataset.bound = "1"
    depthEl.addEventListener("input", updateSizeSuggestion)
  }

  if (navBtn.dataset.bound !== "1") {
    navBtn.dataset.bound = "1"
    navBtn.addEventListener("click", onNavClick)
  }

  if (cityEl.dataset.bound !== "1") {
    cityEl.dataset.bound = "1"
    cityEl.addEventListener("change", onCityChange)
  }

  if (formEl.dataset.bound !== "1") {
    formEl.dataset.bound = "1"
    formEl.addEventListener("submit", onSubmit)
  }
}
