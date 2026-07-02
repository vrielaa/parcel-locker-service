import "../sass/main.scss"
import { initParcelLockersView } from "./features/parcelLockers.js"
import { initPackagesView } from "./features/packages.js"
import { initCourierPanel } from "./features/courier.js"
import { initSendPackageView } from "./features/sendPackage.js"
import { initOperatorPanel } from "./features/operatorPanel.js"
import { initDatabaseAdminControls } from "./features/databaseAdmin.js"
import { initAdminUsersView } from "./features/adminPanel.js"
import { initAdminParcelLockersPanel } from "./features/adminParcelLockers.js"
import { initCourierReport } from "./features/courierReport.js"
import { initLogout } from "./features/logout.js"
import { addClass, removeClass, getElById } from "./utils.js"
import { apiFetch, clearToken } from "./api.js"

async function main() {
  const logoutBtn = getElById("logout-button")
  const changePasswordBtn = getElById("change-password-button")

  const goLogin = () => {
    window.location.href = "/login.html"
  }

  if (changePasswordBtn) {
    changePasswordBtn.addEventListener("click", () => {
      window.location.href = "/change-password.html"
    })
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearToken()
      goLogin()
    })
  }

  const token = localStorage.getItem("token")
  if (!token) {
    goLogin()
    return
  }

  let me = null
  let authErr = null

  try {
    const resMe = await apiFetch("/auth/me", { method: "GET" })
    me = await resMe.json().catch(() => null)
  } catch (err) {
    authErr = err
    me = null
  }

  if (!me?.ok || !me?.user) {
    if (authErr?.status === 401 || authErr?.message === "AUTH_REQUIRED") {
      clearToken()
    }
    goLogin()
    return
  }

  if (me.user.must_change_password) {
    window.location.href = "/change-password.html"
    return
  }

  const role = String(me.user.role || me.user.rola || "").toUpperCase()
  localStorage.setItem("rola", role)
  const showDevTools = localStorage.getItem("showDevTools") === "true"

  

  const myAccountEmailEl = getElById("account-button");


  if (myAccountEmailEl) {
    myAccountEmailEl.textContent = me.user.email;
    
  }

  document.querySelectorAll("[data-roles]:not([data-view])").forEach((el) => {
    const allowed = (el.getAttribute("data-roles") || "")
      .split(",")
      .map((r) => r.trim().toUpperCase())
      .filter(Boolean)

    if (allowed.length === 0) return

    if (allowed.includes(role)) {
      removeClass(el, "hidden")
    } else {
      addClass(el, "hidden")
    }
  })

  document.querySelectorAll("[data-dev='true']").forEach((el) => {
    if (!showDevTools) addClass(el, "hidden")
  })

  const parcelLockersButton = getElById("get-automaty")
  // if (parcelLockersButton) removeClass(parcelLockersButton, "hidden")

  const views = Array.from(document.querySelectorAll("[data-view]"))

  const canSeeView = (el, role) => {
    const allowed = (el.getAttribute("data-roles") || "")
      .split(",")
      .map((r) => r.trim().toUpperCase())
      .filter(Boolean)

    if (allowed.length === 0) return true
    return allowed.includes(role)
  }

  const hideAllViews = () => {
    views.forEach((v) => addClass(v, "hidden"))
  }

  const showView = (viewId) => {
    const el = getElById(viewId)
    if (!el) return
    if (!canSeeView(el, role)) return
    hideAllViews()
    removeClass(el, "hidden")
  }

  const btnMyPackages = getElById("nav-my-packages")
  const btnCourierPackages = getElById("nav-courier-packages")
  const btnOperatorPanel = getElById("nav-operator-panel")
  const createPackageBtn = getElById("nav-create-package")
  const btnAdminUsers = getElById("nav-admin-users")
  const adminParcelLockersButton = getElById("nav-admin-automaty")
  const courierReportButton = getElById("nav-courier-report")

  if (parcelLockersButton) parcelLockersButton.addEventListener("click", () => showView("view-automaty"))
  if (btnMyPackages) btnMyPackages.addEventListener("click", () => showView("view-klient"))
  if (btnCourierPackages) btnCourierPackages.addEventListener("click", () => showView("view-kurier"))
  if (btnOperatorPanel) btnOperatorPanel.addEventListener("click", () => showView("view-operator"))
  if (createPackageBtn) createPackageBtn.addEventListener("click", () => showView("view-create-package"))
  if (courierReportButton) courierReportButton.addEventListener("click", () => showView("view-report-problem"))

  if (btnAdminUsers) {
    btnAdminUsers.addEventListener("click", () => {
      showView("view_admin")

      const usersViewEl = getElById("admin-users-view")
      const adminParcelLockersViewEl = getElById("admin-automaty-view")
      const clientViewEl = getElById("admin-client-view")

      if (usersViewEl) removeClass(usersViewEl, "hidden")
      if (adminParcelLockersViewEl) addClass(adminParcelLockersViewEl, "hidden")
      if (clientViewEl) addClass(clientViewEl, "hidden")
    })
  }

  if (adminParcelLockersButton) {
    adminParcelLockersButton.addEventListener("click", () => {
      showView("view_admin")

      const usersViewEl = getElById("admin-users-view")
      const adminParcelLockersViewEl = getElById("admin-automaty-view")
      const clientViewEl = getElById("admin-client-view")

      if (usersViewEl) addClass(usersViewEl, "hidden")
      if (clientViewEl) addClass(clientViewEl, "hidden")
      if (adminParcelLockersViewEl) removeClass(adminParcelLockersViewEl, "hidden")
    })
  }

  initParcelLockersView()
  initDatabaseAdminControls()
  initLogout()
  initPackagesView()
  initCourierPanel()
  initCourierReport()
  initSendPackageView()
  initOperatorPanel()
  initAdminUsersView()
  initAdminParcelLockersPanel()
}

main()
