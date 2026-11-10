"""Group receipt headers and totals for visual reading."""

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
BATCH = sys.argv[1] if len(sys.argv) > 1 else "Tirillas2"
CROPS = ROOT / f"{BATCH}_review"
ROWS = json.loads((ROOT / f"{BATCH.lower()}-manifest.json").read_text(encoding="utf-8"))["files"]
FONT = ImageFont.truetype("arial.ttf", 28)


def main():
    for kind in ("header", "totals"):
        for page_index in range(0, len(ROWS), 10):
            canvas = Image.new("RGB", (2440, 3100), "white")
            draw = ImageDraw.Draw(canvas)
            for offset, row in enumerate(ROWS[page_index:page_index + 10]):
                file = CROPS / (Path(row["file"]).stem + ".jpg")
                if not file.exists():
                    continue
                with Image.open(file) as opened:
                    if kind == "header":
                        panel = opened.crop((0, 0, opened.width, min(opened.height, 610)))
                    else:
                        panel = opened.crop((0, max(0, opened.height - 620), opened.width, opened.height))
                    panel.thumbnail((1200, 580))
                    left = (offset % 2) * 1220
                    top = (offset // 2) * 620
                    canvas.paste(panel, (left, top + 36))
                    draw.text((left + 10, top + 5), row["file"], fill="black", font=FONT)
            canvas.save(CROPS / f"{kind}-{page_index // 10 + 1}.jpg", quality=92)


if __name__ == "__main__":
    main()
