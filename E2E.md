# 룸픽 E2E 수동 테스트 체크리스트

PRD §1~6 전 플로우를 사전조건→액션→기대로 검증. 자동화 전까지는 이 문서가 QA 기준.

## 0. 초기 세팅 (한 번만)

- [ ] Supabase 클라우드 프로젝트 생성
- [ ] Dashboard → Database → Extensions 에서 **`pg_net`**, **`pg_cron`** ON
- [ ] SQL Editor 에서 마이그레이션 0001 → 0014 순서대로 실행
- [ ] `supabase/seed.sql` 실행 (강의실 43개 · 개설강좌 177건 삽입 확인)
- [ ] Dashboard → Database → Replication 에서 publication `supabase_realtime` 에 다음 테이블 추가:
  - [ ] `profiles`
  - [ ] `reservations`
  - [ ] `reports`
  - [ ] `notifications`
- [ ] `scripts/create_staff.mjs` 로 OPERATOR 1명, ADMIN 1명 사전 발급
- [ ] `web/.env.local` 작성 (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY)
- [ ] `mobile/.env` 작성 (EXPO_PUBLIC_SUPABASE_URL/ANON_KEY)
- [ ] cron 등록 확인: `select jobname, schedule from cron.job;` 에 `roompick-mark-no-shows` + `roompick-ending-soon` 2건

---

## 1. 역할 가드 (PRD §2.2)

- [ ] 미인증 상태로 `/admin/students` 접근 → `/login?next=/admin/students` 리다이렉션
- [ ] 미인증 상태로 `/admin` 접근 → `/login` 리다이렉션
- [ ] 로그인 성공한 OPERATOR 로 `/admin/dashboard` 접근 → `/admin/students?error=forbidden` 로 튕김
- [ ] 로그인 성공한 ADMIN 으로 `/login` 재접근 → `/admin` 로 리다이렉션
- [ ] 모바일 앱에서 OPERATOR 계정으로 로그인 시도 → `/sign-in?error=staff` 안내 노출
- [ ] 모바일에서 로그아웃 후 보호 라우트 접근 → `/sign-in` 로 돌아감

---

## 2. 학생 가입·학생증 승인 (PRD §2.2 ①, §5.1.1)

### 2.1 가입 플로우
- [ ] 모바일에서 `/sign-up` → 이름/학번/이메일/비밀번호 입력 후 제출
- [ ] Supabase auth.users 에 새 레코드 생성 확인
- [ ] `handle_new_user` 트리거로 profiles 에 `role=STUDENT, approval_status=PENDING` 로 자동 insert
- [ ] 가입 직후 앱은 `/verify` (학생증 제출) 로 이동

### 2.2 학생증 제출
- [ ] 카메라로 촬영 or 앨범에서 선택 → "제출" 탭
- [ ] `student-id-cards/{userId}/card_*.jpg` 로 Storage 업로드
- [ ] `profiles.student_id_card_url` 세팅
- [ ] 자동으로 `/pending` 화면으로 전환

### 2.3 운영진 알림·승인
- [ ] 운영진 웹 사이드바 "알림" 뱃지 1-2초 내 증가 (Realtime)
- [ ] `/admin/students?status=PENDING` 리스트에 신규 항목 자동 추가 (RealtimeRefresher)
- [ ] 알림 클릭 → `/admin/students/{id}` 상세로 이동
- [ ] 큰 학생증 미리보기로 학번↔사진 대조
- [ ] "승인" 클릭 → 학생 앱이 `/pending` → `/(tabs)` 로 **자동 전환** (프로필 Realtime)
- [ ] 뱃지 카운트 1 감소

### 2.4 거절·재제출
- [ ] 다른 PENDING 학생을 사유 입력 후 "거절"
- [ ] 학생 앱이 자동으로 `/rejected` 로 이동, 이전 거절 사유 노출
- [ ] "학생증 다시 제출" → `/verify` 로 → 재제출 → 다시 PENDING
- [ ] 운영진 알림 재발사됨 확인

---

## 3. 예약 플로우 (PRD §5.1.3, §5.2.1)

