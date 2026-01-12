import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import apiRouter from "./routes/index.js"
import { requestLogger } from "./middleware/requestLogger.js"

dotenv.config()

const app = express()


app.use(cors()) 
app.use(express.json())
app.use(requestLogger)

app.use("/api", apiRouter)

app.get("/", (req, res) => {
  res.status(200).send("OK")
})

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true })
})


const PORT = process.env.PORT || 8080
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API listening on port ${PORT}`)
})
