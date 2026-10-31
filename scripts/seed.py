"""
RoomPick 시딩 스크립트

프로젝트 루트의 3개 엑셀 파일을 파싱해 ``supabase/seed.sql`` 을 생성한다.

사용법:
    python scripts/seed.py                 # supabase/seed.sql 생성
    python scripts/seed.py --dry-run       # 파싱 결과만 요약 출력
    python scripts/seed.py --out seed.sql  # 출력 경로 지정

범위 외 강의실(PRD §3.1: N-13 전체·N-14 3~4층)은 자동으로
``in_scope = false`` 로 저장하여 데이터 손실을 막는다.
"""
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

import openpyxl

ROOT = Path(__file__).resolve().parent.parent

# ---------- 상수 ----------

DAY_KO_TO_ENUM = {
    "월": "MON", "화": "TUE", "수": "WED",
    "목": "THU", "금": "FRI", "토": "SAT", "일": "SUN",
}

# 교시 → 시작/종료 시각 (CBNU 통념: 1교시=60분, 09:00 시작, 00교시는 08:00)
PERIOD_TIMES: dict[str, tuple[str, str, str]] = {
    "00": ("08:00", "09:00", "regular"),
    "01": ("09:00", "10:00", "regular"),
    "02": ("10:00", "11:00", "regular"),
    "03": ("11:00", "12:00", "regular"),
    "04": ("12:00", "13:00", "regular"),
    "05": ("13:00", "14:00", "regular"),
    "06": ("14:00", "15:00", "regular"),
    "07": ("15:00", "16:00", "regular"),
    "08": ("16:00", "17:00", "regular"),
    "09": ("17:00", "18:00", "regular"),
    "10": ("18:00", "19:00", "night"),
    "11": ("19:00", "20:00", "night"),
    "12": ("20:00", "21:00", "night"),
    "13": ("21:00", "22:00", "night"),
    # 특별 교시: 운영 데이터만 알고 있고 시간대는 불확정 → NULL 로 저장
    "A3": (None, None, "intensive"),
    "A4": (None, None, "intensive"),
}

ROOM_CODE_RE = re.compile(r"^\s*([A-Z]?N?\d+[A-Za-z0-9\-]*)\s*(?:\(([^)]+)\))?\s*$")
DAY_BLOCK_RE = re.compile(r"^\s*([월화수목금토일])\s+([^\[]+)\[([^\]]+)\]\s*$")

# PRD §3.1 서비스 범위
def is_in_scope(building: str, floor: str | None) -> bool:
    if building == "N-13동":
        return True
    if building == "N-14동" and floor in {"3F", "4F"}:
        return True
    return False


# ---------- 데이터 모델 ----------

@dataclass
class Room:
    code: str
    alt_code: str | None
    building: str
    building_name: str | None
    floor: str | None
    category: str | None
    in_scope: bool
    sort_order: int | None = None


@dataclass
class Course:
    key: tuple[str, str, str]   # (course_code, class_section, source_file)
    name: str
    grade_level: str | None
    requirement_type: str | None
    credits: float | None
    lecture_type: str | None
    professor: str | None
    enrollment: int | None
    capacity: int | None
    attendees: int | None
    source_file: str
    source_row: int
    raw_schedule: str | None
    sessions: list["Session"] = field(default_factory=list)


@dataclass
class Session:
    day: str          # MON/TUE/...
    period: str       # "01" ... "A3"
    room_code: str    # normalized primary code (e.g. "N13-101")


# ---------- 파서 ----------

def _normalize_room_code(raw: str) -> tuple[str, str | None]:
    """`N13-101(59-101)` → ("N13-101", "59-101")."""
    m = ROOM_CODE_RE.match(raw)
    if not m:
        return raw.strip(), None
    primary, alt = m.group(1), m.group(2)
    return primary.strip(), alt.strip() if alt else None