### 3.1 자동 승인 (QUICK, ≤10명·≤2교시)
- [ ] 승인된 학생 계정으로 홈에서 요일/교시 선택
- [ ] 빈 강의실 카드 탭 → `/reserve` 사전 입력 (room/date/period)
- [ ] 인원 5명, 2교시, 종류=QUICK, 목적 입력 후 제출
- [ ] 폼에 "제출하면 자동 승인됩니다" 녹색 안내 노출
- [ ] insert 성공, 상태 `AUTO_APPROVED`
- [ ] "내 예약" 탭에 즉시 반영 (Realtime)

### 3.2 운영진 승인 대기 (QUICK, 초과)
- [ ] 인원 15명(>10) 으로 QUICK 제출 → 상태 `PENDING_OPERATOR`
- [ ] 운영진 알림 수신 + 사이드바 뱃지 ↑
- [ ] `/admin/reservations?status=PENDING_OPERATOR` 자동 반영
- [ ] 상세에서 "승인" → 학생에게 "예약이 승인되었어요" 푸시 + 상태 → `APPROVED`

### 3.3 행정실 승인 대기 (EVENT)
- [ ] 종류 EVENT 로 제출 → 상태 `PENDING_ADMIN`
- [ ] OPERATOR 사이드바 뱃지에는 반영 (OPERATOR+ADMIN 알림)
- [ ] ADMIN 전용 `/admin/dashboard` 상단 카드에 "대기 N건" 표시
- [ ] 행정실 상세에서 승인 → 학생 앱 Realtime 반영

### 3.4 하드 캡 (자율 정책)
- [ ] ADMIN 이 `/admin/policy` 에서 전역 "최대 예약 교시" = 2 로 설정
- [ ] 학생이 3교시 예약 시도 → 트리거 에러 `"최대 2교시까지만 예약할 수 있습니다"` 노출

### 3.5 충돌 거절
- [ ] 수업이 있는 강의실·교시 선택 시도 → "해당 시간에 수업이 있어 예약할 수 없습니다"
- [ ] 다른 사용자의 승인된 예약과 겹치는 범위 시도 → "해당 시간에 이미 다른 예약이 있습니다"

### 3.6 취소
- [ ] 학생 상세에서 "예약 취소" → 상태 `CANCELLED`
- [ ] 선호자가 있다면 `slot_available` 푸시 발사 (아래 §7 참조)

---

## 4. 체크인 (PRD §5.1.4)

### 4.1 성공 경로
- [ ] 승인된 예약의 시작 ±유예 범위에 접어든 상태 (예약 시작 10분 전~종료 사이)
- [ ] "내 예약" 상세 → "체크인" 버튼 → `/check-in` 진입
- [ ] GPS 권한 승인 → **경영대 범위 안**이면 "강의실 들어왔습니다" 버튼 활성
- [ ] 버튼 → 카메라 열림 (앨범 선택 불가) → 사진 촬영
- [ ] Storage 업로드 (`check-in-photos/{userId}/{reservationId}_*.jpg`)
- [ ] `check_in` RPC 성공, `checked_in_at` 세팅
- [ ] 상세로 복귀 시 체크인 시각·사진 미리보기

### 4.2 실패 경로
- [ ] 범위 밖에서 체크인 시도 → "경영대 범위 안입니다" 표시 안 뜨고 버튼 비활성 (클라)
- [ ] 서버 재검증도 통과 못 함 (가능하면 postman으로 RPC 직접 호출해 재현)
- [ ] 예약 시작 15분 전보다 더 이른 시각에 시도 → "아직 체크인 가능 시간이 아닙니다"
- [ ] 예약 종료 지난 후 시도 → "체크인 가능 시간이 지났습니다"
- [ ] 이미 체크인된 예약 재시도 → "이미 체크인한 예약입니다"

