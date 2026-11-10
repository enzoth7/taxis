"""Upload reviewed Tirillas2 WebP files with the existing test user's session."""

import getpass
import json
import sys
from pathlib import Path
from urllib.parse import quote

import requests


ROOT = Path(__file__).resolve().parents[1]
BATCH = sys.argv[1] if len(sys.argv) > 1 else "Tirillas2"
MANIFEST = ROOT / f"{BATCH.lower()}-manifest.json"
JOURNAL = ROOT / f"{BATCH.lower()}-upload-journal.jsonl"
SOURCE = ROOT / f"{BATCH}_webp"
EMAIL = "prueba.taxis@example.com"
BUCKET = "taxi-tickets"


def read_env():
    values = {}
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def main():
    env = read_env()
    base = env["VITE_SUPABASE_URL"].rstrip("/")
    key = env["VITE_SUPABASE_PUBLISHABLE_KEY"]
    password = getpass.getpass("Contraseña del usuario de prueba: ")
    auth = requests.post(base + "/auth/v1/token?grant_type=password",
                         headers={"apikey": key, "Content-Type": "application/json"},
                         json={"email": EMAIL, "password": password}, timeout=30)
    password = None
    if not auth.ok:
        raise SystemExit(f"No se pudo iniciar sesión: HTTP {auth.status_code}")
    session = auth.json()
    user_id = session["user"]["id"]
    if user_id != "8c016996-aba5-416c-b0d0-e7f573b6b2d7":
        raise SystemExit("La sesión no corresponde al propietario del archivo histórico.")
    headers = {"apikey": key, "Authorization": "Bearer " + session["access_token"]}
    rows = json.loads(MANIFEST.read_text(encoding="utf-8"))["files"]
    done = set()
    if JOURNAL.exists():
        for line in JOURNAL.read_text(encoding="utf-8").splitlines():
            try:
                item = json.loads(line)
                if item["status"] in {"uploaded", "exists"}:
                    done.add(item["file"])
            except (ValueError, KeyError):
                pass
    uploaded = 0
    errors = 0
    with JOURNAL.open("a", encoding="utf-8") as output:
        for row in rows:
            if not row.get("webp") or row["file"] in done:
                continue
            path = f"{user_id}/archive/{BATCH.lower()}/{row['webp_sha256']}.webp"
            url = base + "/storage/v1/object/" + BUCKET + "/" + quote(path, safe="/")
            check = requests.head(url, headers=headers, timeout=30)
            if check.status_code == 200:
                status = "exists"
            else:
                with (SOURCE / row["webp"]).open("rb") as image:
                    response = requests.post(url, data=image,
                        headers={**headers, "Content-Type": "image/webp", "Cache-Control": "3600"},
                        timeout=120)
                status = "uploaded" if response.ok else f"http_{response.status_code}"
            output.write(json.dumps({"file": row["file"], "storage_path": path,
                                     "status": status}, ensure_ascii=False) + "\n")
            output.flush()
            if status in {"uploaded", "exists"}:
                uploaded += 1
            else:
                errors += 1
            print(row["file"], status, flush=True)
    print(json.dumps({"processed": uploaded, "errors": errors}, ensure_ascii=False))


if __name__ == "__main__":
    main()
