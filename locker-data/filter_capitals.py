import argparse
import shutil
import unicodedata
import re
from pathlib import Path


def norm_key(s: str) -> str:
    s = (s or "").replace("_", " ").strip().lower()

    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))

    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()

    return s


def main():
    capitals = [
        "Białystok",
        "Bydgoszcz",
        "Gdańsk",
        "Gorzów Wielkopolski",
        "Katowice",
        "Kielce",
        "Kraków",
        "Lublin",
        "Łódź",
        "Olsztyn",
        "Opole",
        "Poznań",
        "Rzeszów",
        "Szczecin",
        "Toruń",
        "Warszawa",
        "Wrocław",
        "Zielona Góra",
    ]

    capital_keys = {norm_key(c) for c in capitals}

    ap = argparse.ArgumentParser()
    ap.add_argument("--in-dir", default="csv_by_city")
    ap.add_argument("--out-dir", default="csv_wojewodzkie")
    ap.add_argument("--mode", choices=["copy", "move"], default="copy")
    args = ap.parse_args()

    in_dir = Path(args.in_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    if not in_dir.exists() or not in_dir.is_dir():
        print(f"Brak folderu wejściowego: {in_dir}")
        return

    files = sorted(in_dir.glob("*.csv"))

    matched = []
    for f in files:
        k = norm_key(f.stem)
        if k in capital_keys:
            dst = out_dir / f.name
            if args.mode == "move":
                shutil.move(str(f), str(dst))
            else:
                shutil.copy2(str(f), str(dst))
            matched.append(f.name)

    matched_keys = {norm_key(Path(n).stem) for n in matched}
    missing = [c for c in capitals if norm_key(c) not in matched_keys]

    print(f"Znaleziono plików CSV: {len(files)}")
    print(f"Skopiowano/przeniesiono miast wojewódzkich: {len(matched)} -> {out_dir}")

    if missing:
        print("Brakuje plików dla:")
        for c in missing:
            print(f"- {c}")


if __name__ == "__main__":
    main()
