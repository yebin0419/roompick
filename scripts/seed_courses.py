"""
개설강좌 xlsx → Supabase public.courses 테이블 시딩.

파일 자동 탐지 경로 (우선순위):
    1. 명령줄 인자로 전달된 경로 (glob 패턴 가능)
    2. scripts/*.xlsx
    3. 프로젝트 루트/*.xlsx
  파일명 패턴은 '개설강좌*목록*.xlsx'

사용법:
    pip install openpyxl requests
    cp web/.env.local.example web/.env.local  # 그리고 값 채우기

    # 전체 자동 (가장 최신 파일 자동 선택)
    python scripts/seed_courses.py

    # 특정 파일(들) 지정
    python scripts/seed_courses.py "scripts/개설강좌 목록_*.xlsx"
    python scripts/seed_courses.py "개설강좌 목록_20261028233347113930.xlsx"

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

ROOT = Path(__file__).resolve().parents[1]

WEEKDAYS = {"일": 0, "월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6}
# "A1" 패턴 (압축교시) 매핑 -교양/실험 공통. 임시: A1~A4를 1~4교시로 매핑.
A_PERIOD_RE = re.compile(r"^A(\d+)$")

# 교시 → HH:MM 매핑 (1~13교시, 09:00~22:00)
PERIOD_TO_TIME: dict[int, tuple[str, str]] = {
    i: (f"{8 + i:02d}:00", f"{9 + i:02d}:00") for i in range(1, 14)
}

# 경영대 범위 외 강의실 -과목이 xlsx에 남아 있어도 적재 대상에서 제외
EXCLUDED_ROOMS = {"N14-703", "N14-704"}


def load_env() -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if v}
    envfile = ROOT / "web" / ".env.local"
    if envfile.exists():
        for line in envfile.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env.setdefault(k.strip(), v.strip())
    return env


def discover_files(argv_patterns: list[str]) -> list[Path]:
    """
    인자 패턴 → scripts/ → 프로젝트 루트 순으로 xlsx 탐색.
    여러 파일이 있을 경우 mtime 내림차순(최신 우선).
    """
    files: list[Path] = []
    if argv_patterns:
        for p in argv_patterns:
            files.extend(Path(x) for x in glob.glob(p))
        if not files:
            # 상대 경로 패턴이 cwd 기준이라 비어 있을 수 있음 -ROOT 기준으로도 시도
            for p in argv_patterns:
                files.extend(Path(x) for x in glob.glob(str(ROOT / p)))
    else:
        patterns = [
            ROOT / "scripts" / "개설강좌*목록*.xlsx",
            ROOT / "개설강좌*목록*.xlsx",
        ]
        for pat in patterns:
            matches = glob.glob(str(pat))
            if matches:
                files.extend(Path(x) for x in matches)
                break  # 먼저 발견된 디렉토리의 파일만 사용

    files = [f for f in files if f.exists() and not f.name.startswith("~$")]
    files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
    return files


def parse_schedule(raw: str) -> list[dict]:
    """
    예: "화 01 ,02 ,03 [N13-404(59-404)]  수 07 ,08 ,09 [N13-404(59-404)]"
    → [{weekday, start_period, end_period, start_time, end_time, room_code}, ...]
    """
    if not raw:
        return []
    tokens = re.findall(
        r"([일월화수목금토])\s*((?:[A-Z]?\d+\s*,?\s*)+)\[([^\]]+)\]",
        raw,
    )
    out: list[dict] = []
    for weekday_ko, periods_raw, room in tokens:
        periods: list[int] = []
        for p in re.findall(r"[A-Z]?\d+", periods_raw):
            m = A_PERIOD_RE.match(p)
            periods.append(int(m.group(1)) if m else int(p))
        if not periods:
            continue
        periods = [p for p in periods if p in PERIOD_TO_TIME]
        if not periods:
            continue  # 1~13 범위 밖은 skip
        s_p, e_p = min(periods), max(periods)
        start_time = PERIOD_TO_TIME[s_p][0]
        end_time = PERIOD_TO_TIME[e_p][1]
        out.append({
            "weekday": WEEKDAYS[weekday_ko],
            "start_period": s_p,
            "end_period": e_p,
            "start_time": start_time,
            "end_time": end_time,
            "room_code": room.split("(")[0].strip(),
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
        if not header_seen or not raw[0]:
            continue
        code = str(raw[3] or "").strip()
        name = str(raw[4] or "").strip()
        section = str(raw[5] or "").strip()
        professor = str(raw[10] or "").strip() or None
        schedule_raw = str(raw[11] or "").strip()
        for s in parse_schedule(schedule_raw):
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
    print(f"[rooms] 미등록 강의실 {len(missing)}개 자동 보완: {missing}")
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


def replace_courses(url: str, key: str, rows: list[dict]) -> int:
    """기존 courses 전체 삭제 후 신규 적재. 적재된 행 수를 반환."""
    headers = {
        "apikey": key, "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    # 전체 삭제
    r = requests.delete(
        f"{url.rstrip('/')}/rest/v1/courses?id=not.is.null",
        headers=headers, timeout=30,
    )
    if r.status_code >= 300:
        print("courses delete error:", r.status_code, r.text[:500])
        sys.exit(1)

    inserted = 0
    CHUNK = 500
    for i in range(0, len(rows), CHUNK):
        batch = rows[i:i + CHUNK]
        rr = requests.post(
            f"{url.rstrip('/')}/rest/v1/courses", json=batch,
            headers={**headers, "Prefer": "return=minimal"},
            timeout=30,
        )
        if rr.status_code >= 300:
            print("courses insert error:", rr.status_code, rr.text[:500])
            sys.exit(1)
        inserted += len(batch)
    return inserted


def main() -> None:
    env = load_env()
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("[env] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.")
        sys.exit(1)

    files = discover_files(sys.argv[1:])
    if not files:
        print("[err] xlsx 파일을 찾지 못했습니다.")
        print("      scripts/ 또는 프로젝트 루트에 '개설강좌*목록*.xlsx' 파일을 두거나")
        print("      python scripts/seed_courses.py <path.xlsx> 로 경로를 지정해주세요.")
        sys.exit(1)

    print(f"[input] 적재 대상 {len(files)}개:")
    for f in files:
        print(f"  - {f} (mtime={f.stat().st_mtime:.0f})")

    all_rows: list[dict] = []
    for f in files:
        rows = rows_from_xlsx(f)
        print(f"[parse] {f.name}: {len(rows)} 교시")
        all_rows.extend(rows)

    if not all_rows:
        print("[err] 파싱된 과목이 없습니다. 엑셀 포맷을 확인해주세요.")
        sys.exit(1)

    all_codes = {r["room_code"] for r in all_rows if r.get("room_code")}
    ensure_rooms(url, key, all_codes)

    inserted = replace_courses(url, key, all_rows)
    print(f"[done] courses 테이블 교체 완료 -{inserted}건 적재 ({len(all_codes)}개 강의실 참조)")


if __name__ == "__main__":
    main()