def _parse_floor_from_code(code: str) -> str | None:
    """`N13-301-1` → `3F`.  두번째 토큰의 백단 자리를 층으로 사용."""
    m = re.match(r"^[A-Z]?N?\d+-(\d{3,})", code)
    if not m:
        return None
    return f"{m.group(1)[0]}F"


def _parse_building_from_code(code: str) -> str:
    m = re.match(r"^([A-Z]?N?\d+)", code)
    if not m:
        return "기타"
    prefix = m.group(1)
    if prefix in {"N13", "N-13"}:
        return "N-13동"
    if prefix in {"N14", "N-14"}:
        return "N-14동"
    return f"{prefix}동"


def parse_rooms(path: Path) -> dict[str, Room]:
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active
    rooms: dict[str, Room] = {}

    # 헤더 행 찾기: '번호'로 시작하는 행
    header_row = None
    for i, row in enumerate(ws.iter_rows(values_only=True), start=1):
        if row and any(c == "번호" for c in row if isinstance(c, str)):
            header_row = i
            break
    if header_row is None:
        raise RuntimeError(f"[rooms] '번호' 헤더를 찾지 못했습니다: {path.name}")

    for row in ws.iter_rows(min_row=header_row + 1, values_only=True):
        no, building, building_name, floor, code_cell, category = row[1:7]
        if not isinstance(no, int) or not isinstance(code_cell, str):
            continue
        code, alt = _normalize_room_code(code_cell)
        rooms[code] = Room(
            code=code,
            alt_code=alt,
            building=str(building).strip() if building else _parse_building_from_code(code),
            building_name=str(building_name).strip() if building_name else None,
            floor=str(floor).strip() if floor else None,
            category=str(category).strip() if category else None,
            in_scope=is_in_scope(
                str(building).strip() if building else "",
                str(floor).strip() if floor else None,
            ),
            sort_order=no,
        )
    return rooms


def parse_schedule(cell: str) -> list[tuple[str, str, str]]:
    """
    `강의시간` 셀을 (day_enum, period, room_code) 리스트로 분해.
    여러 요일은 2칸 이상 공백으로 구분된다.
    """
    out: list[tuple[str, str, str]] = []
    for block in re.split(r"\s{2,}", cell.strip()):
        if not block:
            continue
        m = DAY_BLOCK_RE.match(block)
        if not m:
            # 상위에서 경고 출력
            raise ValueError(f"unparsable block: {block!r}")
        day_ko, periods, room_raw = m.groups()
        day_enum = DAY_KO_TO_ENUM[day_ko]
        room_code, _ = _normalize_room_code(room_raw)
        for tok in re.split(r"[\s,]+", periods.strip()):
            if tok:
                out.append((day_enum, tok, room_code))
    return out


def parse_courses(paths: Iterable[Path]) -> tuple[list[Course], list[str]]:
    """
    두 '개설강좌' 엑셀을 파싱해 Course 리스트를 반환.
    두 번째 반환값은 파싱 중 발생한 경고 문자열.
    """
    courses: list[Course] = []
    warnings: list[str] = []
    seen_keys: set[tuple[str, str, str]] = set()

    for p in sorted(paths):
        wb = openpyxl.load_workbook(p, data_only=True)
        ws = wb.active
        for i, row in enumerate(ws.iter_rows(min_row=3, values_only=True), start=3):
            seq = row[0]
            if seq in (None, "") or not isinstance(row[11], str):
                continue
            (seq_v, grade, req_type, course_code, name, section, credits,
             lecture_type, _target, _foreign, professor, schedule,
             _plan, _attach, _book, _lecture_h, _lecture_sv,
             _lab_h, _lab_sv, enroll, cap, attendees) = row

            course_code = str(course_code).strip()
            section = str(section).strip()
            key = (course_code, section, p.name)
            if key in seen_keys:
                warnings.append(f"[dup] {p.name} row{i}: {course_code}-{section}")
                continue
            seen_keys.add(key)

            course = Course(
                key=key,
                name=str(name).strip() if name else "",
                grade_level=str(grade).strip() if grade else None,
                requirement_type=str(req_type).strip() if req_type else None,
                credits=float(credits) if isinstance(credits, (int, float)) else None,
                lecture_type=str(lecture_type).strip() if lecture_type else None,
                professor=str(professor).strip() if professor else None,
                enrollment=int(enroll) if isinstance(enroll, (int, float)) else None,
                capacity=int(cap) if isinstance(cap, (int, float)) else None,
                attendees=int(attendees) if isinstance(attendees, (int, float)) else None,
                source_file=p.name,
                source_row=i,
                raw_schedule=schedule,
            )
            try:
                for day, period, room_code in parse_schedule(schedule):
                    if period not in PERIOD_TIMES:
                        warnings.append(
                            f"[period?] {p.name} row{i}: {course_code}-{section} unknown={period!r}"
                        )
                        continue
                    course.sessions.append(Session(day, period, room_code))
            except ValueError as e:
                warnings.append(f"[schedule] {p.name} row{i}: {e}")

            courses.append(course)
    return courses, warnings


