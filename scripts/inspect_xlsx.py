"""One-shot inspection of all xlsx files in the project directory."""
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parent.parent

for f in sorted(ROOT.glob("*.xlsx")):
    print("=" * 70)
    print("FILE:", f.name)
    print("=" * 70)
    wb = openpyxl.load_workbook(f, data_only=True)
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        print(f"[Sheet] {sheet_name}  rows={ws.max_row}  cols={ws.max_column}")
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i >= 15:
                print("  ...")
                break
            print(f"  row{i:02d}:", row)
        print()
