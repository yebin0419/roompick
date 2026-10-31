# 룸픽 (RoomPick) PRD

## 1. 프로젝트 개요 및 추진 목적

- **서비스명**: 룸픽 (RoomPick)
- **한 줄 정의**: 경영대 학생 및 교직원이 비어 있는 강의실을 실시간으로 확인 및 선택(Pick)하고, 팀플·스터디·행사 용도로 간편하게 예약·공유하는 데이터 기반 공간 플랫폼
- **통합 아키텍처 방향**: Vercel 단일 배포 환경 내에서 학생 웹 서비스(`/student`)와 관리자 웹 서비스(`/admin`)를 통합 운영하여 접근성과 유지보수성을 극대화

### 핵심 가치 (수익 모델 대체)

- **데이터 교차 분석**: '시간표 역산 정량 데이터'와 '실제 사용자 이용·체크인 사진·신고 기록'을 교차 분석
- **행정실 운영 리포트**: 행정실에 '월간/학기말 강의실 운영 리포트'를 자동 제공하여 데이터 기반 공간 재배치 및 시설 투자 의사결정 지원
- **Self-Optimizing 선순환 루프**: 축적된 데이터를 활용해 스스로 정책 규칙(유예시간, 최대 예약시간)을 조정하고 사용자 맞춤 빈자리 알림 제공

---

## 2. 사용자 역할 및 권한 정의 (RBAC)

회원가입 후 학생증 승인 상태(`PENDING ➔ APPROVED`)에 따라 사용자 역할이 자동 구별되며, 역할에 따라 접속 화면과 데이터 접근 권한이 엄격히 분리됩니다.

| 구분 | 일반 학생 (STUDENT) | 운영진 (OPERATOR / 자리있조) | 행정실 (ADMIN / 정책 소유자) |
|---|---|---|---|
| **인증 방식** | 웹 자체 ID/PW 가입 + 학생증 사진 1회 제출 및 승인 | 사전 발급/등록된 계정 로그인 (`/admin/login`) | 사전 발급/등록된 계정 로그인 (`/admin/login`) |
| **접속 환경** | 룸픽 웹 서비스 (`/student`) — 모바일/PC 브라우저 반응형 | 룸픽 웹 관리자 대시보드 (`/admin`) | 룸픽 웹 관리자 대시보드 (`/admin`) |
| **계정 생명주기** | 회원가입 ➔ `PENDING`(승인대기) ➔ 승인 후 `APPROVED` 활성화 | 사전 생성 및 권한 부여 완료 계정 | 사전 생성 및 권한 부여 완료 계정 |
| **주요 권한** | - 실시간 빈 강의실 검색<br>- 소규모 1분 빠른 예약<br>- 사진 첨부 기반 체크인<br>- 고장/청결 신고 | - 학생증 제출 사진 확인 및 승인<br>- 소규모 일상 예약 승인/거절<br>- 실시간 이용 모니터링<br>- 체크인 사진/신고 건 처리 | - 대규모/행사 예약 최종 승인<br>- '강의실 운영 리포트' 수신<br>- 노쇼/유예시간 정책 최종 변경<br>- 전체 시스템 통계 제어 |
| **데이터 보안** | 본인의 예약/신고 내역만 수정 | 전체 예약/신고/승인 대기 조회 | 전체 시스템 통계 및 정책 제어 |

---

## 3. 원천 데이터 및 코어 엔진 알고리즘

### 3.1 입력 원천 데이터 (Source Data)

- **개설강좌 목록.xlsx (2종)**: 과목명, 담당교수, 수강인원, 정규 수업시간(화01,02 / 목03 등) 파싱 데이터
- **충북대학교_경영대_강의실_목록_v2.xlsx**: N-13동(1~5층) 및 N-14동(3~4층) 강의실 코드(`N13-호수`, `N14-호수`), 건물명, 층수, 강의실 구분 마스터 데이터

### 3.2 교시-시간 매핑 및 역산 규칙 (Core Time Logic)

