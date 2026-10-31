-- 체크인 플로우 (PRD §5.1.4)
--   1차: GPS geofence 검증
--   2차: 실시간 사진 1장 제출
--   미체크인 시 노쇼 1회 적립

-- ===== 컬럼 추가 =====
alter table reservations
  add column if not exists checked_in_at timestamptz,
  add column if not exists check_in_photo_url text,
  add column if not exists check_in_lat double precision,
  add column if not exists check_in_lng double precision,
  add column if not exists no_show boolean not null default false;

alter table profiles
  add column if not exists no_show_count smallint not null default 0;

-- ===== Storage 버킷 (학생 self-upload, 스태프 조회) =====
insert into storage.buckets (id, name, public)
values ('check-in-photos', 'check-in-photos', false)
on conflict (id) do nothing;

drop policy if exists "student uploads check-in" on storage.objects;
create policy "student uploads check-in" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'check-in-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "student reads own check-in" on storage.objects;
create policy "student reads own check-in" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'check-in-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "staff reads check-ins" on storage.objects;
create policy "staff reads check-ins" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'check-in-photos'
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('OPERATOR', 'ADMIN')
    )
  );

-- ===== Geofence 상수 =====
-- 충북대 경영대 중심 좌표. 운영팀 실측 후 조정.
-- 간이 bounding box: 위도 1° ≈ 111km, 경도 1° ≈ 88km (37°N 기준).
create or replace function public.is_within_campus(p_lat double precision, p_lng double precision)
returns boolean
language plpgsql immutable as $$
declare
  center_lat constant double precision := 36.6274;
  center_lng constant double precision := 127.4559;
  radius_m   constant double precision := 150.0;
  deg_lat    constant double precision := radius_m / 111000.0;
  deg_lng    constant double precision := radius_m / 88000.0;
begin
  if p_lat is null or p_lng is null then return false; end if;
  return abs(p_lat - center_lat) <= deg_lat and abs(p_lng - center_lng) <= deg_lng;
end;
$$;

-- ===== 체크인 RPC =====
-- 유예시간 15분. 예약 시작 - 15분 ~ 예약 종료까지 체크인 허용.
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
  v_grace      interval := interval '15 minutes';
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

  if now() < v_start_ts - v_grace then
    raise exception '아직 체크인 가능 시간이 아닙니다';
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

grant execute on function public.check_in(uuid, text, double precision, double precision) to authenticated;

-- ===== 노쇼 집계 (운영진/행정실이 수동 호출 또는 추후 cron) =====
-- 종료 시각 + 유예시간 지난 승인된 예약 중 체크인 안 된 건을 no_show=true 로 표시하고
-- 해당 학생의 no_show_count 를 1 증가.
create or replace function public.mark_no_shows()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_grace interval := interval '15 minutes';
  v_count integer := 0;
  r record;
begin
  for r in
    select res.id, res.student_id,
           ((res.reservation_date::timestamp + p.end_time) at time zone 'Asia/Seoul') as end_ts
    from reservations res
    join periods p on p.code = res.end_period
    where res.status in ('AUTO_APPROVED','APPROVED')
      and res.checked_in_at is null
      and res.no_show = false
      and ((res.reservation_date::timestamp + p.end_time) at time zone 'Asia/Seoul') + v_grace < now()
  loop
    update reservations set no_show = true where id = r.id;
    update profiles set no_show_count = no_show_count + 1 where id = r.student_id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.mark_no_shows() to authenticated;
