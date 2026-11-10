"""Print a client-side SQL update for visually read tirilla amounts."""

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FIELDS = (
    "sheet_total_uyu",
    "commission_uyu",
    "jornal_pos_uyu",
    "fiado_uyu",
    "expenses_uyu",
    "total_to_pay_uyu",
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("batch", choices=["tirillas2", "tirillas3"])
    parser.add_argument("chunk", type=int)
    parser.add_argument("--size", type=int, default=40)
    args = parser.parse_args()
    data = json.loads((ROOT / f"{args.batch}-manual-amounts.json").read_text(encoding="utf-8"))
    rows = []
    for stem, values in sorted(data.items()):
        if isinstance(values, int):
            values = {"sheet_total_uyu": values}
        assert values.get("sheet_total_uyu", 0) > 0
        assert set(values).issubset(FIELDS)
        rows.append({"stem": "IMG_" + stem, **values})
    rows = rows[args.chunk * args.size:(args.chunk + 1) * args.size]
    if not rows:
        raise SystemExit("empty chunk")
    payload = json.dumps(rows, ensure_ascii=False).replace("'", "''")
    field_def = ", ".join(f"{field} numeric" for field in FIELDS)
    assignments = ",\n  ".join(f"{field} = coalesce(v.{field}, p.{field})" for field in FIELDS)
    print(f"""update public.taxi_tirilla_archive_images p
set {assignments},
  extracted_data = p.extracted_data || jsonb_strip_nulls(to_jsonb(v) - 'stem') ||
    jsonb_build_object('importe_fuente', 'lectura_visual', 'importe_validacion', 'pendiente'),
  review_flags = (
    select coalesce(jsonb_agg(existing.flag), '[]'::jsonb)
    from jsonb_array_elements_text(p.review_flags) as existing(flag)
    where existing.flag not in ('importe_pendiente_lectura', 'importe_leido_visual_pendiente_validacion')
  ) || '["importe_leido_visual_pendiente_validacion"]'::jsonb,
  updated_at = now()
from jsonb_to_recordset('{payload}'::jsonb) as v(stem text, {field_def})
where p.batch = '{args.batch}' and split_part(p.original_filename, '.', 1) = v.stem
returning p.original_filename, p.sheet_total_uyu""")


if __name__ == "__main__":
    main()
