import "../sass/main.scss"
import { initAutomatsView } from "./features/automat.js"
import { initPackagesView } from "./features/paczki.js"
import { initKurierPanel } from "./features/kurier.js"
import { initSendPackageView } from "./features/sendPackage.js"
import { initOperatorPanel } from "./features/operatorPanel.js"
import { initDbAdminControls } from "./features/dbAdmin.js"
import { initLogout } from "./features/logout.js"
import { clearToken } from "./authClient.js"
import { addClass, removeClass, getElById } from "./utils.js"
import { apiFetch } from "./api.js"

async function main() {
  // ----------------------------
  // NAV: buttons + basic redirects
  // ----------------------------
  const logoutBtn = getElById("logout-button")
  const changePasswordBtn = getElById("change-password-button")

  if (changePasswordBtn) {
    changePasswordBtn.addEventListener("click", () => {
      window.location.href = "/change-password.html"
    })
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearToken()
      window.location.href = "/login.html"
    })
  }

  // ----------------------------
  // AUTH: token required
  // ----------------------------
  if (!localStorage.getItem("token")) {
    window.location.href = "/login.html"
    return
  }

  // ----------------------------
  // AUTH: load /auth/me once
  // ----------------------------
  const resMe = await apiFetch("/auth/me")
  const me = await resMe.json()

  if (!me?.ok || !me?.user) {
    clearToken()
    window.location.href = "/login.html"
    return
  }

  if (me.user.must_change_password) {
    window.location.href = "/change-password.html"
    return
  }

  localStorage.setItem("rola", me.user.rola)

  // ----------------------------
  // ROLE UI + DEV UI
  // ----------------------------
  const showDevTools =
    import.meta.env.VITE_SHOW_DEV_TOOLS === "true" ||
    import.meta.env.VITE_SHOW_DEV_TOOLS === "1"

  const role = (me.user.rola || "").toUpperCase()

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

  const btnAutomaty = getElById("get-automaty")
  if (btnAutomaty) removeClass(btnAutomaty, "hidden")

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
  const btnUsers = getElById("nav-users")
  const btnDevTools = getElById("nav-dev-tools")
  const createPackageBtn = getElById("nav-create-package")

  if (btnAutomaty) btnAutomaty.addEventListener("click", () => showView("view-automaty"))
  if (btnMyPackages) btnMyPackages.addEventListener("click", () => showView("view-klient"))
  if (btnCourierPackages) btnCourierPackages.addEventListener("click", () => showView("view-kurier"))
  if (btnOperatorPanel) btnOperatorPanel.addEventListener("click", () => showView("view-operator"))
  if (btnUsers) btnUsers.addEventListener("click", () => showView("view-users"))
  if (btnDevTools) btnDevTools.addEventListener("click", () => showView("view-dev"))
  if (createPackageBtn) createPackageBtn.addEventListener("click", () => showView("view-create-package"))



  // ----------------------------
  // FEATURES INIT
  // ----------------------------
  initAutomatsView()
  initDbAdminControls()
  initLogout()
  initPackagesView()
  initKurierPanel()
  initSendPackageView()
  initOperatorPanel()
}

main()
