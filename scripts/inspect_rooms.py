"""Dump the full room list spreadsheet."""
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
sys.stdout.reconfigure(encoding="utf-8")

f = next(ROOT.glob("*강의실*.xlsx"))
wb = openpyxl.load_workbook(f, data_only=True)
for sheet_name in wb.sheetnames:
    ws = wb[sheet_name]
    print(f"[Sheet] {sheet_name}  rows={ws.max_row}  cols={ws.max_column}")
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        print(f"  row{i:02d}:", row)
