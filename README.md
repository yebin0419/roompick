# 룸픽 (RoomPick)

PRD는 `PRD.md`, QA 체크리스트는 `E2E.md` 참조.

## 로컬 실행 흐름

### 1. Supabase 세팅
Supabase 클라우드 프로젝트 생성 후 SQL Editor 에서 **순서대로** 실행:
1. `supabase/migrations/0001_init.sql` — 스키마 + RLS
2. `supabase/migrations/0002_storage.sql` — 학생증 Storage 버킷·정책
3. `supabase/migrations/0003_profile_trigger.sql` — 회원가입 시 profiles row 자동 생성 트리거
4. `supabase/migrations/0004_reservations.sql` — 예약 테이블 + 분기 트리거 + RLS
5. `supabase/migrations/0005_check_in.sql` — 체크인 컬럼·버킷·`check_in` RPC·`mark_no_shows` 유틸
6. `supabase/migrations/0006_reports.sql` — 신고 테이블·버킷·RLS
7. `supabase/migrations/0007_report_views.sql` — `room_weekly_utilization` 뷰 (유휴율 리포트용)
8. `supabase/migrations/0008_policy.sql` — 자율 정책 테이블·함수. 기존 `check_in` RPC / 예약 트리거를 정책 함수 기반으로 교체
9. `supabase/migrations/0009_notifications.sql` — `push_tokens`·`notifications` 테이블, Expo Push 트리거(`pg_net`), 종료 10분 전 리마인더 함수
10. `supabase/migrations/0010_cron.sql` — `pg_cron` 스케줄: 노쇼 15분, 종료 임박 1분. `mark_no_shows()` 에 노쇼 알림 전송 추가
11. `supabase/migrations/0011_monthly_views.sql` — 월간 추이 뷰 (예약·신고 월별 집계)
12. `supabase/migrations/0012_operations_reports.sql` — 운영 리포트 아카이브 테이블 + 자동 생성 RPC(`generate_operations_report`)
13. `supabase/migrations/0013_preferences.sql` — 맞춤 빈자리 알림 (student_preferences + CANCELLED 매칭 트리거)
14. `supabase/migrations/0014_staff_notifications.sql` — 운영진 인앱 알림(학생증 제출/예약 PENDING/신고 OPEN 트리거)
15. `supabase/seed.sql` — 강의실/개설강좌 시딩 (`scripts/seed.py` 로 재생성)

> **extensions 활성화 필수:** Supabase Dashboard → Database → Extensions 에서 **`pg_net`** (푸시 전송) 과 **`pg_cron`** (스케줄링) 을 ON으로.
> cron 모니터링: `select * from cron.job_run_details order by start_time desc limit 20;`
>
> **Realtime 활성화:** Dashboard → Database → Replication 에서 `notifications` (운영진 뱃지)·`reservations`·`profiles` 테이블을 publication 에 추가. 모바일·웹 양쪽에서 Realtime 구독이 작동.

> **Geofence 좌표:** `0005_check_in.sql` 의 `is_within_campus()` 와 `mobile/src/lib/geofence.ts` 는 동일한 상수를 사용합니다. 운영팀 실측치로 바꿀 때는 **양쪽을 함께** 수정하세요.

### 2. 운영진·행정실 계정 사전 발급 (PRD §2.2)
```powershell
$env:SUPABASE_URL = "https://<proj>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."
node scripts/create_staff.mjs ops@example.com 'Tmp!1234' OPERATOR '김운영'
node scripts/create_staff.mjs admin@example.com 'Tmp!1234' ADMIN '최행정'
```

### 3. 관리자 웹 실행 (`web/`)
```powershell
cd web
Copy-Item .env.local.example .env.local
# .env.local 에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 입력
npm run dev
```
- http://localhost:3000 접속 → `/login` 리다이렉션
- OPERATOR 로그인 → `/admin/students` (학생증 승인함)
- ADMIN 로그인 → `/admin/dashboard`

