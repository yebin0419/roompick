"""
개설강좌 xlsx → Supabase public.courses 테이블 시딩.

사용법:
    pip install openpyxl requests python-dotenv
    cp web/.env.local.example web/.env.local  # 그리고 값 채우기
    python scripts/seed_courses.py "개설강좌 목록_*.xlsx"

환경변수 (web/.env.local 또는 쉘 환경):
    NEXT_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import glob
import os
import re
import sys
from pathlib import Path

import openpyxl
import requests

WEEKDAYS = {"일": 0, "월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6}
# "A1" 패턴 (압축교시) 매핑 — 교양/실험 공통. 임시: A1~A4를 1~4교시로 매핑.
A_PERIOD_RE = re.compile(r"^A(\d+)$")

# 경영대 범위 외 강의실 — 과목이 xlsx에 남아 있어도 적재 대상에서 제외
EXCLUDED_ROOMS = {"N14-703", "N14-704"}


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


def parse_schedule(raw: str) -> list[dict]:
    """
    예: "화 01 ,02 ,03 [N13-404(59-404)]  수 07 ,08 ,09 [N13-404(59-404)]"
    → [{weekday, start_period, end_period, room_code}, ...]
    """
    if not raw:
        return []
    tokens = re.split(r"\s{2,}", raw.strip())
    # 공백이 1칸인 경우도 많으니, 요일 토큰을 기준으로 재분해
    tokens = re.findall(
        r"([일월화수목금토])\s*((?:[A-Z]?\d+\s*,?\s*)+)\[([^\]]+)\]",
        raw,
    )
    out: list[dict] = []
    for weekday_ko, periods_raw, room in tokens:
        periods: list[int] = []
        for p in re.findall(r"[A-Z]?\d+", periods_raw):
            m = A_PERIOD_RE.match(p)
            if m:
                periods.append(int(m.group(1)))
            else:
                periods.append(int(p))
        if not periods:
            continue
        room_code = room.split("(")[0].strip()
        out.append({
            "weekday": WEEKDAYS[weekday_ko],
            "start_period": min(periods),
            "end_period": max(periods),
            "room_code": room_code,
        })
    return out


def rows_from_xlsx(path: Path) -> list[dict]:
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb[wb.sheetnames[0]]
    rows: list[dict] = []
    header_seen = False
    for raw in ws.iter_rows(values_only=True):
        if raw[0] == "순번":
            header_seen = True
            continue
        if not header_seen:
            continue
        if not raw[0]:
            continue
        code = str(raw[3] or "").strip()
        name = str(raw[4] or "").strip()
        section = str(raw[5] or "").strip()
        professor = str(raw[10] or "").strip() or None
        schedule_raw = str(raw[11] or "").strip()
        schedules = parse_schedule(schedule_raw)
        for s in schedules:
            if s["room_code"] in EXCLUDED_ROOMS:
                continue
            rows.append({
                "code": code,
                "name": name,
                "professor": professor,
                "section": section or None,
                "room_code": s["room_code"],
                "weekday": s["weekday"],
                "start_period": s["start_period"],
                "end_period": s["end_period"],
                "raw_time": schedule_raw,
            })
    return rows


def ensure_rooms(url: str, key: str, codes: set[str]) -> None:
    """FK 유지를 위해 courses에 등장하는 강의실 코드를 모두 선등록."""
    endpoint = f"{url.rstrip('/')}/rest/v1/rooms?select=code"
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    r = requests.get(endpoint, headers=headers, timeout=30)
    r.raise_for_status()
    existing = {row["code"] for row in r.json()}
    missing = sorted(codes - existing)
    if not missing:
        return
    print(f"미등록 강의실 {len(missing)}개 자동 보완: {missing}")
    rows = []
    for code in missing:
        if code.startswith("N13-"):
            building, bname = "N-13", "경영대학"
        elif code.startswith("N14-"):
            building, bname = "N-14", "인문사회관"
        elif code.startswith("N16"):
            building, bname = "N-16", "자연대"
        elif code.startswith("N23"):
            building, bname = "N-23", "공대"
        else:
            building, bname = "외부", None
        rows.append({
            "code": code, "building": building, "building_name": bname,
            "room_type": "외부(개설강좌 참조)",
        })
    r = requests.post(
        f"{url.rstrip('/')}/rest/v1/rooms?on_conflict=code",
        json=rows,
        headers={**headers, "Content-Type": "application/json",
                 "Prefer": "resolution=merge-duplicates,return=minimal"},
        timeout=30,
    )
    if r.status_code >= 300:
        print("rooms upsert error:", r.status_code, r.text[:500])
        sys.exit(1)


def upsert(url: str, key: str, rows: list[dict]) -> None:
    endpoint = f"{url.rstrip('/')}/rest/v1/courses"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    CHUNK = 500
    for i in range(0, len(rows), CHUNK):
        batch = rows[i:i + CHUNK]
        r = requests.post(endpoint, json=batch, headers=headers, timeout=30)
        if r.status_code >= 300:
            print("Supabase error:", r.status_code, r.text[:500])
            sys.exit(1)


def main() -> None:
    env = load_env()
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.")
        sys.exit(1)

    patterns = sys.argv[1:] or ["개설강좌*.xlsx"]
    files: list[Path] = []
    for p in patterns:
        files.extend(Path(x) for x in glob.glob(p))
    if not files:
        print("xlsx 파일을 찾지 못했습니다.")
        sys.exit(1)

    all_rows: list[dict] = []
    for f in files:
        rows = rows_from_xlsx(f)
        print(f"{f.name}: {len(rows)} 교시")
        all_rows.extend(rows)

    # FK 보완
    all_codes = {r["room_code"] for r in all_rows if r.get("room_code")}
    ensure_rooms(url, key, all_codes)

    # 기존 모두 삭제 후 재삽입(간단화). 운영에서는 upsert 키 사용 권장.
    del_url = f"{url.rstrip('/')}/rest/v1/courses?id=not.is.null"
    requests.delete(del_url, headers={
        "apikey": key, "Authorization": f"Bearer {key}",
    }, timeout=30)

    upsert(url, key, all_rows)
    print(f"총 {len(all_rows)}건 적재 완료.")


if __name__ == "__main__":
    main()