# ---------- SQL 직렬화 ----------

def sql_quote(v) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def build_sql(rooms: dict[str, Room], courses: list[Course]) -> str:
    lines: list[str] = []
    lines.append("-- Auto-generated by scripts/seed.py — do not edit by hand.")
    lines.append("-- Run against the schema in supabase/migrations/0001_init.sql")
    lines.append("")
    lines.append("begin;")
    lines.append("")

    # periods
    lines.append("-- ===== periods =====")
    lines.append("insert into periods (code, start_time, end_time, kind, sort_order) values")
    period_rows: list[str] = []
    for i, (code, (start, end, kind)) in enumerate(PERIOD_TIMES.items()):
        period_rows.append(
            f"  ({sql_quote(code)}, {sql_quote(start)}, {sql_quote(end)}, "
            f"{sql_quote(kind)}, {i})"
        )
    lines.append(",\n".join(period_rows))
    lines.append("on conflict (code) do update set "
                 "start_time = excluded.start_time, "
                 "end_time = excluded.end_time, "
                 "kind = excluded.kind, "
                 "sort_order = excluded.sort_order;")
    lines.append("")

    # rooms: 공식 목록 + 강의 데이터에서 발견된 외부 강의실 모두 포함
    lines.append("-- ===== rooms =====")
    lines.append(
        "insert into rooms (code, alt_code, building, building_name, floor, "
        "category, in_scope, sort_order) values"
    )
    room_rows: list[str] = []
    for r in rooms.values():
        room_rows.append(
            "  ("
            f"{sql_quote(r.code)}, {sql_quote(r.alt_code)}, {sql_quote(r.building)}, "
            f"{sql_quote(r.building_name)}, {sql_quote(r.floor)}, {sql_quote(r.category)}, "
            f"{sql_quote(r.in_scope)}, {sql_quote(r.sort_order)}"
            ")"
        )
    lines.append(",\n".join(room_rows))
    lines.append("on conflict (code) do update set "
                 "alt_code = excluded.alt_code, "
                 "building = excluded.building, "
                 "building_name = excluded.building_name, "
                 "floor = excluded.floor, "
                 "category = excluded.category, "
                 "in_scope = excluded.in_scope, "
                 "sort_order = excluded.sort_order;")
    lines.append("")

    # courses + sessions
    lines.append("-- ===== courses & course_sessions =====")
    lines.append("-- 각 코스는 (course_code, class_section, source_file)로 upsert")

    for c in courses:
        cc, sec, src = c.key
        lines.append("with upsert as (")
        lines.append("  insert into courses (")
        lines.append("    course_code, class_section, name, grade_level, requirement_type,")
        lines.append("    credits, lecture_type, professor, enrollment, capacity, attendees,")
        lines.append("    source_file, source_row, raw_schedule")
        lines.append("  ) values (")
        lines.append(
            "    "
            + ", ".join(sql_quote(v) for v in (
                cc, sec, c.name, c.grade_level, c.requirement_type,
                c.credits, c.lecture_type, c.professor,
                c.enrollment, c.capacity, c.attendees,
                c.source_file, c.source_row, c.raw_schedule,
            ))
        )
        lines.append("  )")
        lines.append("  on conflict (course_code, class_section, source_file) do update set")
        lines.append("    name = excluded.name,")
        lines.append("    grade_level = excluded.grade_level,")
        lines.append("    requirement_type = excluded.requirement_type,")
        lines.append("    credits = excluded.credits,")
        lines.append("    lecture_type = excluded.lecture_type,")
        lines.append("    professor = excluded.professor,")
        lines.append("    enrollment = excluded.enrollment,")
        lines.append("    capacity = excluded.capacity,")
        lines.append("    attendees = excluded.attendees,")
        lines.append("    source_row = excluded.source_row,")
        lines.append("    raw_schedule = excluded.raw_schedule")
        lines.append("  returning id")
        lines.append(")")
        if c.sessions:
            lines.append(
                "insert into course_sessions (course_id, day, period_code, room_code)"
            )
            lines.append("select upsert.id, v.day::day_of_week, v.period, v.room from upsert,")
            lines.append("(values")
            session_rows = ",\n".join(
                f"  ({sql_quote(s.day)}, {sql_quote(s.period)}, {sql_quote(s.room_code)})"
                for s in c.sessions
            )
            lines.append(session_rows)
            lines.append(") as v(day, period, room)")
            lines.append(
                "on conflict (course_id, day, period_code, room_code) do nothing;"
            )
        else:
            lines.append("select * from upsert;  -- 세션 없음")
        lines.append("")

    lines.append("commit;")
    return "\n".join(lines)


