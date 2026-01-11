import { getElById } from "../utils.js"
import { callApi } from "../api.js"

export function initDbAdminControls() {
  const checkBtn = getElById("check-db-button")
  const clearBtn = getElById("clear-db-button")
  const initBtn = getElById("init-db-button")

  if (!checkBtn || !clearBtn || !initBtn) return

  checkBtn.addEventListener("click", async () => {
    await callApi("/api/db/test", { method: "GET" }, "db-message")
  })

  clearBtn.addEventListener("click", async () => {
    await callApi("/api/db/clear", { method: "POST" }, "db-message")
  })

  initBtn.addEventListener("click", async () => {
    await callApi("/api/db/init", { method: "POST" }, "db-message")
  })
}
