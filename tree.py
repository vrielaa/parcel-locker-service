import os

SKIP_DIRS = {".git", "node_modules", "__pycache__", "dist", ".cache"}

def print_tree(start_path, prefix=""):
    try:
        entries = sorted(os.listdir(start_path))
    except PermissionError:
        print(prefix + "[brak uprawnień]")
        return
    except FileNotFoundError:
        print(prefix + "[nie znaleziono]")
        return

    entries = [e for e in entries if e not in SKIP_DIRS]

    for i, name in enumerate(entries):
        path = os.path.join(start_path, name)
        is_last = i == len(entries) - 1

        branch = "└── " if is_last else "├── "
        print(prefix + branch + name)

        if os.path.isdir(path):
            extension = "    " if is_last else "│   "
            print_tree(path, prefix + extension)

for root in ["backend", "frontend"]:
    if os.path.isdir(root):
        print(root)
        print_tree(root)
        print()
