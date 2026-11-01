"""
개설강좌 xlsx → Supabase public.courses 테이블 시딩.

파일 자동 탐지 경로 (우선순위):
    1. 명령줄 인자로 전달된 경로 (glob 패턴 가능)
    2. scripts/*.xlsx
    3. 프로젝트 루트/*.xlsx
  파일명 패턴은 '개설강좌*목록*.xlsx'

사용법:
    pip install openpyxl requests

    python scripts/seed_courses.py                                              # 자동 탐지
    python scripts/seed_courses.py "scripts/개설강좌 목록_*.xlsx"              # glob
    python scripts/seed_courses.py "개설강좌 목록_20261028233347113930.xlsx"   # 명시

환경변수 (web/.env.local 또는 쉘 환경):
    NEXT_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import glob
import os
import re
import sys
from collections import Counter
from pathlib import Path

import openpyxl
import requests

ROOT = Path(__file__).resolve().parents[1]

WEEKDAYS = {"일": 0, "월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6}
A_PERIOD_RE = re.compile(r"^A(\d+)$")

# 교시 → HH:MM 매핑 (1~13교시, 09:00~22:00)
PERIOD_TO_TIME: dict[int, tuple[str, str]] = {
    i: (f"{8 + i:02d}:00", f"{9 + i:02d}:00") for i in range(1, 14)
}

# 경영대 범위 외 강의실 - 과목이 xlsx에 남아 있어도 적재 대상에서 제외
EXCLUDED_ROOMS = {"N14-703", "N14-704"}

# 일정 토큰 매칭: 요일 + 교시 시퀀스 + [강의실]
# 교시 시퀀스는 공백/콤마/대시/'A접두' 를 유연하게 수용
SCHEDULE_TOKEN_RE = re.compile(
    r"([일월화수목금토])\s*"                                 # 요일
    r"((?:[A-Z]?\d+(?:\s*[-~]\s*[A-Z]?\d+)?\s*,?\s*)+?)"    # 교시(단일/범위, 공백/콤마 모두 허용)
    r"\s*\[\s*([^\]]+?)\s*\]"                                # [강의실]
)

# 강의실 정규화: 'N13-101', 'N13101', 'N13 101', 'n13-101' 등을 'N13-101' 로 통일
ROOM_NORMALIZE_RE = re.compile(r"^\s*(N\d{2})\s*[-\s]?\s*(\d+(?:-\d+)?)", re.IGNORECASE)


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
    files: list[Path] = []
    if argv_patterns:
        for p in argv_patterns:
            files.extend(Path(x) for x in glob.glob(p))
        if not files:
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
                break

    files = [f for f in files if f.exists() and not f.name.startswith("~$")]
    files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
    return files


def normalize_room(raw: str) -> str | None:
    """
    강의실 코드 정규화.
    'N13-101(59-101)' → 'N13-101'
    'N13 101'         → 'N13-101'
    'N13101'          → 'N13-101'
    'N14-301-1'       → 'N14-301-1'
    매칭 실패 시 원본 strip() 반환, 빈 문자열이면 None.
    """
    base = raw.split("(")[0].strip()
    if not base:
        return None
    m = ROOM_NORMALIZE_RE.match(base)
    if m:
        return f"{m.group(1).upper()}-{m.group(2)}"
    return base


def expand_periods(periods_raw: str) -> list[int]:
    """
    교시 문자열을 교시 번호 리스트로 전개.
    지원:
      '01 ,02 ,03' / '01,02,03' / '01 02 03'      → [1,2,3]
      '10-12' / '10~12'                           → [10,11,12]
      'A1'                                        → [1]  (압축교시)
    1~13 외 번호는 자동 skip.
    """
    out: list[int] = []
    # 1) 범위 패턴 먼저 전개: '10-12' or '10 - 12'
    for s, e in re.findall(r"[A-Z]?(\d+)\s*[-~]\s*[A-Z]?(\d+)", periods_raw):
        si, ei = int(s), int(e)
        if si <= ei:
            out.extend(range(si, ei + 1))
    # 2) 단독 번호(범위에 흡수된 것 제외)
    # 범위를 지웠다고 가정하고 나머지 번호 추출
    stripped = re.sub(r"[A-Z]?\d+\s*[-~]\s*[A-Z]?\d+", " ", periods_raw)
    for tok in re.findall(r"[A-Z]?\d+", stripped):
        m = A_PERIOD_RE.match(tok)
        out.append(int(m.group(1)) if m else int(tok))

    return [p for p in out if p in PERIOD_TO_TIME]


def parse_schedule(raw: str) -> tuple[list[dict], str | None]:
    """
    returns (schedules, skip_reason)
    skip_reason: 매칭된 토큰이 하나도 없을 때의 사유 (디버깅용)
    """
    if not raw or not raw.strip():
        return [], "empty"
    matches = SCHEDULE_TOKEN_RE.findall(raw)
    if not matches:
        return [], f"no-schedule-token: {raw[:60]!r}"

    out: list[dict] = []
    for weekday_ko, periods_raw, room in matches:
        periods = expand_periods(periods_raw)
        if not periods:
            continue
        s_p, e_p = min(periods), max(periods)
        room_code = normalize_room(room)
        if not room_code:
            continue
        out.append({
            "weekday": WEEKDAYS[weekday_ko],
            "start_period": s_p,
            "end_period": e_p,
            "start_time": PERIOD_TO_TIME[s_p][0],
            "end_time": PERIOD_TO_TIME[e_p][1],
            "room_code": room_code,
        })
    if not out:
        return [], "parsed-tokens-but-no-valid-period-or-room"
    return out, None


WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"]


def rows_from_xlsx(path: Path, stats: dict) -> list[dict]:
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb[wb.sheetnames[0]]

    rows: list[dict] = []
    sample_log: list[str] = []
    header_seen = False
    total = 0
    data_rows = 0
    with_schedule = 0
    skipped_reasons: Counter[str] = Counter()
    excluded_room_count = 0

    for raw in ws.iter_rows(values_only=True):
        total += 1
        if raw[0] == "순번":
            header_seen = True
            continue
        if not header_seen or not raw[0]:
            continue
        data_rows += 1

        code = str(raw[3] or "").strip()
        name = str(raw[4] or "").strip()
        section = str(raw[5] or "").strip()
        professor = str(raw[10] or "").strip() or None
        schedule_raw = str(raw[11] or "").strip()

        schedules, reason = parse_schedule(schedule_raw)
        if reason:
            skipped_reasons[reason] += 1
            continue
        with_schedule += 1

        for s in schedules:
            if s["room_code"] in EXCLUDED_ROOMS:
                excluded_room_count += 1
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
            if len(sample_log) < 8:
                sample_log.append(
                    f"    {s['room_code']} | {WEEKDAY_KO[s['weekday']]} | "
                    f"{s['start_time']} ~ {s['end_time']}  "
                    f"({name} / {professor or '-'})"
                )

    stats["total_sheet_rows"] = total
    stats["data_rows"] = data_rows
    stats["with_schedule"] = with_schedule
    stats["parsed_periods"] = len(rows)
    stats["excluded_room"] = excluded_room_count
    stats["skipped_reasons"] = dict(skipped_reasons)
    stats["sample_log"] = sample_log
    return rows


def ensure_rooms(url: str, key: str, codes: set[str]) -> None:
    endpoint = f"{url.rstrip('/')}/rest/v1/rooms?select=code"
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    r = requests.get(endpoint, headers=headers, timeout=30)
    r.raise_for_status()
    existing = {row["code"] for row in r.json()}
    missing = sorted(codes - existing)
    if not missing:
        return
    print(f"[rooms] 미등록 강의실 {len(missing)}개 자동 보완: {missing}")
    body = []
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
        body.append({
            "code": code, "building": building, "building_name": bname,
            "room_type": "외부(개설강좌 참조)",
        })
    r = requests.post(
        f"{url.rstrip('/')}/rest/v1/rooms?on_conflict=code",
        json=body,
        headers={**headers, "Content-Type": "application/json",
                 "Prefer": "resolution=merge-duplicates,return=minimal"},
        timeout=30,
    )
    if r.status_code >= 300:
        print("[rooms] upsert error:", r.status_code, r.text[:500])
        sys.exit(1)


def replace_courses(url: str, key: str, rows: list[dict]) -> int:
    headers = {
        "apikey": key, "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    r = requests.delete(
        f"{url.rstrip('/')}/rest/v1/courses?id=not.is.null",
        headers=headers, timeout=30,
    )
    if r.status_code >= 300:
        print("[courses] delete error:", r.status_code, r.text[:500])
        sys.exit(1)
    print("[courses] 기존 데이터 전체 삭제 완료")

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
            print("[courses] insert error:", rr.status_code, rr.text[:500])
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
        print(f"  - {f}")

    all_rows: list[dict] = []
    for f in files:
        stats: dict = {}
        rows = rows_from_xlsx(f, stats)
        print(f"\n[parse] {f.name}")
        print(f"  시트 전체 행수:         {stats['total_sheet_rows']}")
        print(f"  데이터 행 (헤더 제외):   {stats['data_rows']}")
        print(f"  일정 파싱 성공:         {stats['with_schedule']} / {stats['data_rows']}")
        print(f"  적재할 교시 단위 row:   {len(rows)}")
        if stats["excluded_room"]:
            print(f"  경영대 범위 외 제외:    {stats['excluded_room']} (EXCLUDED_ROOMS)")
        if stats["skipped_reasons"]:
            print(f"  skip 사유:")
            for reason, cnt in stats["skipped_reasons"].items():
                print(f"    [{cnt}] {reason}")
        if stats.get("sample_log"):
            print(f"  샘플 변환 결과 (최대 8건):")
            for line in stats["sample_log"]:
                print(line)
        all_rows.extend(rows)

    if not all_rows:
        print("\n[err] 파싱된 과목이 없습니다. 엑셀 포맷을 확인해주세요.")
        sys.exit(1)

    # 완전 중복(code, section, room_code, weekday, start_period, end_period) 제거
    seen: set[tuple] = set()
    deduped: list[dict] = []
    for r in all_rows:
        dedup_key = (r["code"], r.get("section"), r["room_code"], r["weekday"],
                     r["start_period"], r["end_period"])
        if dedup_key in seen:
            continue
        seen.add(dedup_key)
        deduped.append(r)
    dup_count = len(all_rows) - len(deduped)
    if dup_count:
        print(f"\n[dedup] 완전 중복 {dup_count}건 제거 (총 {len(all_rows)}→{len(deduped)})")

    all_codes = {r["room_code"] for r in deduped if r.get("room_code")}
    print(f"\n[rooms] courses 가 참조하는 강의실: {len(all_codes)}개")
    ensure_rooms(url, key, all_codes)

    inserted = replace_courses(url, key, deduped)
    print(f"\n[done] courses 테이블 완전 교체 - {inserted}건 적재 ({len(all_codes)}개 강의실 참조)")


if __name__ == "__main__":
    main()
