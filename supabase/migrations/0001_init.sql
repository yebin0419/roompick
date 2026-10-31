-- RoomPick 초기 스키마
-- PRD §2.3 (profiles / RLS) + §3.1-3.2 (강의실 / 개설강좌 / 교시) 반영

create extension if not exists "uuid-ossp";

-- ===== Enums =====
do $$ begin
  create type user_role as enum ('STUDENT', 'OPERATOR', 'ADMIN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type approval_status as enum ('PENDING', 'APPROVED', 'REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type day_of_week as enum ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');
exception when duplicate_object then null; end $$;

-- ===== profiles (RBAC) =====
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'STUDENT',
  approval_status approval_status not null default 'PENDING',
  student_number text,
  name text,
  student_id_card_url text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  rejected_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operator_admin_requires_approval
    check (role = 'STUDENT' or approval_status = 'APPROVED')
);

create index if not exists profiles_role_idx on profiles(role);
create index if not exists profiles_approval_idx on profiles(approval_status);

-- ===== 교시 마스터 =====
-- 1교시 = 60분 (09:00 시작). 00/10-13교시는 야간/보강 슬롯, A3/A4는 특별 교시(시간 미정).
create table if not exists periods (
  code text primary key,
  start_time time,
  end_time time,
  kind text not null default 'regular',  -- regular | night | intensive
  sort_order smallint not null
);

-- ===== 강의실 =====
create table if not exists rooms (
  code text primary key,                 -- N13-101
  alt_code text,                         -- 59-101
  building text not null,                -- N-13동 | N-14동 | 기타
  building_name text,                    -- 경영대학 | 인문사회관
  floor text,                            -- 1F ~ 5F
  category text,                         -- 강의실 | 합동강의실 | 멀티미디어실 ...
  in_scope boolean not null default true,-- PRD 서비스 범위(N-13 전체, N-14 3-4층)
  sort_order smallint
);

create index if not exists rooms_building_idx on rooms(building);
create index if not exists rooms_in_scope_idx on rooms(in_scope);

-- ===== 개설강좌 =====
create table if not exists courses (
  id uuid primary key default uuid_generate_v4(),
  course_code text not null,             -- 교과코드
  class_section text not null,           -- 분반
  name text not null,                    -- 교과명
  grade_level text,                      -- 학년 (1학년, 전학년 등)
  requirement_type text,                 -- 이수구분 (전공필수, 교양선택 등)
  credits numeric,
  lecture_type text,                     -- 강의구분
  professor text,                        -- 담당교수
  enrollment smallint,                   -- 신청인원
  capacity smallint,                     -- 수강정원
  attendees smallint,                    -- 수강인원
  source_file text,
  source_row smallint,
  raw_schedule text,                     -- 원본 '강의시간' 문자열 (디버그/감사용)
  created_at timestamptz not null default now(),
  unique (course_code, class_section, source_file)
);

-- ===== 개설강좌 세션 (요일 × 교시 × 강의실 1건) =====
create table if not exists course_sessions (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references courses(id) on delete cascade,
  day day_of_week not null,
  period_code text not null references periods(code),
  room_code text references rooms(code),
  unique (course_id, day, period_code, room_code)
);

create index if not exists course_sessions_room_day_idx
  on course_sessions(room_code, day, period_code);
create index if not exists course_sessions_course_idx
  on course_sessions(course_id);

-- ===== RLS (학생은 승인된 경우만 예약 가능) =====
alter table profiles enable row level security;

drop policy if exists "profiles self read" on profiles;
create policy "profiles self read" on profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles staff read" on profiles;
create policy "profiles staff read" on profiles
  for select using (
    exists (select 1 from profiles p
            where p.id = auth.uid() and p.role in ('OPERATOR', 'ADMIN'))
  );

drop policy if exists "profiles staff update" on profiles;
create policy "profiles staff update" on profiles
  for update using (
    exists (select 1 from profiles p
            where p.id = auth.uid() and p.role in ('OPERATOR', 'ADMIN'))
  );

-- rooms / periods / courses / course_sessions 는 읽기 공개
alter table rooms enable row level security;
alter table periods enable row level security;
alter table courses enable row level security;
alter table course_sessions enable row level security;

drop policy if exists "rooms public read" on rooms;
create policy "rooms public read" on rooms for select using (true);

drop policy if exists "periods public read" on periods;
create policy "periods public read" on periods for select using (true);

drop policy if exists "courses public read" on courses;
create policy "courses public read" on courses for select using (true);

drop policy if exists "sessions public read" on course_sessions;
create policy "sessions public read" on course_sessions for select using (true);
