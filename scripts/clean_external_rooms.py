"""
외부(개설강좌 참조) 로 자동 생성된 강의실 중 더 이상 어느 강좌에도 참조되지 않는
행을 삭제한다. 운영 전 수동 정리 용도.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import requests


def load_env() -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if v}
    envfile = Path(__file__).resolve().parents[1] / "web" / ".env.local"
    if envfile.exists():
        for line in envfile.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line: continue
            k, v = line.split("=", 1)
            env.setdefault(k.strip(), v.strip())
    return env


def main() -> None:
    env = load_env()
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("env 미설정"); sys.exit(1)

    headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    # 외부로 분류된 모든 강의실 조회
    r = requests.get(
        f"{url.rstrip('/')}/rest/v1/rooms?select=code,room_type&room_type=eq.외부(개설강좌 참조)",
        headers=headers, timeout=30,
    )
    r.raise_for_status()
    external = [row["code"] for row in r.json()]
    if not external:
        print("외부 강의실 없음. 정리할 대상 없음.")
        return

    # 현재 참조하는 코스 조회
    r = requests.get(
        f"{url.rstrip('/')}/rest/v1/courses?select=room_code",
        headers=headers, timeout=30,
    )
    r.raise_for_status()
    referenced = {row["room_code"] for row in r.json() if row.get("room_code")}

    orphans = [c for c in external if c not in referenced]
    if not orphans:
        print(f"외부 강의실 {len(external)}개 모두 코스가 참조 중. 삭제 대상 없음.")
        return

    print(f"고아 외부 강의실 삭제: {orphans}")
    # 하나씩 삭제 (in. 필터 사용)
    codes_filter = ",".join(f'"{c}"' for c in orphans)
    r = requests.delete(
        f"{url.rstrip('/')}/rest/v1/rooms?code=in.({codes_filter})",
        headers={**headers, "Prefer": "return=representation"},
        timeout=30,
    )
    if r.status_code >= 300:
        print("삭제 실패:", r.status_code, r.text[:500]); sys.exit(1)
    print(f"[OK] {len(orphans)}개 삭제 완료")


if __name__ == "__main__":
    main()
