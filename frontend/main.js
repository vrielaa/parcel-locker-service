import "./sass/main.scss";

const checkBtn = document.getElementById("check-db-button")
const clearBtn = document.getElementById("clear-db-button")
const initBtn = document.getElementById("init-db-button")
const output = document.getElementById("db-result")


async function callApi(url, options) {
  output.textContent = "Przetwarzanie..."

  try {
    const res = await fetch(url, options)
    const data = await res.json()
    output.textContent = JSON.stringify(data, null, 2)
  } catch (err) {
    output.textContent = "Błąd: " + err.message
  }
}

checkBtn.addEventListener("click", () => {
  callApi("http://localhost:3000/api/test-db", { method: "GET" })
})

clearBtn.addEventListener("click", () => {
  callApi("http://localhost:3000/api/db/clear", { method: "POST" })
})

initBtn.addEventListener("click", () => {
  callApi("http://localhost:3000/api/db/init", { method: "POST" })
})

const getAutomatyBtn = document.getElementById("get-automaty")

getAutomatyBtn.addEventListener("click", () => {

  // callApi("http://localhost:3000/api/miasta", { method: "GET" })

  //buttons dla każdego miasta
  output.textContent = "Tworzenie przycisków..."
  fetch("http://localhost:3000/api/miasta", { method: "GET" })
    .then(res => res.json())
    .then(miasta => {
      output.textContent = ""
      miasta.forEach(miasto => {
        const button = document.createElement("button")
        button.textContent = miasto
        button.classList.add("db-result__city-button")
        button.addEventListener("click", () => {
          // alert(`Wybrano miasto: ${miasto}`)
        })
        output.appendChild(button)
      })
    })
    .catch(err => {
      output.textContent = "Błąd: " + err.message
    })
})



// sprawdzanie czy klikajac w obszar output kliknieto w button miasta, jesli tak to podswietl tylko ten button
output.addEventListener("click", (e) => {
  if (!e.target.classList.contains("db-result__city-button")) {
    return
  }

  const clicked = e.target
  const isActive = clicked.classList.contains("is-active")

  const allButtons = output.querySelectorAll(".db-result__city-button")
  allButtons.forEach(b => b.classList.remove("is-active"))

  if (!isActive) {
    clicked.classList.add("is-active")
  }
})