# ---------- main ----------

def _summarize(rooms: dict[str, Room], courses: list[Course], warnings: list[str]) -> None:
    sessions = sum(len(c.sessions) for c in courses)
    in_scope_rooms = sum(1 for r in rooms.values() if r.in_scope)
    print(f"rooms:            {len(rooms)} (in_scope={in_scope_rooms})")
    print(f"courses:          {len(courses)}")
    print(f"course_sessions:  {sessions}")
    print(f"warnings:         {len(warnings)}")
    for w in warnings[:20]:
        print("  -", w)
    if len(warnings) > 20:
        print(f"  ... (+{len(warnings) - 20} more)")


def main() -> int:
    parser = argparse.ArgumentParser(description="RoomPick seed generator")
    parser.add_argument("--out", default=str(ROOT / "supabase" / "seed.sql"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    sys.stdout.reconfigure(encoding="utf-8")

    room_file = next(ROOT.glob("*강의실*.xlsx"), None)
    course_files = list(ROOT.glob("개설강좌*.xlsx"))
    if room_file is None or not course_files:
        print("[error] 엑셀 파일을 찾지 못했습니다.", file=sys.stderr)
        return 1

    rooms = parse_rooms(room_file)
    courses, warnings = parse_courses(course_files)

    # 강의 데이터에만 등장한 외부 강의실 보강
    for c in courses:
        for s in c.sessions:
            if s.room_code not in rooms:
                building = _parse_building_from_code(s.room_code)
                floor = _parse_floor_from_code(s.room_code)
                rooms[s.room_code] = Room(
                    code=s.room_code,
                    alt_code=None,
                    building=building,
                    building_name=None,
                    floor=floor,
                    category=None,
                    in_scope=is_in_scope(building, floor),
                )

    _summarize(rooms, courses, warnings)

    if args.dry_run:
        return 0

    sql = build_sql(rooms, courses)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(sql, encoding="utf-8")
    print(f"\n→ {out_path.relative_to(ROOT)} ({len(sql):,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
