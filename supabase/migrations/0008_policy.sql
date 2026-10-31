-- 자율 조정 정책 엔진 (PRD §5.2.3)
--   - 체크인 유예시간 (기본 15분)
--   - 최대 예약 교시 수 (기본 3교시, 하드 캡)
-- scope='global' 1건이 전역 기본값. scope='period' 로 특정 교시만 오버라이드.

create table if not exists policy_rules (
  id uuid primary key default uuid_generate_v4(),
  scope text not null check (scope in ('global', 'period')),
  period_code text references periods(code),
  check_in_grace_minutes smallint not null check (check_in_grace_minutes between 0 and 60),
  max_reservation_periods smallint not null check (max_reservation_periods between 1 and 9),
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'global' and period_code is null)
    or (scope = 'period' and period_code is not null)
  )
);

-- scope+period_code 유니크 (NULL 비교 때문에 partial index 로)
create unique index if not exists policy_rules_global_idx
  on policy_rules (scope) where period_code is null;
create unique index if not exists policy_rules_period_idx
  on policy_rules (period_code) where period_code is not null;

-- 전역 기본값 시드
insert into policy_rules (scope, period_code, check_in_grace_minutes, max_reservation_periods)
values ('global', null, 15, 3)
on conflict do nothing;

create or replace function public.policy_touch_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists policy_rules_touch on policy_rules;
create trigger policy_rules_touch
  before update on policy_rules
  for each row execute function public.policy_touch_updated_at();

-- ===== 정책 조회 함수 =====
create or replace function public.get_policy_grace(p_period text default null)
returns integer
language plpgsql stable as $$
declare
  v integer;
begin
  if p_period is not null then
    select check_in_grace_minutes into v
      from policy_rules where scope = 'period' and period_code = p_period;
    if v is not null then return v; end if;
  end if;
  select check_in_grace_minutes into v
    from policy_rules where scope = 'global';
  return coalesce(v, 15);
end;
$$;

create or replace function public.get_policy_max_periods(p_period text default null)
returns integer
language plpgsql stable as $$
declare
  v integer;
begin
  if p_period is not null then
    select max_reservation_periods into v
      from policy_rules where scope = 'period' and period_code = p_period;
    if v is not null then return v; end if;
  end if;
  select max_reservation_periods into v
    from policy_rules where scope = 'global';
  return coalesce(v, 3);
end;
$$;

grant execute on function public.get_policy_grace(text) to authenticated;
grant execute on function public.get_policy_max_periods(text) to authenticated;

-- ===== check_in RPC: 교시별 유예시간 반영 =====
create or replace function public.check_in(
  p_reservation_id uuid,
  p_photo_path text,
  p_lat double precision,
  p_lng double precision
) returns reservations
language plpgsql
security definer set search_path = public
as $$
declare
  r reservations%rowtype;
  v_start_time time;
  v_end_time   time;
  v_start_ts   timestamptz;
  v_end_ts     timestamptz;
  v_grace_min  integer;
  v_grace      interval;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  select * into r from reservations where id = p_reservation_id;
  if not found then
    raise exception '예약을 찾을 수 없습니다';
  end if;
  if r.student_id <> auth.uid() then
    raise exception '본인 예약만 체크인할 수 있습니다';
  end if;
  if r.status not in ('AUTO_APPROVED','APPROVED') then
    raise exception '승인된 예약만 체크인할 수 있습니다';
  end if;
  if r.checked_in_at is not null then
    raise exception '이미 체크인한 예약입니다';
  end if;

  if not public.is_within_campus(p_lat, p_lng) then
    raise exception '경영대 건물 근처에서만 체크인할 수 있습니다';
  end if;

  select start_time into v_start_time from periods where code = r.start_period;
  select end_time   into v_end_time   from periods where code = r.end_period;
  if v_start_time is null or v_end_time is null then
    raise exception '교시 시간을 확인할 수 없습니다';
  end if;
  v_start_ts := (r.reservation_date::timestamp + v_start_time) at time zone 'Asia/Seoul';
  v_end_ts   := (r.reservation_date::timestamp + v_end_time)   at time zone 'Asia/Seoul';

  v_grace_min := public.get_policy_grace(r.start_period);
  v_grace := make_interval(mins => v_grace_min);

  if now() < v_start_ts - v_grace then
    raise exception '아직 체크인 가능 시간이 아닙니다 (유예 %분)', v_grace_min;
  end if;
  if now() > v_end_ts then
    raise exception '체크인 가능 시간이 지났습니다';
  end if;

  update reservations
    set checked_in_at = now(),
        check_in_photo_url = p_photo_path,
        check_in_lat = p_lat,
        check_in_lng = p_lng,
        no_show = false
    where id = p_reservation_id
    returning * into r;

  return r;
end;
$$;

-- ===== reservations trigger: 하드 캡 체크 =====
create or replace function public.reservations_before_insert()
returns trigger
language plpgsql as $$
declare
  v_start_order smallint;
  v_end_order smallint;
  v_span smallint;
  v_day day_of_week;
  v_max_periods integer;
begin
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

  -- 하드 캡: 교시별 최대 예약 가능 시간 초과 시 거절
  v_max_periods := public.get_policy_max_periods(new.start_period);
  if v_span > v_max_periods then
    raise exception '해당 시간대는 최대 %교시까지만 예약할 수 있습니다', v_max_periods;
  end if;

  -- 상태 분기: QUICK 자동 승인 기준 = ≤10명 & ≤2교시
  if new.kind = 'QUICK' and new.attendees <= 10 and v_span <= 2 then
    new.status := 'AUTO_APPROVED';
  elsif new.kind = 'QUICK' then
    new.status := 'PENDING_OPERATOR';
  else
    new.status := 'PENDING_ADMIN';
  end if;

  v_day := public.date_to_day_enum(new.reservation_date);

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

-- ===== RLS =====
alter table policy_rules enable row level security;

-- 모든 인증 사용자가 조회 가능 (모바일에서도 참고 가능)
drop policy if exists "policy read authenticated" on policy_rules;
create policy "policy read authenticated" on policy_rules
  for select to authenticated using (true);

-- ADMIN 만 수정
drop policy if exists "policy admin write" on policy_rules;
create policy "policy admin write" on policy_rules
  for all to authenticated
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'ADMIN'
    )
  )
  with check (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'ADMIN'
    )
  );