- **시간 단위 규칙**: 1교시 = 60분 (09:00 시작)

| 교시 | 시간 | 교시 | 시간 | 교시 | 시간 |
|---|---|---|---|---|---|
| 01교시 | 09:00~10:00 | 04교시 | 12:00~13:00 | 07교시 | 15:00~16:00 |
| 02교시 | 10:00~11:00 | 05교시 | 13:00~14:00 | 08교시 | 16:00~17:00 |
| 03교시 | 11:00~12:00 | 06교시 | 14:00~15:00 | 09교시 | 17:00~18:00 |

- **역산 알고리즘**: 전체 운용 시간(09:00~18:00) 중 정규 수업 및 등록된 행사의 '여집합(Complement)'을 계산하여 30분/1시간 단위의 예약 가능 슬롯으로 자동 전환

### 3.3 데이터 체계화 루프 (System Core Engine)

```
[1. 탐색] 개설강좌.xlsx 파싱 ──► 교시 매핑(화01=09:00~10:00) ──► 빈 공간(유휴 슬롯) 역산
   ↓
[2. 생산] 강의실 목록 v2 메타데이터 결합 ──► 30분/1시간 예약 가능 슬롯 구조화
   ↓
[3. 발행] Vercel + Supabase Realtime으로 룸픽 웹/앱에 실시간 상태 노출 및 알림
   ↓
[4. 분석] (시간표 역산 데이터) ✕ (예약/체크인 사진/노쇼 기록) ✕ (신고/피드백) 교차 분석
   ↓
[5. 개선] ├─► [행정실] '강의실 운영 리포트' 자동 생성 (공간 분할/시설 투자 제안)
         ├─► [사용자] 맞춤 빈자리 추천 및 혼잡도 예측 알림
         └─► [시스템] 노쇼율에 따른 체크인 유예시간 & 최대 예약시간 자율 조정
```

---

## 4. 단일 웹 서비스 아키텍처 및 접속 경로

```
[ 단일 웹 서비스 구조 (web/) ]
├── /                    : 메인 랜딩 페이지 (학생/관리자 안내)
├── /login               : 학생 전용 로그인/회원가입 페이지 (하단에 관리자 로그인 링크 제공)
├── /student/            : 학생 전용 웹 서비스 (하단 탭 레이아웃)
│   ├── /verify          : 학생증/재학증명서 업로드 및 승인 요청 (Storage 연동)
│   ├── page.tsx         : 메인 대시보드 (예약 현황, 빠른 빈 강의실 조회)
│   ├── /reserve         : 강의실 목록 조회 및 실시간 예약 신청 (1분 자동 승인 / 행사 수동 승인)
│   ├── /check-in        : GPS Geofencing + 실시간 카메라 사진 첨부 입실 처리
│   ├── /reports         : 시설 고장 및 노쇼 신고
│   ├── /notifications   : 개인 알림함
│   └── /preferences     : 마이페이지 및 개인 설정
└── /admin/              : 관리자(행정실/운영진) 대시보드
    ├── /login           : 관리자 전용 로그인 페이지 (역할 및 승인 상태 자동 검증)
    ├── page.tsx         : 관리자 메인 대시보드 및 실시간 이용 모니터링
    ├── /verifications   : 학생증 제출 사진 확인 및 승인/반려 관리
    ├── /reservations    : 전체 예약 현황 및 강제 취소 관리
    ├── /reports         : 고장/노쇼 신고 내역 처리 및 피드백
    └── /analytics       : 행정실 전용 '강의실 운영 리포트' 및 자율 조정 정책 엔진 설정
```

---

## 5. 세부 인증 및 접근 권한 프로세스

### 5.1 일반 학생 (STUDENT) 회원가입 및 승인 흐름

