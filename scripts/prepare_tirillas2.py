"""Inventory Tirillas2 without changing originals and make WebP review copies."""

import hashlib
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[1]
BATCH = sys.argv[1] if len(sys.argv) > 1 else "Tirillas2"
SOURCE = ROOT / BATCH
OUTPUT = ROOT / f"{BATCH}_webp"
MANIFEST = ROOT / f"{BATCH.lower()}-manifest.json"
OLDER = ROOT / "tirillas-2023-manifest.json"


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    OUTPUT.mkdir(exist_ok=True)
    older = json.loads(OLDER.read_text(encoding="utf-8")) if OLDER.exists() else {}
    older_hashes = {item["sha256"]: item["file"] for item in older.get("files", [])}
    if BATCH != "Tirillas2":
        previous = ROOT / "tirillas2-manifest.json"
        if previous.exists():
            older_hashes.update({item["sha256"]: item["file"] for item in json.loads(previous.read_text(encoding="utf-8"))["files"]})
    seen = {}
    rows = []
    for original in sorted(SOURCE.rglob("*")):
        if not original.is_file():
            continue
        source_hash = sha256(original)
        row = {
            "file": str(original.relative_to(SOURCE)).replace("\\", "/"),
            "bytes": original.stat().st_size,
            "sha256": source_hash,
            "duplicate_of": seen.get(source_hash),
            "older_duplicate_of": older_hashes.get(source_hash),
        }
        if original.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            row["error"] = "unsupported_format"
            rows.append(row)
            continue
        try:
            with Image.open(original) as opened:
                picture = ImageOps.exif_transpose(opened)
                row["width"], row["height"] = picture.size
                if not row["duplicate_of"] and not row["older_duplicate_of"]:
                    filename = f"{source_hash}.webp"
                    destination = OUTPUT / filename
                    if not destination.exists():
                        picture.convert("RGB").save(destination, "WEBP", quality=82, method=6)
                    row.update(webp=filename, webp_bytes=destination.stat().st_size,
                               webp_sha256=sha256(destination))
        except Exception as error:
            row["error"] = str(error)
        seen.setdefault(source_hash, row["file"])
        rows.append(row)

    MANIFEST.write_text(json.dumps({"source": str(SOURCE), "files": rows}, indent=2,
                                   ensure_ascii=False), encoding="utf-8")
    print(json.dumps({
        "files": len(rows),
        "exact_duplicates": sum(bool(row["duplicate_of"]) for row in rows),
        "previously_uploaded": sum(bool(row["older_duplicate_of"]) for row in rows),
        "webp_ready": sum(bool(row.get("webp")) for row in rows),
        "errors": [row["file"] for row in rows if row.get("error")],
    }, ensure_ascii=False))

    photos = [row for row in rows if row.get("webp")]
    for page_index in range(0, len(photos), 12):
        page = Image.new("RGB", (1500, 1500), "white")
        draw = ImageDraw.Draw(page)
        for offset, row in enumerate(photos[page_index:page_index + 12]):
            col, line = offset % 4, offset // 4
            left, top = col * 375, line * 500
            with Image.open(OUTPUT / row["webp"]) as opened:
                thumb = opened.copy()
                thumb.thumbnail((355, 455))
                page.paste(thumb, (left + (375 - thumb.width) // 2, top + 26))
            draw.text((left + 10, top + 4), row["file"], fill="black")
        page.save(OUTPUT / f"contact-{page_index // 12 + 1}.jpg", quality=90)


if __name__ == "__main__":
    main()
