"""Read-only orientation audit of locally retained historical WebP photos."""

import json
from pathlib import Path

import numpy as np
from PIL import Image
from rapidocr_onnxruntime import RapidOCR


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "Tirillas2_review" / "orientation-audit.jsonl"
BATCHES = (
    ("tirillas-2023", "Tirillas_webp_2023"),
    ("tirillas2", "Tirillas2_webp"),
    ("tirillas3", "Tirillas3_webp"),
)
WORDS = ("FECHA", "MOVIL", "INICIA", "FINALIZA", "CONDUCTOR", "VENTA", "COMISION", "JORNAL", "FIADO", "PAGAR")


def score(items):
    lines = [(str(item[1]).upper(), float(item[2])) for item in items or []]
    hits = sum(4 * confidence for line, confidence in lines if any(word in line for word in WORDS))
    return round(hits + sum(confidence for _, confidence in lines) / 5, 2), [line for line, _ in lines if any(word in line for word in WORDS)]


def main():
    engine = RapidOCR()
    OUT.parent.mkdir(exist_ok=True)
    existing = {}
    if OUT.exists():
        for line in OUT.read_text(encoding="utf-8").splitlines():
            row = json.loads(line)
            existing[row["sha256"]] = row
    with OUT.open("a", encoding="utf-8") as output:
        for batch, folder in BATCHES:
            rows = json.loads((ROOT / f"{batch}-manifest.json").read_text(encoding="utf-8"))["files"]
            for row in rows:
                if row.get("duplicate_of") or row.get("older_duplicate_of") or row.get("error") or not row.get("webp") or row["width"] <= row["height"] or row["sha256"] in existing:
                    continue
                with Image.open(ROOT / folder / row["webp"]) as opened:
                    opened.thumbnail((1400, 1400))
                    image = opened.convert("RGB")
                    scores = {}
                    for degrees in (0, 90, 270):
                        result, _ = engine(np.asarray(image.rotate(degrees, expand=True)))
                        scores[str(degrees)] = score(result)
                ranked = sorted(scores, key=lambda key: scores[key][0], reverse=True)
                result = {"batch": batch, "file": row["file"], "sha256": row["sha256"], "webp_sha256": row["webp_sha256"], "scores": scores, "best": int(ranked[0]), "margin": round(scores[ranked[0]][0] - scores[ranked[1]][0], 2)}
                output.write(json.dumps(result, ensure_ascii=False) + "\n")
                output.flush()
                print(f"{batch} {row['file']} {result['best']} margin={result['margin']}", flush=True)


if __name__ == "__main__":
    main()
