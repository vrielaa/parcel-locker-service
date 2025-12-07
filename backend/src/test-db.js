import { query } from "./db.js"

async function main() {
  try {
    const res = await query("SELECT NOW()", [])
    console.log("Połączenie OK, wynik:")
    console.log(res.rows)
  } catch (err) {
    console.error("Błąd połączenia z bazą:")
    console.error(err)
  } finally {
    process.exit(0)
  }
}

main()