### 4.3 노쇼 자동화 (cron)
- [ ] 승인된 예약을 종료 + 유예(15분) 지나도록 체크인 안 함
- [ ] 다음 `mark_no_shows()` cron 실행 (최대 15분 대기 또는 수동 `select mark_no_shows();`) 후:
  - [ ] `reservations.no_show = true`
  - [ ] `profiles.no_show_count + 1`
  - [ ] 학생에게 "노쇼 1회 적립" 푸시 수신
- [ ] 운영진이 상세에서 학생의 누적 노쇼 뱃지 확인

### 4.4 종료 임박 알림 (cron)
- [ ] 체크인된 예약의 종료 10분 전 범위에서 1분 cron 실행 시 "이용 종료 10분 전" 푸시 수신
- [ ] 재실행 시 중복 발송 안 됨 (`notifications` 테이블 unique check 로)

---

## 5. 신고 (PRD §5.1.5)

- [ ] 승인된 학생이 "신고" 탭 → "+ 새 신고"
- [ ] 카테고리 선택, 강의실 선택, 설명 작성, 사진 첨부(카메라 or 앨범)
- [ ] 제출 → Storage 업로드 + `reports` insert, 상태 `OPEN`
- [ ] 운영진 사이드바 뱃지 ↑, `/admin/reports?status=OPEN` 리스트 자동 추가
- [ ] 상세 → 큰 사진 미리보기 + 설명 + 신고자 메타(누적 노쇼 포함)
- [ ] "처리 시작" → 상태 `IN_PROGRESS`
- [ ] "완료" + 메모 입력 → 상태 `RESOLVED`, 학생 "내 신고" 탭에 처리 메모 노출
- [ ] "반려" + 사유 입력 → 상태 `DISMISSED`

---

## 6. 운영진 Realtime (PRD 운영 품질)

### 6.1 사이드바 뱃지
- [ ] 운영진 창 열어둔 상태로 다른 디바이스에서 새 PENDING 발생 → 뱃지 1-2초 내 증가
- [ ] "모두 읽음" 클릭 → 뱃지 즉시 0

### 6.2 리스트 자동 갱신
- [ ] `/admin/students?status=PENDING` 창 열어둔 상태로 신규 제출 → 리스트에 자동 추가 (새로고침 X)
- [ ] 다른 운영진이 승인 → 해당 항목이 리스트에서 사라짐
- [ ] `/admin/reservations?status=PENDING_OPERATOR`, `/admin/reports?status=OPEN` 동일 확인

### 6.3 다중 운영진 동시성
- [ ] 운영진 A, B가 같은 PENDING 창을 보고 있을 때 A가 승인 → B의 리스트에서도 해당 항목 즉시 제거
- [ ] 운영진 A가 "모두 읽음" 해도 B의 미읽음 카운트는 각자 user_id 기준이므로 독립

---

## 7. 맞춤 빈자리 알림 (PRD §1.1 Self-Optimizing)

- [ ] 승인된 학생 X가 `/preferences` 에서 N13-301, 02-03교시 선호 저장
- [ ] 승인된 학생 Y가 N13-301 **오늘 또는 내일** 02-03교시 예약 생성 (AUTO_APPROVED)
- [ ] Y가 상세에서 "예약 취소" → 상태 `CANCELLED`
- [ ] `reservations_match_cancelled` 트리거 발사 → X에게 "빈자리 알림" 푸시 수신
- [ ] X가 알림 탭 → `/reserve?room=N13-301&date=...&period=02` 폼이 사전 입력된 상태로 열림
- [ ] X가 즉시 예약 완료 가능
- [ ] 본인(Y)에게는 알림 안 감 (self 제외 조건)
- [ ] 범위 밖 날짜(모레 이후) 취소는 알림 발사 안 됨

---

## 8. 자율 정책 조정 (PRD §5.2.3)

- [ ] ADMIN `/admin/policy` 에서 전역 유예시간 15 → 10 분 저장
- [ ] 테스트 체크인에서 유예가 10분 적용되는지 (RPC 에러 메시지 참조)
- [ ] 교시별 override: 특정 교시(예: 06교시) 유예 5분 설정
- [ ] 해당 교시 체크인은 5분, 다른 교시는 전역(10분)
- [ ] 노쇼율 ≥15% 교시가 발생하면 자동 추천 카드 노출, "유예 5분으로 단축" 원클릭 적용

