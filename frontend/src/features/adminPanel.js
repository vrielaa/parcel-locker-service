import { getElById } from "../utils.js"
import { apiFetch } from "../api.js"

const SELECTORS = {
  navAdminUsersId: "nav-admin-users",

  adminUsersViewId: "admin-users-view",
  adminClientViewId: "admin-client-view",

  btnRefreshId: "admin-users-btn-refresh",
  btnAddClientId: "admin-users-btn-add-client",
  btnAddCourierId: "admin-users-btn-add-courier",
  btnAddOperatorId: "admin-users-btn-add-operator",
  btnAddAdminId: "admin-users-btn-add-admin",

  formBoxId: "admin-users-form-box",
  formTitleId: "admin-users-form-title",
  formId: "admin-users-form",
  formRoleId: "admin-users-form-role",
  formCancelId: "admin-users-form-cancel",

  firstNameId: "admin-users-first-name",
  lastNameId: "admin-users-last-name",
  emailId: "admin-users-email",
  phoneId: "admin-users-phone",
  passwordId: "admin-users-password",

  listsBoxId: "admin-users-lists",

  listClientsId: "admin-users-list-clients",
  listOperatorsId: "admin-users-list-operators",
  listCouriersId: "admin-users-list-couriers",
  listAdminsId: "admin-users-list-admins",

  clientBackId: "admin-client-back",
  clientTitleId: "admin-client-title",
  clientTabSentId: "admin-client-tab-sent",
  clientTabReceivedId: "admin-client-tab-received",
  clientPackagesId: "admin-client-packages"
}

const escapeHtml = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")

const show = (el) => el && el.classList.remove("hidden")
const hide = (el) => el && el.classList.add("hidden")

const roleKey = (role) => String(role || "").toUpperCase().trim()

const getApiErrorMessage = (res, data, fallback) => {
  const msg = data?.error || data?.message || data?.details || fallback || "Błąd"
  if (res?.status === 409) return msg
  return msg
}

const buildUserLabel = (u) => {
  const email = u?.email ? String(u.email) : "-"
  const must = u?.must_change_password ? "must change password" : ""

  const nameK =
    u?.klient_imie || u?.klient_nazwisko
      ? `${u?.klient_imie || ""} ${u?.klient_nazwisko || ""}`.trim()
      : ""

  const nameP =
    u?.pracownik_imie || u?.pracownik_nazwisko
      ? `${u?.pracownik_imie || ""} ${u?.pracownik_nazwisko || ""}`.trim()
      : ""

  const name = nameK || nameP
  const left = name ? `${name} — ${email}` : email

  return must ? `${left} (${must})` : left
}

const userRowHtml = (u) => {
  const appUserId = u?.app_user_id
  const role = roleKey(u?.rola)
  const clientId = u?.klient_id
  const label = escapeHtml(buildUserLabel(u))

  const detailsBtn =
    role === "KLIENT" && clientId
      ? `<button class="btn btn--small" type="button" data-action="details" data-client-id="${String(clientId)}">Pokaż</button>`
      : ""

  return `
    <div class="admin-users__row" data-app-user-id="${String(appUserId)}">
      <div class="admin-users__row-label">${label}</div>
      <div class="admin-users__row-actions">
        ${detailsBtn}
        <button class="btn btn--small" type="button" data-action="delete" data-app-user-id="${String(appUserId)}">Usuń</button>
      </div>
    </div>
  `
}

const packageRowHtml = (p) => {
  const id = p?.paczka_id
  const tracking = escapeHtml(p?.numer_tracking || "-")
  const status = escapeHtml(String(p?.status || "").replaceAll("_", " "))
  const parcelLocker = escapeHtml(p?.docelowy_automat_label || "")
  const inLocker = String(p?.status || "").toUpperCase() === "W_AUTOMACIE"

  const pickupBtn = inLocker
    ? `<button class="btn btn--small" type="button" data-action="pickup" data-package-id="${String(id)}">Symuluj odebranie</button>`
    : ""

  return `
    <div class="admin-client__row">
      <div class="admin-client__row-main">
        <div><strong>${tracking}</strong></div>
        <div>${status}</div>
        <div>${parcelLocker}</div>
      </div>
      <div class="admin-client__row-actions">
        ${pickupBtn}
      </div>
    </div>
  `
}

