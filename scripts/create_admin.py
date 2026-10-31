"""
관리자/운영진 계정 생성 (service_role 사용).

사용법:
    python scripts/create_admin.py admin@example.com 'StrongPass!2' "최행정" ADMIN
    python scripts/create_admin.py op@example.com 'StrongPass!2' "운영진" OPERATOR
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
    if len(sys.argv) < 5:
        print("usage: python scripts/create_admin.py <email> <password> <name> <ADMIN|OPERATOR>")
        print("       (3번째·4번째 인자 순서는 자유 — ADMIN/OPERATOR 토큰을 role로 자동 감지)")
        sys.exit(1)
    email, password, a3, a4 = sys.argv[1:5]
    if a3 in ("ADMIN", "OPERATOR"):
        role, name = a3, a4
    elif a4 in ("ADMIN", "OPERATOR"):
        role, name = a4, a3
    else:
        print("role must be ADMIN or OPERATOR"); sys.exit(1)

    env = load_env()
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("env 미설정"); sys.exit(1)

    headers = {
        "apikey": key, "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    # 1) auth 사용자 생성
    r = requests.post(
        f"{url.rstrip('/')}/auth/v1/admin/users",
        json={"email": email, "password": password, "email_confirm": True,
              "user_metadata": {"name": name}},
        headers=headers, timeout=30,
    )
    if r.status_code >= 300:
        print("auth create error:", r.status_code, r.text[:500]); sys.exit(1)
    user = r.json()
    uid = user["id"]
    print(f"auth user created: {uid}")

    # 2) profiles 보정 (handle_new_user 트리거가 넣은 레코드에 role/approval 덮어쓰기)
    r = requests.patch(
        f"{url.rstrip('/')}/rest/v1/profiles?id=eq.{uid}",
        json={"role": role, "approval_status": "APPROVED", "name": name},
        headers={**headers, "Prefer": "return=minimal"},
        timeout=30,
    )
    if r.status_code >= 300:
        print("profile update error:", r.status_code, r.text[:500]); sys.exit(1)
    print(f"profile 설정 완료: {email} ({role})")


if __name__ == "__main__":
    main()
