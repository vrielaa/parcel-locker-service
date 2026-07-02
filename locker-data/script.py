import argparse
import csv
import json
import re
import unicodedata
from pathlib import Path


URL_RE = re.compile(r"(https?://\S+|www\.\S+)", re.IGNORECASE)
CITY_FROM_INPOST_URL_RE = re.compile(r"/paczkomat-([a-z0-9-]+?)-", re.IGNORECASE)
INVALID_FILENAME_CHARS_RE = re.compile(r'[<>:"/\\|?*\x00-\x1F]')

BAD_CITY_TOKENS = [
    "inpost",
    "paczkomat",
    "appkomat",
    "odmiana",
    "bez ekranu",
    "parcel",
    "locker",
]


def pick_id(props, feature_id):
    return props.get("ref") or props.get("@id") or feature_id or ""


def build_location(props):
    city = props.get("addr:city") or props.get("addr:place") or props.get("addr:town") or props.get("addr:village")
    street = props.get("addr:street")
    housenumber = props.get("addr:housenumber")

    parts = []
    if city:
        parts.append(city)

    street_line = " ".join([p for p in [street, housenumber] if p])
    if street_line:
        parts.append(street_line)

    if parts:
        return ", ".join(parts)

    return props.get("description") or ""


def sanitize_location(loc: str) -> str:
    loc = URL_RE.sub("", loc)
    loc = re.sub(r"\s+", " ", loc)
    loc = loc.strip(" ,;\t\r\n")
    return loc.strip()


def is_plausible_city(city: str) -> bool:
    city = (city or "").strip()
    if len(city) < 2:
        return False

    low = city.lower()

    if any(tok in low for tok in BAD_CITY_TOKENS):
        return False

    if re.search(r"\d", city):
        return False

    return True


def titleize_city(city: str) -> str:
    city = (city or "").strip()
    words = [w for w in re.split(r"\s+", city) if w]
    return " ".join(w[:1].upper() + w[1:] for w in words)


def extract_city(props):
    for key in ["addr:city", "addr:place", "addr:town", "addr:village", "addr:municipality"]:
        val = props.get(key)
        if val:
            c = str(val).strip()
            if is_plausible_city(c):
                return titleize_city(c)

    website = (
        props.get("website")
        or props.get("website:pl")
        or props.get("website:en")
        or props.get("website:ua")
        or ""
    )

    m = CITY_FROM_INPOST_URL_RE.search(website)
    if m:
        slug = m.group(1).replace("-", " ").strip()
        if is_plausible_city(slug):
            return titleize_city(slug)

    return None


def safe_filename(name: str) -> str:
    name = name.strip().strip(".")
    name = INVALID_FILENAME_CHARS_RE.sub("_", name)
    name = re.sub(r"\s+", " ", name).strip()
    if not name:
        return ""
    name = name.replace(" ", "_")
    return name[:120]


def ascii_slug(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    ascii_only = re.sub(r"[^a-zA-Z0-9_]+", "_", ascii_only).strip("_")
    return ascii_only or safe_filename(name)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input_geojson")
    ap.add_argument("--out-dir", default="csv_by_city")
    ap.add_argument("--only-with-location", action="store_true")
    ap.add_argument("--ascii-filenames", action="store_true")
    args = ap.parse_args()

    in_path = Path(args.input_geojson)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    with in_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    writers = {}
    counts = {}
    skipped_no_city = 0

    def get_writer(city_name: str):
        if city_name in writers:
            return writers[city_name]

        fname_base = ascii_slug(city_name) if args.ascii_filenames else safe_filename(city_name)
        if not fname_base:
            return None

        out_path = out_dir / f"{fname_base}.csv"
        fh = out_path.open("w", encoding="utf-8", newline="")
        w = csv.writer(fh)
        w.writerow(["id", "location", "lon", "lat"])
        writers[city_name] = (fh, w)
        counts[city_name] = 0
        return writers[city_name]

    for feat in data.get("features", []):
        props = feat.get("properties", {}) or {}
        geom = feat.get("geometry", {}) or {}

        if geom.get("type") != "Point":
            continue

        coords = geom.get("coordinates")
        if not (isinstance(coords, list) and len(coords) == 2):
            continue

        loc = sanitize_location(build_location(props) or "")
        if args.only_with_location and not loc:
            continue

        city = extract_city(props)
        if not city:
            skipped_no_city += 1
            continue

        pid = pick_id(props, feat.get("id"))
        lon, lat = coords[0], coords[1]

        pair = get_writer(city)
        if not pair:
            skipped_no_city += 1
            continue

        fh, w = pair
        w.writerow([pid, loc, lon, lat])
        counts[city] += 1

    for fh, _ in writers.values():
        fh.close()

    total = sum(counts.values())
    print(f"Zapisano: {total} rekordów do {len(counts)} plików CSV w: {out_dir}")
    print(f"Pominięto (brak poprawnego miasta): {skipped_no_city}")


if __name__ == "__main__":
    main()
