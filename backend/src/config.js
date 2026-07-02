import dotenv from "dotenv"

dotenv.config()

export function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production")
  }

  return "local-dev-secret-change-me"
}
