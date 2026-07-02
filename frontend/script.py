import os

OUTPUT_FILE = "cat_html_and_src_js.txt"

def write_file(out, path):
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        out.write(f"\n{'='*80}\n")
        out.write(f"FILE: {path}\n")
        out.write(f"{'='*80}\n\n")
        out.write(f.read())

with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
    for root, dirs, files in os.walk("."):
        for name in files:
            path = os.path.join(root, name)
            rel = os.path.relpath(path, ".")
            ext = os.path.splitext(name)[1].lower()

            is_html = ext == ".html"
            is_js_in_src = ext == ".js" and (rel == "src" or rel.startswith("src" + os.sep))

            if not (is_html or is_js_in_src):
                continue

            try:
                write_file(out, path)
            except Exception as e:
                out.write(f"\n[ERROR reading {path}: {e}]\n")
