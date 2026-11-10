"""Build idempotent Supabase SQL for photographed shift sheets.

The script only prints SQL. It never changes source photos or connects to the database.
"""

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OWNER = "8c016996-aba5-416c-b0d0-e7f573b6b2d7"


def sql(value):
    if value is None:
        return "null"
    if isinstance(value, (dict, list)):
        return "'" + json.dumps(value, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def load(batch):
    stem = batch.lower()
    manifest = json.loads((ROOT / f"{stem}-manifest.json").read_text(encoding="utf-8"))["files"]
    manual = json.loads((ROOT / f"{stem}-manual-headers.json").read_text(encoding="utf-8"))
    journal = [json.loads(line) for line in (ROOT / f"{stem}-upload-journal.jsonl").read_text(encoding="utf-8").splitlines()]
    uploads = {entry["file"]: entry for entry in journal if entry["status"] in ("uploaded", "exists")}
    unique = [row for row in manifest if not row.get("duplicate_of") and not row.get("older_duplicate_of") and not row.get("error")]
    assert len(unique) == len(manual) == len(uploads), (len(unique), len(manual), len(uploads))
    assert set(row["file"] for row in unique) == set(manual) == set(uploads)
    result = []
    for row in unique:
        filename = row["file"]
        header = manual[filename]
        flags = ["importe_pendiente_lectura", "foto_taximetro_no_asociada"]
        if not header.get("record_date"):
            flags.append("fecha_ilegible")
        if not header.get("mobile_number"):
            flags.append("movil_ilegible")
        if not header.get("driver_name"):
            flags.append("conductor_ilegible")
        extracted = {
            "file": filename,
            "type": "planilla",
            "source_batch": batch,
            "record_date": header.get("record_date"),
            "mobile_number": header.get("mobile_number"),
            "driver_name": header.get("driver_name"),
            "confidence": "media" if header.get("record_date") and header.get("mobile_number") else "baja",
            "raw_notes": "Cabecera leída visualmente; importes pendientes de cotejo con la foto o la hoja histórica.",
        }
        values = [
            OWNER, batch.lower(), filename, row["sha256"], row["webp_sha256"],
            uploads[filename]["storage_path"], row["webp_bytes"], row["width"], row["height"],
            "planilla", header.get("record_date"), header.get("mobile_number"),
            header.get("driver_name"), extracted, flags, "revisar",
        ]
        result.append("(" + ",".join(sql(value) for value in values) + ")")
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("batch", choices=["Tirillas2", "Tirillas3"])
    parser.add_argument("chunk", type=int)
    parser.add_argument("--size", type=int, default=20)
    args = parser.parse_args()
    rows = load(args.batch)
    selected = rows[args.chunk * args.size:(args.chunk + 1) * args.size]
    if not selected:
        raise SystemExit("empty chunk")
    print("insert into public.taxi_tirilla_archive_images ")
    print("(owner_id,batch,original_filename,original_sha256,webp_sha256,storage_path,webp_size_bytes,width,height,photo_type,record_date,mobile_number,driver_name,extracted_data,review_flags,review_status) values")
    print(",\n".join(selected))
    print("on conflict (original_sha256) do nothing returning original_filename")


if __name__ == "__main__":
    main()