1. **회원가입 (`/login`)**: 아이디(이메일), 비밀번호, 이름, 학번을 입력하여 가입
2. **학생증 제출 (`/student/verify`)**: 가입 완료 직후 강제 이동되어 모바일/실물 학생증 사진 1장 업로드 (`student-cards` 버킷 저장)
3. **승인 대기 (`PENDING`)**: 계정 상태가 `PENDING`으로 설정되며 승인 대기 카드 안내 화면 노출 (예약/체크인 제한)
4. **운영진 승인 (`APPROVED`)**: 운영진이 `/admin/verifications`에서 학번과 제출 사진을 대조 후 `APPROVED`로 변경 시, `/student` 메인 대시보드로 접속 허용 및 전체 기능 이용 가능

### 5.2 행정실 (ADMIN) 및 운영진 (OPERATOR) 로그인 흐름

1. **사전 계정 발급**: 서비스 회원가입을 거치지 않으며, 개발/운영팀이 사전 등록(대시보드 또는 SQL/스크립트)으로 계정 발급 (`role = 'ADMIN' | 'OPERATOR'`, `approval_status = 'APPROVED'`)
2. **관리자 전용 로그인 (`/admin/login`)**: 관리자 전용 로그인 URL 접속 후 로그인
3. **Role 검증 및 자동 리다이렉션**: Supabase Auth 및 Next.js Middleware가 `role` 권한을 검증하여 `/admin` 관리자 대시보드로 즉시 이동
4. **권한 보안 (RLS)**: `STUDENT` 계정이나 미승인 계정이 `/admin` 하위 URL 직접 접근 시 즉시 차단 후 로그인 화면으로 리다이렉트

---

## 6. 데이터베이스 및 스토리지 구조

### 6.1 Supabase Tables

**`profiles`** — 사용자 정보 및 권한
- `id` (UUID, Auth 참조), `email`, `name`, `student_id`
- `role` (`STUDENT`, `OPERATOR`, `ADMIN`)
- `approval_status` (`PENDING`, `APPROVED`, `REJECTED`)
- `student_card_url`

**`rooms`** — 강의실 마스터 데이터
- `id`, `building` (N-13, N-14), `room_number`, `floor`, `capacity`
- `features` (빔프로젝터, 콘센트 등), `is_available`

**`reservations`** — 예약 정보
- `id`, `user_id`, `room_id`, `start_time`, `end_time`, `purpose`
- `status` (`RESERVED`, `CHECKED_IN`, `CANCELLED`, `COMPLETED`, `NO_SHOW`)

**`reports`** — 신고 내역
- `id`, `reporter_id`, `room_id`
- `category` (`NO_SHOW`, `BROKEN_EQUIPMENT`, `CLEANLINESS`)
- `content`, `photo_url`, `status`

### 6.2 Supabase Storage

- **`student-cards`** (Public): 학생증 제출 사진 저장 및 보안 관리
- **`checkin-photos`** (Public): GPS+실시간 인증 제출 사진 저장
- **`report-photos`** (Public): 비품 고장/청결 신고 사진 저장
- **RLS Policies**: `authenticated` 사용자 대상 업로드(INSERT) 및 조회(SELECT) 권한 부여

---

## 7. 세팅 및 초기화 실행 가이드

### 1단계. 환경변수 세팅 (`web/.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://supybwqpwoijwnfqkltj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 2단계. Supabase Storage & RLS 쿼리 실행 (SQL Editor)

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-cards', 'student-cards', true),
       ('checkin-photos', 'checkin-photos', true),
       ('report-photos', 'report-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow authenticated upload student-cards" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'student-cards');

CREATE POLICY "Allow authenticated select student-cards" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'student-cards');
```

### 3단계. 최초 관리자 계정 사전 생성 (최초 1회)

Supabase Dashboard: **Authentication ➔ Users**에서 계정 생성 후, SQL Editor에서 아래 SQL 실행:

```sql
INSERT INTO public.profiles (id, email, name, role, approval_status)
VALUES (
  '생성된_USER_UID',
  'admin@example.com',
  '최행정',
  'ADMIN',
  'APPROVED'
);
```
