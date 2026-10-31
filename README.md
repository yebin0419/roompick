# 룸픽 (RoomPick)

경영대 빈 강의실을 실시간으로 Pick하는 통합 웹 서비스. Next.js(App Router) + Supabase + Vercel.

- 상세 기획은 [`PRD.md`](./PRD.md) 참고
- 학생 영역: `/student/*` · 관리자 영역: `/admin/*`

---

## 1. 저장소 구조

```
roompick/
├── PRD.md                           # 프로젝트 요구사항 문서
├── README.md                        # 이 파일
├── web/                             # Next.js 14 (App Router) 앱 — Vercel 배포 대상
│   ├── src/app/                     # 라우트
│   ├── src/lib/                     # Supabase 클라이언트 + 유틸
│   └── middleware.ts                # 역할 기반 접근 제어
├── supabase/migrations/             # 순서대로 실행해야 하는 SQL 마이그레이션
└── scripts/                         # xlsx 시딩 + 관리자 계정 생성 스크립트
```

---

## 2. Supabase 셋업

### 2.1 프로젝트 생성

1. https://supabase.com 에서 신규 프로젝트 생성
2. **Project Settings → API** 에서 아래 값을 복사:
   - `Project URL`
   - `anon` public key
   - `service_role` key (서버 전용, 절대 공개 금지)

### 2.2 마이그레이션 적용

Supabase Dashboard의 **SQL Editor** 에서 다음 파일을 **순서대로** 실행하거나,
`supabase` CLI (`supabase db push`)로 적용합니다.

```
supabase/migrations/
  0001_init.sql          # enums, 테이블 (profiles, rooms, courses, reservations, reports, notifications, system_policies)
  0002_auth_trigger.sql  # auth.users → profiles 자동 생성
  0003_rls.sql           # Row Level Security 정책
  0004_storage.sql       # Storage 버킷(student-cards / checkin-photos / report-photos) + 정책
  0005_rooms_seed.sql    # 강의실 마스터 30건 선적재
```

### 2.3 환경변수

```bash
cp web/.env.local.example web/.env.local
# 아래 값 채우기
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# SUPABASE_SERVICE_ROLE_KEY=...
```

### 2.4 강의 시간표 적재

```bash
pip install openpyxl requests
python scripts/seed_courses.py "개설강좌 목록_*.xlsx"
# → public.courses 테이블에 교시 단위로 적재됨 (수업시간 역산용)
```

필요하면 강의실 데이터를 다시 적재:
```bash
python scripts/seed_rooms.py 충북대학교_경영대_강의실_목록_v2.xlsx
```

### 2.5 관리자/운영진 계정 생성

```bash
python scripts/create_admin.py admin@example.com 'StrongPass!2' "최행정" ADMIN
python scripts/create_admin.py op@example.com    'StrongPass!2' "자리있조" OPERATOR
```

> 학생은 `/login`에서 자체 가입 후 `PENDING → APPROVED`, 관리자/운영진은 사전 생성만 가능.

---

## 3. 로컬 개발

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

사이드 바이 사이드 테스트 (별도 터미널):
```bash
cd web && npm run typecheck
```

---

## 4. Vercel 배포

1. Vercel에 로그인 → **New Project** → 이 저장소 import
2. **Root Directory**: `web` 로 설정 (중요)
3. **Environment Variables** 에 아래 3개 등록:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy

빌드가 성공하면 Supabase **Authentication → URL Configuration** 에서
`Site URL` 과 `Redirect URLs` 에 Vercel 도메인을 등록하세요.

---

## 5. 접속 경로 요약

| 역할 | 진입 | 보호 |
|---|---|---|
| 비회원 | `/` | 랜딩 → `/login` 또는 `/admin/login` |
| STUDENT(PENDING) | `/login` 가입 후 `/student/verify` 로 강제 이동 | 미승인 상태에서 다른 `/student/*` 접근 시 verify로 리다이렉트 |
| STUDENT(APPROVED) | `/student` 대시보드 | 미들웨어가 역할 검증 |
| OPERATOR / ADMIN | `/admin/login` → `/admin` | 학생 계정은 `/admin/*` 접근 시 로그인으로 리다이렉트 |

---

## 6. 핵심 데이터 흐름

```
개설강좌 xlsx
   │ seed_courses.py (교시 매핑 역산)
   ▼
public.courses (room_code, weekday, start_period, end_period)
   │
   │ /student/* 서버 컴포넌트가 조회
   ▼
freeSlotsForDay() 로 (수업 + 기존 예약) 여집합 산출
   ▼
학생: 1분 예약 / 체크인 사진 / 신고
   │
   ▼
운영진: 승인/취소/노쇼/신고 처리
   │
   ▼
행정실: /admin/analytics 로 월·학기 리포트 및 자율조정 정책 세팅
```

---

## 7. 주요 테이블 요약

| 테이블 | 목적 |
|---|---|
| `profiles` | 사용자 역할·학번·학생증 승인 상태 |
| `rooms` | 강의실 마스터 (code 유일) |
| `courses` | 정규 수업 시간표(교시 단위) |
| `reservations` | 학생 예약 / 체크인 / 노쇼 상태 |
| `reports` | 고장·청결·노쇼 신고 |
| `notifications` | 사용자 알림함 |
| `system_policies` | 유예 시간·최대 예약시간 등 자율조정 정책 |

RLS 요지: 학생은 본인 데이터만, OPERATOR/ADMIN은 전체 조회·수정 가능. `system_policies` 쓰기는 ADMIN만.
