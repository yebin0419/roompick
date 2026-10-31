"""Explore the raw 강의시간 string formats so we can design a robust parser."""
import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
sys.stdout.reconfigure(encoding="utf-8")

samples: list[str] = []
for f in sorted(ROOT.glob("개설강좌*.xlsx")):
    wb = openpyxl.load_workbook(f, data_only=True)
    ws = wb.active
    for row in ws.iter_rows(min_row=3, values_only=True):
        cell = row[11]
        if isinstance(cell, str) and cell.strip():
            samples.append(cell.strip())

uniq = sorted(set(samples))
print(f"total_rows={len(samples)}  unique={len(uniq)}")

# Find anomalies: non-standard period tokens, buildings outside N13/N14
anomalies: list[str] = []
all_tokens: set[str] = set()
for s in uniq:
    for day_block in re.split(r"\s{2,}", s):
        m = re.match(r"^([월화수목금토일])\s+([^\[]+)\[([^\]]+)\]\s*$", day_block)
        if not m:
            anomalies.append(day_block)
            continue
        _, periods, room = m.groups()
        for tok in re.split(r"[\s,]+", periods.strip()):
            if tok:
                all_tokens.add(tok)

print("\nUnique period tokens:", sorted(all_tokens))
print("\nAnomalies:")
for a in anomalies:
    print(" ", repr(a))

# All multi-day samples
print("\nMulti-day entries:")
for s in uniq:
    if "  " in s:
        print(" ", s)