---

## 9. 운영 리포트 (PRD §5.2.2, §1.1)

### 9.1 실시간 analytics
- [ ] ADMIN `/admin/analytics` → KPI 4카드 값 확인 (예약·체크인률·노쇼·미처리 신고)
- [ ] 추이 섹션에서 지표 토글 (예약/체크인률/노쇼/신고) → 6개월 바 차트 변화
- [ ] 유휴율 TOP 10 테이블, 신고 분포, 노쇼 분포 모두 데이터 반영

### 9.2 CSV 다운로드
- [ ] "월간 추이 CSV" 다운로드 → Excel 열어서 한글 깨짐 없는지 (BOM 포함 확인)
- [ ] "유휴율 CSV", "신고/강의실 CSV", "노쇼 CSV" 각각 다운로드

### 9.3 아카이브
- [ ] "리포트 아카이브 →" 바로가기 → `/admin/analytics/archive`
- [ ] 월 지정 후 "리포트 발행" → 상세로 이동
- [ ] KPI 스냅샷 + 자동 추천 4종 (공간/시설/정책/백로그) 노출
- [ ] 행정실 메모 입력 → 저장
- [ ] "발행" 클릭 → 상태 `PUBLISHED`, 메모 읽기 전용
- [ ] "초안으로 되돌리기" → 다시 편집 가능
- [ ] 초안 삭제 가능, 발행된 리포트는 삭제 버튼 안 보임

---

## 10. 보안·RLS (PRD §2.3)

### 10.1 학생 self 제한
- [ ] 학생 A의 세션에서 Supabase 쿼리로 학생 B 프로필 조회 시도 → 결과 없음
- [ ] 학생 A가 B의 reservation 을 CANCELLED 로 UPDATE 시도 → RLS 거부
- [ ] 학생이 자기 reservations.status 를 APPROVED 로 직접 UPDATE 시도 → with_check 거부

### 10.2 Storage 격리
- [ ] 학생 A 세션으로 `student-id-cards/{B_uuid}/...` 다운로드 시도 → 403
- [ ] 학생 A 세션으로 `report-photos/{B_uuid}/...` 다운로드 시도 → 403
- [ ] 운영진 세션으로 모든 학생증·신고 사진 조회 가능

### 10.3 운영진 vs 행정실
- [ ] OPERATOR 가 PENDING_ADMIN 예약 UPDATE 시도 → RLS 로는 가능하나 UX 상 상세에서 액션 노출 X
- [ ] OPERATOR 가 `operations_reports` INSERT/UPDATE 시도 → RLS 거부 (ADMIN 전용)
- [ ] OPERATOR 가 `policy_rules` UPDATE 시도 → RLS 거부
- [ ] OPERATOR 가 `/admin/analytics`, `/admin/policy` 접근 → 사이드바 메뉴 자체가 숨겨짐 + 직접 URL 시 리다이렉션

---

## 11. 백엔드 상태 확인 쿼리

```sql
-- cron 실행 로그
select jobname, status, start_time, return_message
from cron.job_run_details
order by start_time desc limit 20;

-- publication 에 테이블 포함 확인
select tablename from pg_publication_tables
where pubname = 'supabase_realtime';

-- 수동 노쇼 집계 테스트
select public.mark_no_shows();

-- 종료 임박 알림 테스트
select public.send_ending_soon_reminders();

-- 월 리포트 수동 발행 (ADMIN 세션에서)
select public.generate_operations_report('2026-10');
```

---

## 12. 알려진 제약

- Expo Go 에서는 production push 발급 불가 (EAS Build 전환 필요 — README §4-1 참조)
- Geofence 좌표는 `0005_check_in.sql` + `mobile/src/lib/geofence.ts` 하드코딩 — 운영 전 실측 교체
- Supabase Free 플랜의 pg_cron 은 분 단위, pg_net 은 outbound rate 제한 있음
- Supabase Realtime 동시 접속·메시지 제한도 플랜별 상이
