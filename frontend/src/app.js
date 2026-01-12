import "../sass/main.scss"
import { initAutomatsView } from "./features/automat.js"
import { initDbAdminControls } from "./features/dbAdmin.js"
import { initLogout } from "./features/logout.js"
import { fetchMe, clearToken } from "./authClient.js"
import { addClass, removeClass, getElById } from "./utils.js"
import { apiFetch } from "./api.js"

async function main() {
  const logoutBtn = getElById("logout-button")
  const changePasswordBtn = getElById("change-password-button")

  changePasswordBtn.addEventListener("click", () => {
    window.location.href = "/change-password.html"
  })

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token")
    localStorage.removeItem("rola")
    window.location.href = "/login.html"
  })

  if (!localStorage.getItem("token")) {
    window.location.href = "/login.html"
    return
  }

  const resMe = await apiFetch("/auth/me")
  const me = await resMe.json()

  if (me.ok && me.user?.must_change_password) {
    window.location.href = "/change-password.html"
    return
  }

  initAutomatsView()
  initDbAdminControls()
  initLogout()

  async function initRoleUI() {
    const user = await fetchMe()

    if (!user) {
      clearToken()
      window.location.href = "/login.html"
      return
    }

    localStorage.setItem("rola", user.rola)

    const btnAutomaty = getElById("get-automaty")
    if (btnAutomaty) removeClass(btnAutomaty, "hidden")
  }

  await initRoleUI()
}

main()