### 4. 학생 모바일 앱 실행 (`mobile/`)
```powershell
cd mobile
Copy-Item .env.example .env
# .env 에 EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY 입력
npm start                 # Expo Dev Server, QR 코드로 Expo Go 접속
# 또는: npx expo start
```
플로우: 회원가입(이메일/비밀번호/이름/학번) → 학생증 사진 제출 → `PENDING` → 운영진이 웹에서 승인 → 자동 전환(Realtime) → `(tabs)` 홈(빈 강의실).

> 카메라/앨범 권한이 필요합니다. iOS Simulator 는 카메라가 없으므로 실기기 또는 Android 에뮬레이터 권장.

### 4-1. 프로덕션 빌드 (EAS Build)
Expo Go 로는 테스트까지만 가능. 앱 스토어 배포·커스텀 네이티브 모듈·production push 발급은 **EAS Build** 가 필요합니다.

```powershell
cd mobile
npm i -g eas-cli
eas login
eas init                   # 프로젝트 생성 → app.json에 extra.eas.projectId 자동 주입
eas build:configure
eas build --platform ios --profile development
eas build --platform android --profile development
```

이후 `mobile/src/lib/push.ts` 가 `Constants.expoConfig?.extra?.eas?.projectId` 를 자동으로 읽어 production push token 을 발급합니다.

**bundle 식별자:** `app.json` 에 `ios.bundleIdentifier = ac.chungbuk.roompick`, `android.package = ac.chungbuk.roompick` 로 설정됨. 실제 배포 시 조직 명칭으로 교체하세요.

**이미 설정된 플러그인:** expo-router / expo-notifications / expo-image-picker / expo-location. 각 플러그인의 iOS 권한 문구는 `app.json → ios.infoPlist`, Android 권한은 `android.permissions` 에 선언되어 있어 스토어 심사 때 그대로 제출됩니다.

### 5. 시딩 재생성
```powershell
python scripts/seed.py            # supabase/seed.sql 재생성
python scripts/seed.py --dry-run  # 파싱 결과만 요약
```

## 디렉토리
```
roompick/
├── PRD.md
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init.sql
│   │   ├── 0002_storage.sql
│   │   ├── 0003_profile_trigger.sql
│   │   ├── 0004_reservations.sql
│   │   ├── 0005_check_in.sql
│   │   ├── 0006_reports.sql
│   │   ├── 0007_report_views.sql
│   │   ├── 0008_policy.sql
│   │   ├── 0009_notifications.sql
│   │   ├── 0010_cron.sql
│   │   ├── 0011_monthly_views.sql
│   │   ├── 0012_operations_reports.sql
│   │   ├── 0013_preferences.sql
│   │   └── 0014_staff_notifications.sql
│   └── seed.sql
├── scripts/
│   ├── seed.py              # 엑셀 → seed.sql
│   ├── create_staff.mjs     # 운영진/행정실 Admin API 발급
│   └── inspect_*.py
├── web/                     # Next.js 16 관리자 대시보드
│   └── src/app/{login,admin/{notifications,students/[id],reservations/[id],reports/[id],rooms,dashboard,analytics,policy}}
└── mobile/                  # Expo 학생 앱 (Expo Router + Supabase)
    ├── app/
    │   ├── _layout.tsx          # AuthProvider + Stack
    │   ├── index.tsx            # 라우팅 게이트 (세션·승인상태 기반)
    │   ├── (auth)/{sign-in,sign-up,verify}.tsx
    │   ├── (gate)/{pending,rejected}.tsx
    │   ├── (tabs)/
    │   │   ├── index.tsx
    │   │   ├── reservations/{_layout,index,[id]}.tsx   # 리스트 + 상세
    │   │   ├── reports.tsx
    │   │   └── profile.tsx
    │   ├── reserve.tsx          # 예약 생성 폼 (push 네비게이션)
    │   ├── check-in.tsx         # GPS → 라이브 카메라 → RPC 체크인
    │   ├── report-new.tsx       # 신고 작성 (카테고리/강의실/설명/사진)
    │   ├── notifications.tsx    # 인앱 알림 센터 (Realtime 구독)
    │   └── preferences.tsx      # 맞춤 빈자리 알림 설정 (선호 강의실·교시)
    └── src/{lib,providers,theme}
```

## PRD §1~6 전 범위 MVP 커버 완료
