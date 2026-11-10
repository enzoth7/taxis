"""Local first-pass OCR for the Tirillas2 review manifest."""

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps
from rapidocr_onnxruntime import RapidOCR


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Tirillas2"
MANIFEST = ROOT / "tirillas2-manifest.json"
RESULT = ROOT / "tirillas2-ocr-v2.jsonl"


def orientation_score(items):
    texts = [str(item[1]).upper() for item in items or []]
    first = next((index for index, text in enumerate(texts) if "FECHA" in text), None)
    last = next((index for index, text in enumerate(texts) if "VENTA" in text), None)
    labels = sum(any(word in text for word in ("FECHA", "CONDUCTOR", "VENTA", "COMISION", "TOTAL", "FIADO")) for text in texts)
    return labels + (4 if first is not None and last is not None and first < last else -4)


def main():
    rows = json.loads(MANIFEST.read_text(encoding="utf-8"))["files"]
    done = set()
    if RESULT.exists():
        for line in RESULT.read_text(encoding="utf-8").splitlines():
            try:
                done.add(json.loads(line)["file"])
            except (ValueError, KeyError):
                pass
    engine = RapidOCR()
    with RESULT.open("a", encoding="utf-8") as output:
        for index, row in enumerate(rows, 1):
            if row.get("duplicate_of") or row.get("older_duplicate_of") or row.get("error"):
                continue
            if row["file"] in done:
                continue
            with Image.open(SOURCE / row["file"]) as opened:
                image = ImageOps.exif_transpose(opened).convert("RGB")
                image.thumbnail((1800, 2600))
                if image.width > image.height:
                    clockwise, _ = engine(np.asarray(image.rotate(270, expand=True)))
                    counterclockwise, _ = engine(np.asarray(image.rotate(90, expand=True)))
                    detected = max((clockwise, counterclockwise), key=orientation_score)
                else:
                    detected, _ = engine(np.asarray(image))
            lines = []
            for item in detected or []:
                polygon, text, score = item
                lines.append({"y": round(sum(point[1] for point in polygon) / 4),
                              "x": round(sum(point[0] for point in polygon) / 4),
                              "text": text, "score": round(float(score), 3)})
            lines.sort(key=lambda item: (item["y"] // 15, item["x"]))
            output.write(json.dumps({"file": row["file"], "lines": lines}, ensure_ascii=False) + "\n")
            output.flush()
            print(index, row["file"], len(lines), flush=True)


if __name__ == "__main__":
    main()
