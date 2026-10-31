-- 룸픽: 핵심 스키마
-- 역할·강의실·예약·신고·강좌·알림·정책

create extension if not exists pgcrypto;

-- -----------------------------------------------------------
-- enums
-- -----------------------------------------------------------
do $$ begin
  create type user_role as enum ('STUDENT', 'OPERATOR', 'ADMIN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type approval_status as enum ('PENDING', 'APPROVED', 'REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reservation_status as enum (
    'RESERVED', 'CHECKED_IN', 'CANCELLED', 'COMPLETED', 'NO_SHOW'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_category as enum (
    'NO_SHOW', 'BROKEN_EQUIPMENT', 'CLEANLINESS', 'OTHER'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_status as enum ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------
-- profiles
-- -----------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  student_id text,
  role user_role not null default 'STUDENT',
  approval_status approval_status not null default 'PENDING',
  student_card_url text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_profiles_approval on public.profiles (approval_status);

-- -----------------------------------------------------------
-- rooms
-- -----------------------------------------------------------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  building text not null,
  building_name text,
  floor text,
  capacity int,
  features text[] default '{}',
  room_type text,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_rooms_building on public.rooms (building);

-- -----------------------------------------------------------
-- courses (강의시간표 역산용)
-- -----------------------------------------------------------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  professor text,
  section text,
  room_code text references public.rooms(code) on delete set null,
  weekday int,
  start_period int,
  end_period int,
  raw_time text,
  created_at timestamptz not null default now()
);

create index if not exists idx_courses_room on public.courses (room_code);
create index if not exists idx_courses_weekday on public.courses (weekday);

-- -----------------------------------------------------------
-- reservations
-- -----------------------------------------------------------
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  purpose text,
  status reservation_status not null default 'RESERVED',
  is_event boolean not null default false,
  check_in_photo_url text,
  check_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists idx_reservations_user on public.reservations (user_id);
create index if not exists idx_reservations_room on public.reservations (room_id);
create index if not exists idx_reservations_time on public.reservations (start_time, end_time);
create index if not exists idx_reservations_status on public.reservations (status);

-- -----------------------------------------------------------
-- reports
-- -----------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  reservation_id uuid references public.reservations(id) on delete set null,
  category report_category not null,
  content text not null,
  photo_url text,
  status report_status not null default 'OPEN',
  resolver_id uuid references public.profiles(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reports_reporter on public.reports (reporter_id);
create index if not exists idx_reports_room on public.reports (room_id);
create index if not exists idx_reports_status on public.reports (status);

-- -----------------------------------------------------------
-- notifications
-- -----------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications (user_id, is_read);

-- -----------------------------------------------------------
-- policies (자율조정 정책값)
-- -----------------------------------------------------------
create table if not exists public.system_policies (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

insert into public.system_policies (key, value, description)
values
  ('check_in_grace_minutes', '10'::jsonb, '예약 시작 후 체크인 유예시간(분)'),
  ('max_reservation_hours', '2'::jsonb, '학생 1회 최대 예약 시간(시간)'),
  ('geofence_radius_m', '80'::jsonb, '체크인 Geofencing 반경(m)')
on conflict (key) do nothing;

-- -----------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_reservations_updated on public.reservations;
create trigger trg_reservations_updated before update on public.reservations
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_reports_updated on public.reports;
create trigger trg_reports_updated before update on public.reports
  for each row execute function public.touch_updated_at();
