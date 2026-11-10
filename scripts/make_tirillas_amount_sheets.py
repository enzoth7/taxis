"""Make four-photo contact sheets focused on shift totals for manual review."""

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
BATCH = sys.argv[1] if len(sys.argv) > 1 else "Tirillas2"
MANIFEST = json.loads((ROOT / f"{BATCH.lower()}-manifest.json").read_text(encoding="utf-8"))["files"]
HEADERS = json.loads((ROOT / f"{BATCH.lower()}-manual-headers.json").read_text(encoding="utf-8"))
REVIEW = ROOT / f"{BATCH}_review"
FONT = ImageFont.truetype("arial.ttf", 24)


def main():
    for page_index in range(0, len(MANIFEST), 4):
        canvas = Image.new("RGB", (2400, 1820), "white")
        draw = ImageDraw.Draw(canvas)
        for offset, row in enumerate(MANIFEST[page_index:page_index + 4]):
            filename = row["file"]
            path = REVIEW / (Path(filename).stem + ".jpg")
            if not path.exists():
                continue
            header = HEADERS[filename]
            with Image.open(path) as opened:
                image = opened.convert("RGB")
                if Path(filename).stem in ("IMG_2143", "IMG_2089"):
                    image = image.rotate(180)
                panel = image.crop((0, int(image.height * .55), image.width, image.height))
                panel.thumbnail((1160, 835))
                left = (offset % 2) * 1200
                top = (offset // 2) * 910
                canvas.paste(panel, (left + 12, top + 58))
                label = f'{filename}  {header.get("record_date") or "?"}  M{header.get("mobile_number") or "?"}  {header.get("driver_name") or "?"}'
                draw.text((left + 12, top + 15), label, fill="#111111", font=FONT)
        canvas.save(REVIEW / f"amount-{page_index // 4 + 1}.jpg", quality=94)


if __name__ == "__main__":
    main()
