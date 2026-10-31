-- 예약 플로우 (PRD §5.1.3 / §5.2.1)
--   QUICK (≤10명, ≤2교시): 자동 승인
--   QUICK (초과) : 운영진 승인 대기
--   EVENT (대규모·행사): 행정실 승인 대기

-- ===== Enums =====
do $$ begin
  create type reservation_kind as enum ('QUICK', 'EVENT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reservation_status as enum (
    'AUTO_APPROVED',
    'PENDING_OPERATOR',
    'PENDING_ADMIN',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
  );
exception when duplicate_object then null; end $$;

-- ===== 테이블 =====
create table if not exists reservations (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references profiles(id) on delete cascade,
  room_code text not null references rooms(code),
  reservation_date date not null,
  start_period text not null references periods(code),
  end_period text not null references periods(code),
  purpose text,
  attendees smallint not null check (attendees > 0),
  kind reservation_kind not null,
  status reservation_status not null default 'PENDING_OPERATOR',
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  rejected_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reservations_student_idx on reservations(student_id);
create index if not exists reservations_room_date_idx on reservations(room_code, reservation_date);
create index if not exists reservations_status_idx on reservations(status);

-- ===== 요일 enum 매핑 =====
create or replace function public.date_to_day_enum(d date)
returns day_of_week
language sql immutable as $$
  select case extract(dow from d)::int
    when 1 then 'MON'::day_of_week
    when 2 then 'TUE'::day_of_week
    when 3 then 'WED'::day_of_week
    when 4 then 'THU'::day_of_week
    when 5 then 'FRI'::day_of_week
    when 6 then 'SAT'::day_of_week
    when 0 then 'SUN'::day_of_week
  end;
$$;

-- ===== 자동 분기 + 충돌 체크 트리거 =====
create or replace function public.reservations_before_insert()
returns trigger
language plpgsql as $$
declare
  v_start_order smallint;
  v_end_order smallint;
  v_span smallint;
  v_day day_of_week;
begin
  -- 교시 순서 로드 + 교시 유효성 (regular/night 만 허용)
  select sort_order into v_start_order from periods
    where code = new.start_period and kind in ('regular','night');
  if v_start_order is null then
    raise exception '지원하지 않는 시작 교시입니다: %', new.start_period;
  end if;
  select sort_order into v_end_order from periods
    where code = new.end_period and kind in ('regular','night');
  if v_end_order is null then
    raise exception '지원하지 않는 종료 교시입니다: %', new.end_period;
  end if;
  if v_end_order < v_start_order then
    raise exception '종료 교시가 시작 교시보다 빠릅니다';
  end if;
  v_span := v_end_order - v_start_order + 1;

  -- 상태 분기
  if new.kind = 'QUICK' and new.attendees <= 10 and v_span <= 2 then
    new.status := 'AUTO_APPROVED';
  elsif new.kind = 'QUICK' then
    new.status := 'PENDING_OPERATOR';
  else
    new.status := 'PENDING_ADMIN';
  end if;

  -- 요일 enum
  v_day := public.date_to_day_enum(new.reservation_date);

  -- 수업 충돌
  if exists (
    select 1
    from course_sessions cs
    join periods p on p.code = cs.period_code
    where cs.room_code = new.room_code
      and cs.day = v_day
      and p.sort_order between v_start_order and v_end_order
  ) then
    raise exception '해당 시간에 수업이 있어 예약할 수 없습니다';
  end if;

  -- 다른 예약 충돌 (REJECTED/CANCELLED 제외)
  if exists (
    select 1
    from reservations r
    join periods ps on ps.code = r.start_period
    join periods pe on pe.code = r.end_period
    where r.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and r.room_code = new.room_code
      and r.reservation_date = new.reservation_date
      and r.status not in ('REJECTED', 'CANCELLED')
      and ps.sort_order <= v_end_order
      and pe.sort_order >= v_start_order
  ) then
    raise exception '해당 시간에 이미 다른 예약이 있습니다';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reservations_before_insert on reservations;
create trigger reservations_before_insert
  before insert on reservations
  for each row execute function public.reservations_before_insert();

create or replace function public.reservations_before_update()
returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reservations_before_update on reservations;
create trigger reservations_before_update
  before update on reservations
  for each row execute function public.reservations_before_update();

-- ===== RLS =====
alter table reservations enable row level security;

-- 승인된 학생만 예약 생성 가능
drop policy if exists "reservations student insert" on reservations;
create policy "reservations student insert" on reservations
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'STUDENT'
        and p.approval_status = 'APPROVED'
    )
  );

-- 학생은 본인 예약만 조회
drop policy if exists "reservations student select" on reservations;
create policy "reservations student select" on reservations
  for select to authenticated using (student_id = auth.uid());

-- 학생은 본인 예약을 '취소' 상태로만 변경 가능
drop policy if exists "reservations student cancel" on reservations;
create policy "reservations student cancel" on reservations
  for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid() and status = 'CANCELLED');

-- 운영진/행정실은 전체 조회·수정
drop policy if exists "reservations staff select" on reservations;
create policy "reservations staff select" on reservations
  for select to authenticated using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('OPERATOR','ADMIN')
    )
  );

drop policy if exists "reservations staff update" on reservations;
create policy "reservations staff update" on reservations
  for update to authenticated using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('OPERATOR','ADMIN')
    )
  );
