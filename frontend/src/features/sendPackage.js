// sendPackage.js
import { getElById } from "../utils.js"
import { displayMessageForSeconds } from "../messages.js"
import { apiFetch, API_BASE } from "../api.js"

const SELECTORS = {
  navBtnId: "nav-create-package",
  formId: "create-package-form",
  recipientEmailId: "recipient-email",
  lockerSelectId: "locker-select",
  lockerSearchId: "locker-search",
  lockerDatalistId: "locker-suggestions",
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

const normalizeText = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ")

const getLockerId = (parcelLocker) => parcelLocker?.automat_id ?? parcelLocker?.id ?? parcelLocker?.automatId ?? null
const getLockerName = (parcelLocker) => parcelLocker?.nazwa ?? parcelLocker?.name ?? parcelLocker?.automat_nazwa ?? parcelLocker?.automatNazwa ?? "-"
const getLockerAddress = (parcelLocker) => parcelLocker?.adres ?? parcelLocker?.address ?? parcelLocker?.automat_adres ?? parcelLocker?.automatAdres ?? ""
const getLockerCity = (parcelLocker) => parcelLocker?.miasto ?? parcelLocker?.city ?? parcelLocker?.automat_miasto ?? parcelLocker?.automatMiasto ?? ""

const buildLockerLabel = (parcelLocker) => {
  const name = getLockerName(parcelLocker)
  const addr = getLockerAddress(parcelLocker)
  const city = getLockerCity(parcelLocker)

  const suffix = addr ? addr : city ? city : ""
  return suffix ? `${name} — ${suffix}` : name
}

const normalizeLockersResponse = (data) => {
  const list = data?.automaty ?? data?.lockers ?? data?.rows ?? data
  return Array.isArray(list) ? list : []
}

const loadCities = async () => {
  try {
    const res = await fetch(`${API_BASE}/miasta`)
    const cities = await res.json()

    cities.forEach((city) => {
      const c = String(city || "").trim()
      if (c && !citiesCache.includes(c)) citiesCache.push(c)
    })

    return citiesCache
  } catch (err) {
    displayMessageForSeconds("Błąd: " + err.message, 5, "db-message")
    return []
  }
}

const loadLockersInCity = async (city) => {
  try {
    const res = await apiFetch(`/automaty?miasto=${encodeURIComponent(city)}`)
    const parcelLockers = await res.json()
    return parcelLockers
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

const SIZE_ORDER = {
  small: 0,
  medium: 1,
  large: 2
}

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

const getSizeByKey = (key) => SIZES.find((s) => s.key === key) || null

export function initSendPackageView() {
  const navBtn = getElById(SELECTORS.navBtnId)
  const formEl = getElById(SELECTORS.formId)
  const emailEl = getElById(SELECTORS.recipientEmailId)

  const cityEl = getElById(SELECTORS.citySelectId)
  const lockerEl = getElById(SELECTORS.lockerSelectId)

  const lockerSearchEl = getElById(SELECTORS.lockerSearchId)
  const lockerDatalistEl = getElById(SELECTORS.lockerDatalistId)

  const widthEl = getElById(SELECTORS.packageWidthId)
  const heightEl = getElById(SELECTORS.packageHeightId)
  const depthEl = getElById(SELECTORS.packageDepthId)

  const sizeEl = getElById(SELECTORS.packageSizeId)
  const sizeHintEl = getElById(SELECTORS.packageSizeHintId)

  if (!navBtn || !formEl || !emailEl || !cityEl || !lockerEl || !widthEl || !heightEl || !depthEl || !sizeEl || !sizeHintEl) return

  let lockersLoaded = false
  let lockerIndex = []
  let citiesIndex = []
  let lockersLoadToken = 0
  let switchingCity = false

  const setFormDisabled = (disabled) => {
    emailEl.disabled = disabled
    cityEl.disabled = disabled
    lockerEl.disabled = disabled
    widthEl.disabled = disabled
    heightEl.disabled = disabled
    depthEl.disabled = disabled
    sizeEl.disabled = disabled

    if (lockerSearchEl) lockerSearchEl.disabled = disabled

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

    citiesIndex = citiesCache
      .map((c) => ({ city: c, norm: normalizeText(c) }))
      .filter((x) => x.norm)
      .sort((a, b) => b.norm.length - a.norm.length)
  }

  const detectCityFromText = (text) => {
    const q = normalizeText(text)
    if (!q) return ""

    const hit = citiesIndex.find((c) => q.includes(c.norm))
    return hit ? hit.city : ""
  }

  const resolveLockerIdFromText = (text) => {
    const raw = String(text || "").trim()
    if (!raw) return ""

    const q = normalizeText(raw)
    if (!q) return ""

    const exactName = lockerIndex.find((x) => x.nameNorm === q)
    if (exactName) return exactName.id

    const exactLabel = lockerIndex.find((x) => x.labelNorm === q)
    if (exactLabel) return exactLabel.id

    const tokens = q.split(" ").filter(Boolean)
    if (!tokens.length) return ""

    const tokenHit = lockerIndex.find((x) => tokens.every((t) => x.searchable.includes(t)))
    if (tokenHit) return tokenHit.id

    return ""
  }

  const applyMinSizeLock = (minKey) => {
    const min = String(minKey || "").trim()

    Array.from(sizeEl.options).forEach((opt) => {
      const k = String(opt.value || "").trim()
      if (!(k in SIZE_ORDER)) return

      if (!min) {
        opt.disabled = false
        return
      }

      if (!(min in SIZE_ORDER)) {
        opt.disabled = true
        return
      }

      opt.disabled = SIZE_ORDER[k] < SIZE_ORDER[min]
    })
  }

  const setLockerOptions = (lockers) => {
    const list = normalizeLockersResponse(lockers)

    lockerIndex = list
      .map((parcelLocker) => {
        const id = getLockerId(parcelLocker)
        if (!id) return null

        const name = String(getLockerName(parcelLocker) || "").trim()
        const city = String(getLockerCity(parcelLocker) || "").trim()
        const addr = String(getLockerAddress(parcelLocker) || "").trim()
        const label = buildLockerLabel(parcelLocker)

        return {
          id: String(id),
          name,
          city,
          addr,
          label,
          nameNorm: normalizeText(name),
          labelNorm: normalizeText(label),
          searchable: normalizeText(`${name} ${city} ${addr} ${label}`)
        }
      })
      .filter(Boolean)

    lockerEl.replaceChildren()

    const placeholder = document.createElement("option")
    placeholder.value = ""
    placeholder.disabled = true
    placeholder.selected = true
    placeholder.textContent = lockerIndex.length ? "Wybierz automat" : "Brak automatów w tym mieście"
    lockerEl.appendChild(placeholder)

    lockerIndex.forEach((a) => {
      const opt = document.createElement("option")
      opt.value = a.id
      opt.innerHTML = escapeHtml(a.label)
      lockerEl.appendChild(opt)
    })

    if (lockerDatalistEl) {
      lockerDatalistEl.replaceChildren()

      lockerIndex.forEach((a) => {
        if (a.name) {
          const optName = document.createElement("option")
          optName.value = a.name
          lockerDatalistEl.appendChild(optName)
        }

        if (a.addr) {
          const optAddr = document.createElement("option")
          optAddr.value = a.addr
          lockerDatalistEl.appendChild(optAddr)
        }

        const optLabel = document.createElement("option")
        optLabel.value = a.label
        lockerDatalistEl.appendChild(optLabel)
      })
    }
  }

  const loadLockers = async () => {
    const token = ++lockersLoadToken

    if (lockersLoaded) return

    const city = String(cityEl.value || "").trim()

    if (!city) {
      setLockerOptions([])
      return
    }

    const parcelLockers = await loadLockersInCity(city)

    if (token !== lockersLoadToken) return

    setLockerOptions(parcelLockers)
    lockersLoaded = true
  }

  const maybeSwitchCityFromSearch = async () => {
    if (!lockerSearchEl) return false

    const q = lockerSearchEl.value
    const detectedCity = detectCityFromText(q)

    if (!detectedCity) return false
    if (String(cityEl.value || "").trim() === detectedCity) return false
    if (switchingCity) return false

    switchingCity = true

    cityEl.value = detectedCity
    lockersLoaded = false
    setLockerOptions([])

    await loadLockers()

    switchingCity = false

    return true
  }

  const syncLockerSelectFromSearch = async () => {
    if (!lockerSearchEl) return

    await maybeSwitchCityFromSearch()

    const id = resolveLockerIdFromText(lockerSearchEl.value)
    if (!id) return

    lockerEl.value = id
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
      applyMinSizeLock("")
      return
    }

    const chosen = pickSmallestFittingSize(dims)

    if (!chosen) {
      sizeHintEl.textContent = "Proponowany rozmiar: brak (paczka za duża)"
      sizeEl.value = ""
      applyMinSizeLock("__none__")
      return
    }

    sizeHintEl.textContent = `Proponowany rozmiar: ${chosen.label}`

    applyMinSizeLock(chosen.key)

    const current = String(sizeEl.value || "").trim()
    const currRank = current in SIZE_ORDER ? SIZE_ORDER[current] : -1
    const minRank = chosen.key in SIZE_ORDER ? SIZE_ORDER[chosen.key] : -1

    if (!current || currRank < minRank) {
      sizeEl.value = chosen.key
    }
  }

  const createPackage = async ({ recipientEmail, lockerId, widthCm, heightCm, depthCm }) => {
    const payload = {
      automat_id: Number(lockerId),
      szerokosc_cm: widthCm,
      wysokosc_cm: heightCm,
      glebokosc_cm: depthCm,
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
    if (lockerSearchEl) await syncLockerSelectFromSearch()
  }

  const onNavClick = async () => {
    setFormDisabled(false)
    await setCityOptions()
    updateSizeSuggestion()
  }

  const onSubmit = async (e) => {
    e.preventDefault()

    const recipientEmail = String(emailEl.value || "").trim()

    if (lockerSearchEl) await syncLockerSelectFromSearch()

    const lockerId =
      String(lockerEl.value || "").trim() ||
      (lockerSearchEl ? resolveLockerIdFromText(lockerSearchEl.value) : "")

    const dims = getPackageDims()
    if (!dims) return

    const [widthCm, heightCm, depthCm] = dims

    if (!recipientEmail || !lockerId) return

    const min = pickSmallestFittingSize(dims)
    if (!min) {
      alert("Ta paczka jest za duża. Nie mieści się w żadnym rozmiarze skrytki.")
      return
    }

    const selected = String(sizeEl.value || "").trim()
    const selectedRank = selected in SIZE_ORDER ? SIZE_ORDER[selected] : -1
    const minRank = min.key in SIZE_ORDER ? SIZE_ORDER[min.key] : -1

    if (selectedRank < minRank) {
      alert("Wybrany rozmiar jest za mały dla podanych wymiarów. Wybierz rozmiar proponowany lub większy.")
      sizeEl.value = min.key
      applyMinSizeLock(min.key)
      return
    }

    setFormDisabled(true)

    try {
      const result = await createPackage({
        recipientEmail,
        lockerId,
        widthCm,
        heightCm,
        depthCm
      })

      if (!result.ok) {
        alert(result.error || "Nie udało się nadać paczki.")
        setFormDisabled(false)
        return
      }

      alert("Paczka została nadana.")
      formEl.reset()

      lockersLoaded = false
      setLockerOptions([])

      if (lockerSearchEl) lockerSearchEl.value = ""

      sizeHintEl.textContent = ""
      sizeEl.value = ""
      applyMinSizeLock("")

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

  if (sizeEl.dataset.bound !== "1") {
    sizeEl.dataset.bound = "1"
    sizeEl.addEventListener("change", updateSizeSuggestion)
  }

  if (lockerSearchEl && lockerSearchEl.dataset.bound !== "1") {
    lockerSearchEl.dataset.bound = "1"
    lockerSearchEl.addEventListener("input", () => void syncLockerSelectFromSearch())
    lockerSearchEl.addEventListener("change", () => void syncLockerSelectFromSearch())
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
