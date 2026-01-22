import bcrypt from "bcrypt";

const passwords = ["admin123", "operator123", "kurier123", "klient123"];

for (const p of passwords) {
  const hash = await bcrypt.hash(p, 10);
}
