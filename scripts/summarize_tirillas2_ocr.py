"""Display handwritten amount candidates beside OCR anchors for review."""

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OCR = ROOT / "tirillas2-ocr-v2.jsonl"
ANCHORS = {
    "venta": re.compile(r"VENTA\s*TOTAL|VENTA\s*TOTAL", re.I),
    "comision": re.compile(r"COMISI[OÓ]N|COMISION", re.I),
    "pagar": re.compile(r"TOTAL\s*A\s*PAGAR|TOTALAPAGAR", re.I),
}


def main():
    for raw in OCR.read_text(encoding="utf-8").splitlines():
        item = json.loads(raw)
        lines = item["lines"]
        fields = []
        for field, pattern in ANCHORS.items():
            anchor = next((line for line in lines if pattern.search(line["text"])), None)
            if anchor is None:
                fields.append(f"{field}=--")
                continue
            near = [line for line in lines
                    if line is not anchor
                    and abs(line["y"] - anchor["y"]) <= 44
                    and line["x"] > anchor["x"] + 70]
            near.sort(key=lambda line: (abs(line["y"] - anchor["y"]), line["x"]))
            values = [f'{line["text"]}:{line["score"]:.2f}' for line in near[:3]]
            fields.append(f'{field}={"/".join(values) or "--"}')
        print(f'{item["file"]} {" ".join(fields)}')


if __name__ == "__main__":
    main()
