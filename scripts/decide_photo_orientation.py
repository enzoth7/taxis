"""Rank the read-only OCR audit by expected top-to-bottom field order."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "Tirillas2_review" / "orientation-audit.jsonl"
OUTPUT = ROOT / "Tirillas2_review" / "orientation-decisions.json"
FIELDS = ("FECHA", "INICIA", "CONDUCTOR", "VENTA", "COMISION", "FIADO", "PAGAR")


def order_score(lines):
    positions = {}
    for index, line in enumerate(lines):
        for field in FIELDS:
            if field in line and field not in positions:
                positions[field] = index
    ranked = [field for field in FIELDS if field in positions]
    pairs = [(a, b) for i, a in enumerate(ranked) for b in ranked[i + 1:]]
    correct = sum(positions[a] < positions[b] for a, b in pairs)
    return 2 * correct - len(pairs), len(ranked)


def main():
    rows = [json.loads(line) for line in AUDIT.read_text(encoding="utf-8").splitlines()]
    result = []
    for row in rows:
        scores = {int(degrees): order_score(info[1]) for degrees, info in row["scores"].items() if int(degrees) in (90, 270)}
        ranked = sorted(scores, key=lambda degrees: scores[degrees][0], reverse=True)
        margin = scores[ranked[0]][0] - scores[ranked[1]][0]
        decision = {
            "batch": row["batch"], "file": row["file"], "sha256": row["sha256"],
            "rotation_degrees": (360 - ranked[0]) % 360 if margin >= 4 and scores[ranked[0]][1] >= 3 else None,
            "order_scores": scores, "margin": margin,
        }
        result.append(decision)
    OUTPUT.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    decided = [row for row in result if row["rotation_degrees"] is not None]
    print(json.dumps({"audited": len(result), "decided": len(decided), "unresolved": [row["file"] for row in result if row["rotation_degrees"] is None], "clockwise_90": sum(row["rotation_degrees"] == 90 for row in decided), "clockwise_270": sum(row["rotation_degrees"] == 270 for row in decided)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
