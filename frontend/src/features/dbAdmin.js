import { getElById } from "../utils.js"
import { callApi } from "../api.js"

export function initDbAdminControls() {
  const checkBtn = getElById("check-db-button")
  const initBtn = getElById("init-db-button")

  if (!checkBtn || !initBtn) return

  checkBtn.addEventListener("click", async () => {
    await callApi("/db/test", { method: "GET" }, "db-message")
  })

  initBtn.addEventListener("click", async () => {
    await callApi("/db/init", { method: "POST" }, "db-message")
  })
}
