"""Make compact visual-review sheets without altering source photographs."""

import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[1]
BATCH = sys.argv[1] if len(sys.argv) > 1 else "Tirillas2"
SOURCE = ROOT / BATCH
OUTPUT = ROOT / f"{BATCH}_review"
MANIFEST = ROOT / f"{BATCH.lower()}-manifest.json"


def crop_ticket(path):
    with Image.open(path) as original:
        orientation = original.getexif().get(274)
        image = ImageOps.exif_transpose(original).convert("RGB")
    if image.width > image.height:
        image = image.rotate(90 if orientation == 3 else 270, expand=True)
    array = np.asarray(image)
    scale = 900 / image.width
    small = cv2.resize(array, (900, int(image.height * scale)))
    hsv = cv2.cvtColor(small, cv2.COLOR_RGB2HSV)
    mask = cv2.inRange(hsv, np.array([0, 0, 115]), np.array([179, 115, 255]))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates = [cv2.boundingRect(contour) for contour in contours
                  if cv2.contourArea(contour) > small.shape[0] * small.shape[1] * .05]
    if candidates:
        x, y, width, height = max(candidates, key=lambda box: box[2] * box[3])
        margin = 18
        box = (max(0, int((x - margin) / scale)), max(0, int((y - margin) / scale)),
               min(image.width, int((x + width + margin) / scale)),
               min(image.height, int((y + height + margin) / scale)))
        image = image.crop(box)
    return image


def main():
    OUTPUT.mkdir(exist_ok=True)
    rows = json.loads(MANIFEST.read_text(encoding="utf-8"))["files"]
    for index, row in enumerate(rows):
        if row.get("duplicate_of") or row.get("older_duplicate_of") or row.get("error"):
            continue
        destination = OUTPUT / (Path(row["file"]).stem + ".jpg")
        if not destination.exists():
            image = crop_ticket(SOURCE / row["file"])
            image.thumbnail((1200, 2200))
            image.save(destination, quality=90)
        print(index + 1, row["file"], flush=True)


if __name__ == "__main__":
    main()
