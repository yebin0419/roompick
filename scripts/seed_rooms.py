"""
강의실 xlsx → Supabase public.rooms 업서트.
0005_rooms_seed.sql 로 이미 적재했다면 보조/업데이트 용도로 사용.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import openpyxl
import requests


def load_env() -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if v}
    envfile = Path(__file__).resolve().parents[1] / "web" / ".env.local"
    if envfile.exists():
        for line in envfile.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env.setdefault(k.strip(), v.strip())
    return env


def main() -> None:
    env = load_env()
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("env 미설정"); sys.exit(1)

    xlsx = Path(sys.argv[1] if len(sys.argv) > 1 else "충북대학교_경영대_강의실_목록_v2.xlsx")
    wb = openpyxl.load_workbook(xlsx, data_only=True)
    ws = wb[wb.sheetnames[0]]

    rows: list[dict] = []
    header_seen = False
    for raw in ws.iter_rows(values_only=True):
        if raw[1] == "번호":
            header_seen = True; continue
        if not header_seen or raw[1] is None: continue
        code_full = str(raw[5] or "")
        code = code_full.split("(")[0].strip()
        if not code: continue
        rows.append({
            "code": code,
            "building": str(raw[2] or "").replace("동", "").strip(),
            "building_name": str(raw[3] or "").strip() or None,
            "floor": str(raw[4] or "").strip() or None,
            "room_type": str(raw[6] or "").strip() or None,
        })

    endpoint = f"{url.rstrip('/')}/rest/v1/rooms?on_conflict=code"
    headers = {
        "apikey": key, "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    r = requests.post(endpoint, json=rows, headers=headers, timeout=30)
    if r.status_code >= 300:
        print("error:", r.status_code, r.text[:500]); sys.exit(1)
    print(f"{len(rows)}개 강의실 upsert 완료.")


if __name__ == "__main__":
    main()