export function initAdminUsersView() {
  const navBtn = getElById(SELECTORS.navAdminUsersId)

  const adminUsersView = getElById(SELECTORS.adminUsersViewId)
  const adminClientView = getElById(SELECTORS.adminClientViewId)

  const btnRefresh = getElById(SELECTORS.btnRefreshId)
  const btnAddClient = getElById(SELECTORS.btnAddClientId)
  const btnAddCourier = getElById(SELECTORS.btnAddCourierId)
  const btnAddOperator = getElById(SELECTORS.btnAddOperatorId)
  const btnAddAdmin = getElById(SELECTORS.btnAddAdminId)

  const formBox = getElById(SELECTORS.formBoxId)
  const formTitle = getElById(SELECTORS.formTitleId)
  const formEl = getElById(SELECTORS.formId)
  const formRole = getElById(SELECTORS.formRoleId)
  const formCancel = getElById(SELECTORS.formCancelId)

  const firstNameEl = getElById(SELECTORS.firstNameId)
  const lastNameEl = getElById(SELECTORS.lastNameId)
  const emailEl = getElById(SELECTORS.emailId)
  const phoneEl = getElById(SELECTORS.phoneId)
  const passwordEl = getElById(SELECTORS.passwordId)

  const listsBox = getElById(SELECTORS.listsBoxId)

  const listClients = getElById(SELECTORS.listClientsId)
  const listOperators = getElById(SELECTORS.listOperatorsId)
  const listCouriers = getElById(SELECTORS.listCouriersId)
  const listAdmins = getElById(SELECTORS.listAdminsId)

  const clientBack = getElById(SELECTORS.clientBackId)
  const clientTitle = getElById(SELECTORS.clientTitleId)
  const tabSent = getElById(SELECTORS.clientTabSentId)
  const tabReceived = getElById(SELECTORS.clientTabReceivedId)
  const clientPackages = getElById(SELECTORS.clientPackagesId)

  const actionsBox = adminUsersView ? adminUsersView.querySelector(".admin-users__actions") : null

  if (
    !navBtn ||
    !adminUsersView ||
    !adminClientView ||
    !btnRefresh ||
    !btnAddClient ||
    !btnAddCourier ||
    !btnAddOperator ||
    !btnAddAdmin ||
    !formBox ||
    !formTitle ||
    !formEl ||
    !formRole ||
    !formCancel ||
    !firstNameEl ||
    !lastNameEl ||
    !emailEl ||
    !phoneEl ||
    !passwordEl ||
    !listsBox ||
    !listClients ||
    !listOperators ||
    !listCouriers ||
    !listAdmins ||
    !clientBack ||
    !clientTitle ||
    !tabSent ||
    !tabReceived ||
    !clientPackages ||
    !actionsBox
  )
    return

  let usersCache = []
  let currentClientId = null
  let currentClientMode = "sent"

  let backToMenuBtn = adminUsersView.querySelector("#admin-users-back-menu")

  if (!backToMenuBtn) {
    backToMenuBtn = document.createElement("button")
    backToMenuBtn.className = "btn hidden"
    backToMenuBtn.id = "admin-users-back-menu"
    backToMenuBtn.type = "button"
    backToMenuBtn.textContent = "← Wróć do zarządzania użytkownikami"
    adminUsersView.prepend(backToMenuBtn)
  }

  const showMenuState = () => {
    show(adminUsersView)
    hide(adminClientView)

    show(actionsBox)

    hide(formBox)
    hide(listsBox)

    hide(backToMenuBtn)
  }

  const showListState = () => {
    show(adminUsersView)
    hide(adminClientView)

    hide(actionsBox)

    hide(formBox)
    show(listsBox)

    show(backToMenuBtn)
  }

  const showFormState = () => {
    show(adminUsersView)
    hide(adminClientView)

    hide(actionsBox)

    hide(listsBox)
    show(formBox)

    show(backToMenuBtn)
  }

  const showClientState = () => {
    hide(adminUsersView)
    show(adminClientView)
  }

  const openCreateForm = (role) => {
    formRole.value = role
    formTitle.textContent =
      role === "KLIENT"
        ? "Dodaj klienta"
        : role === "KURIER"
        ? "Dodaj kuriera"
        : role === "OPERATOR"
        ? "Dodaj operatora"
        : "Dodaj admina"

    firstNameEl.value = ""
    lastNameEl.value = ""
    emailEl.value = ""
    phoneEl.value = ""
    passwordEl.value = ""
  }

  const closeCreateForm = () => {
    hide(formBox)
    formRole.value = ""
  }

  const renderUsers = (users) => {
    const clients = []
    const operators = []
    const couriers = []
    const admins = []

    users.forEach((u) => {
      const r = roleKey(u?.rola)
      if (r === "KLIENT") clients.push(u)
      else if (r === "OPERATOR") operators.push(u)
      else if (r === "KURIER") couriers.push(u)
      else if (r === "ADMIN") admins.push(u)
    })

    listClients.innerHTML = clients.map(userRowHtml).join("") || "<div class=\"no-users-message\">Brak</div>"
    listOperators.innerHTML = operators.map(userRowHtml).join("") || "<div class=\"no-users-message\">Brak</div>"
    listCouriers.innerHTML = couriers.map(userRowHtml).join("") || "<div class=\"no-users-message\">Brak</div>"
    listAdmins.innerHTML = admins.map(userRowHtml).join("") || "<div class=\"no-users-message\">Brak</div>"
  }

  const fetchUsers = async () => {
    const res = await apiFetch("/admin/users")
    const data = await res.json().catch(() => null)

    if (!res.ok) throw new Error(getApiErrorMessage(res, data, "Nie udało się pobrać użytkowników."))

    usersCache = Array.isArray(data?.users) ? data.users : []
    renderUsers(usersCache)
  }

  const deleteUser = async (appUserId) => {
    const res = await apiFetch(`/admin/users/${encodeURIComponent(appUserId)}`, { method: "DELETE" })
    const data = await res.json().catch(() => null)

    if (!res.ok) {
      throw new Error(getApiErrorMessage(res, data, "Nie udało się usunąć użytkownika."))
    }

    await fetchUsers()
  }

  const createUser = async ({ role, firstName, lastName, email, phone, password }) => {
    const res = await apiFetch("/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, imie: firstName, nazwisko: lastName, email, telefon: phone, password })
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) throw new Error(getApiErrorMessage(res, data, "Nie udało się utworzyć użytkownika."))

    await fetchUsers()
  }

  const fetchClientPackages = async (clientId, mode) => {
    const res = await apiFetch(`/admin/clients/${encodeURIComponent(clientId)}/paczki?mode=${encodeURIComponent(mode)}`)
    const data = await res.json().catch(() => null)

    if (!res.ok) throw new Error(getApiErrorMessage(res, data, "Nie udało się pobrać paczek klienta."))

    const client = data?.client || null
    const packages = Array.isArray(data?.paczki) ? data.paczki : []

    clientTitle.textContent = client?.email ? `Klient: ${client.email}` : `Klient ID: ${clientId}`

    tabSent.classList.toggle("isActive", mode === "sent")
    tabReceived.classList.toggle("isActive", mode === "received")

    clientPackages.innerHTML = packages.map(packageRowHtml).join("") || "<div>Brak paczek</div>"
  }

  const simulatePickup = async (packageId) => {
    const res = await apiFetch(`/admin/paczki/${encodeURIComponent(packageId)}/simulate-pickup`, { method: "POST" })
    const data = await res.json().catch(() => null)

    if (!res.ok) throw new Error(getApiErrorMessage(res, data, "Nie udało się zasymulować odbioru."))

    if (currentClientId) await fetchClientPackages(currentClientId, currentClientMode)
  }

  const onUsersClick = async (e) => {
    const btn = e.target?.closest("button[data-action]")
    if (!btn) return

    const action = btn.getAttribute("data-action")

    if (action === "delete") {
      const appUserId = btn.getAttribute("data-app-user-id")
      if (!appUserId) return

      const ok = confirm("Na pewno usunąć użytkownika?")
      if (!ok) return

      try {
        await deleteUser(appUserId)
      } catch (err) {
        alert(err?.message || "Delete failed")
      }

      return
    }

    if (action === "details") {
      const clientId = btn.getAttribute("data-client-id")
      if (!clientId) return

      currentClientId = clientId
      currentClientMode = "sent"

      showClientState()

      try {
        await fetchClientPackages(currentClientId, currentClientMode)
      } catch (err) {
        alert(err?.message || "Load client failed")
      }

      return
    }
  }

  const onClientClick = async (e) => {
    const btn = e.target?.closest("button[data-action]")
    if (!btn) return

    const action = btn.getAttribute("data-action")

    if (action === "pickup") {
      const packageId = btn.getAttribute("data-package-id")
      if (!packageId) return

      const ok = confirm("Symulować odebranie paczki?")
      if (!ok) return

      try {
        await simulatePickup(packageId)
      } catch (err) {
        alert(err?.message || "Pickup failed")
      }
    }
  }

  const onFormSubmit = async (e) => {
    e.preventDefault()

    const role = roleKey(formRole.value)
    const firstName = String(firstNameEl.value || "").trim()
    const lastName = String(lastNameEl.value || "").trim()
    const email = String(emailEl.value || "").trim()
    const phone = String(phoneEl.value || "").trim()
    const password = String(passwordEl.value || "").trim()

    if (!role || !firstName || !lastName || !email || !password) return

    try {
      await createUser({ role, firstName, lastName, email, phone, password })

      closeCreateForm()
      showListState()
    } catch (err) {
      alert(err?.message || "Create failed")
    }
  }

  const onNavClick = () => {
    currentClientId = null
    currentClientMode = "sent"
    closeCreateForm()
    showMenuState()
  }

  if (navBtn.dataset.bound !== "1") {
    navBtn.dataset.bound = "1"
    navBtn.addEventListener("click", onNavClick)
  }

  if (backToMenuBtn.dataset.bound !== "1") {
    backToMenuBtn.dataset.bound = "1"
    backToMenuBtn.addEventListener("click", () => {
      currentClientId = null
      currentClientMode = "sent"
      closeCreateForm()
      showMenuState()
    })
  }

  if (btnRefresh.dataset.bound !== "1") {
    btnRefresh.dataset.bound = "1"
    btnRefresh.addEventListener("click", async () => {
      showListState()

      try {
        await fetchUsers()
      } catch (err) {
        alert(err?.message || "Load users failed")
      }
    })
  }

  if (btnAddClient.dataset.bound !== "1") {
    btnAddClient.dataset.bound = "1"
    btnAddClient.addEventListener("click", () => {
      openCreateForm("KLIENT")
      showFormState()
    })
  }

  if (btnAddCourier.dataset.bound !== "1") {
    btnAddCourier.dataset.bound = "1"
    btnAddCourier.addEventListener("click", () => {
      openCreateForm("KURIER")
      showFormState()
    })
  }

  if (btnAddOperator.dataset.bound !== "1") {
    btnAddOperator.dataset.bound = "1"
    btnAddOperator.addEventListener("click", () => {
      openCreateForm("OPERATOR")
      showFormState()
    })
  }

  if (btnAddAdmin.dataset.bound !== "1") {
    btnAddAdmin.dataset.bound = "1"
    btnAddAdmin.addEventListener("click", () => {
      openCreateForm("ADMIN")
      showFormState()
    })
  }

  if (formCancel.dataset.bound !== "1") {
    formCancel.dataset.bound = "1"
    formCancel.addEventListener("click", () => {
      closeCreateForm()
      showMenuState()
    })
  }

  if (formEl.dataset.bound !== "1") {
    formEl.dataset.bound = "1"
    formEl.addEventListener("submit", onFormSubmit)
  }

  if (adminUsersView.dataset.bound !== "1") {
    adminUsersView.dataset.bound = "1"
    adminUsersView.addEventListener("click", onUsersClick)
  }

  if (clientBack.dataset.bound !== "1") {
    clientBack.dataset.bound = "1"
    clientBack.addEventListener("click", () => {
      currentClientId = null
      currentClientMode = "sent"
      showListState()
    })
  }

  if (tabSent.dataset.bound !== "1") {
    tabSent.dataset.bound = "1"
    tabSent.addEventListener("click", async () => {
      if (!currentClientId) return
      currentClientMode = "sent"

      try {
        await fetchClientPackages(currentClientId, currentClientMode)
      } catch (err) {
        alert(err?.message || "Load packages failed")
      }
    })
  }

  if (tabReceived.dataset.bound !== "1") {
    tabReceived.dataset.bound = "1"
    tabReceived.addEventListener("click", async () => {
      if (!currentClientId) return
      currentClientMode = "received"

      try {
        await fetchClientPackages(currentClientId, currentClientMode)
      } catch (err) {
        alert(err?.message || "Load packages failed")
      }
    })
  }

  if (adminClientView.dataset.bound !== "1") {
    adminClientView.dataset.bound = "1"
    adminClientView.addEventListener("click", onClientClick)
  }

  showMenuState()
}
