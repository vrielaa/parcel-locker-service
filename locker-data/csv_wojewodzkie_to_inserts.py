import argparse
import csv
import hashlib
import re
from pathlib import Path


URL_RE = re.compile(r"(https?://\S+|www\.\S+)", re.IGNORECASE)

CITY_FIX = {
    "bialystok": "Białystok",
    "bydgoszcz": "Bydgoszcz",
    "gdansk": "Gdańsk",
    "gorzow wielkopolski": "Gorzów Wielkopolski",
    "katowice": "Katowice",
    "kielce": "Kielce",
    "krakow": "Kraków",
    "lublin": "Lublin",
    "lodz": "Łódź",
    "olsztyn": "Olsztyn",
    "opole": "Opole",
    "poznan": "Poznań",
    "rzeszow": "Rzeszów",
    "szczecin": "Szczecin",
    "torun": "Toruń",
    "warszawa": "Warszawa",
    "wroclaw": "Wrocław",
    "zielona gora": "Zielona Góra",
}

MAX_LOCATION_LEN = 120

BAD_LOCATION_RE = re.compile(
    r"(appkomat|aby skorzysta[cć]|zainstaluj aplikacj|paybylink|płatno[ść]?\s*apk|obsługuje paczki|max\.\s*\d+\s*kg|\d+\s*[×x]\s*\d+|\d+\s*cm|stref[ae] ułatwionego dostępu)",
    re.IGNORECASE,
)


def sql_escape(s: str) -> str:
    return (s or "").replace("'", "''")


def sanitize_text(s: str) -> str:
    s = URL_RE.sub("", s or "")
    s = re.sub(r"\s+", " ", s).strip(" ,;\t\r\n")
    return s.strip()


def is_bad_location(loc: str) -> bool:
    if not loc:
        return True
    if len(loc) > MAX_LOCATION_LEN:
        return True
    if BAD_LOCATION_RE.search(loc):
        return True
    return False


def dims_from_name(name: str):
    h = int(hashlib.sha256(name.encode("utf-8")).hexdigest()[:8], 16)

    rows = 4 + 2 * (h % 3)

    cols = 5 + ((h >> 3) % 10)

    return rows, cols



def city_from_filename(stem: str) -> str:
    raw = stem.replace("_", " ").strip()
    key = raw.lower()
    return CITY_FIX.get(key, " ".join(w[:1].upper() + w[1:] for w in raw.split()))


def append_city_to_address(adres: str, city: str) -> str:
    adres = (adres or "").strip()
    city = (city or "").strip()

    if not adres or not city:
        return adres

    adres = re.sub(r"[ ,.;:]+$", "", adres)

    last = adres.split(",")[-1].strip().lower()
    if last == city.lower():
        return adres

    return f"{adres}, {city}"


def iter_records(csv_path: Path, city: str):
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            name = (r.get("id") or "").strip()
            loc = sanitize_text(r.get("location") or "")
            lon = (r.get("lon") or "").strip()
            lat = (r.get("lat") or "").strip()

            if not name or not loc or not lon or not lat:
                continue

            if is_bad_location(loc):
                continue

            adres = append_city_to_address(loc, city)

            gps = f"{lat},{lon}"
            rows, cols = dims_from_name(name)

            yield name, adres, gps, rows, cols


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in-dir", default="csv_wojewodzkie")
    ap.add_argument("--out", default="inserty_wojewodzkie.sql")
    ap.add_argument("--status", default="AKTYWNY")
    ap.add_argument("--table", default="Automat")
    args = ap.parse_args()

    in_dir = Path(args.in_dir)
    out_path = Path(args.out)

    files = sorted(in_dir.glob("*.csv"))
    if not files:
        print(f"Brak plików CSV w: {in_dir}")
        return

    values = []
    produced = 0
    skipped = 0

    for f in files:
        city = city_from_filename(f.stem)

        before = produced
        for name, adres, gps, rows, cols in iter_records(f, city):
            values.append(
                "('{nazwa}', '{adres}', '{gps}', '{status}', {rws}, {cls})".format(
                    nazwa=sql_escape(name),
                    adres=sql_escape(adres),
                    gps=sql_escape(gps),
                    status=sql_escape(args.status),
                    rws=rows,
                    cls=cols,
                )
            )
            produced += 1

        if produced == before:
            pass

    if not values:
        print("Brak rekordów po filtrach.")
        return

    with out_path.open("w", encoding="utf-8") as out:
        out.write(f"INSERT INTO {args.table}\n")
        out.write("(nazwa, adres, wspolrzedne_gps, status, liczba_wierszy, liczba_kolumn)\n")
        out.write("VALUES\n")
        out.write(",\n".join(values))
        out.write(";\n")

    print(f"Zapisano: {out_path} (rekordów: {len(values)})")
    print(f"Filtr: MAX_LOCATION_LEN={MAX_LOCATION_LEN} + słowa-klucze Appkomat")


if __name__ == "__main__":
    main()
