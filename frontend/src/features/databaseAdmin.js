import { getElById } from "../utils.js"
import { callApi } from "../api.js"
import { displayMessageForSeconds } from "../messages.js"

export function initDatabaseAdminControls() {
  const checkBtn = getElById("check-db-button")
  const initBtn = getElById("init-db-button")

  if (!checkBtn || !initBtn) return

  checkBtn.addEventListener("click", async () => {
    await callApi("/db/test", { method: "GET" }, "db-message")
    displayMessageForSeconds("Test połączenia z bazą danych zakończony.", 5, "db-message")
  })

  initBtn.addEventListener("click", async () => {
    await callApi("/db/init", { method: "POST" }, "db-message")
    displayMessageForSeconds("Inicjalizacja bazy danych zakończona.", 5, "db-message")
  })
}
