import { getElById } from "./utils.js"

export const displayMessageForSeconds = (message, seconds, outputId) => {
  const output = getElById(outputId)

  if (!output) return

  output.textContent = message

  setTimeout(() => {
    output.textContent = ""
  }, seconds * 1000)
}
