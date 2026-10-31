-- 맞춤 빈자리 알림 (PRD §1.1 Self-Optimizing / §5.1.5)
-- 학생이 선호 강의실·교시를 등록. 예약이 취소되면 매칭 사용자에게 즉시 푸시.

create table if not exists student_preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  preferred_rooms text[] not null default '{}',
  preferred_periods text[] not null default '{}',
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table student_preferences enable row level security;

drop policy if exists "preferences self rw" on student_preferences;
create policy "preferences self rw" on student_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 매칭 트리거가 모든 선호를 조회하려면 SECURITY DEFINER 함수로 처리.
-- 트리거 자체는 definer function 안에서 돌아 RLS 를 우회한다.

create or replace function public.preferences_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists preferences_touch on student_preferences;
create trigger preferences_touch
  before update on student_preferences
  for each row execute function public.preferences_touch_updated_at();

-- ===== 매칭 트리거: 예약 CANCELLED 시 선호 사용자에게 알림 =====
create or replace function public.reservations_match_cancelled()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_start_order smallint;
  v_end_order smallint;
  pref record;
  v_body text;
begin
  -- 이전에 slot 을 점유했던 상태 → CANCELLED 로 바뀐 경우만 매칭 신호
  if not (old.status is distinct from new.status
          and new.status = 'CANCELLED'
          and old.status in ('AUTO_APPROVED','APPROVED','PENDING_OPERATOR','PENDING_ADMIN')) then
    return new;
  end if;

  -- 오늘·내일 범위만. 더 먼 날짜는 매칭 소음.
  if new.reservation_date not between current_date and current_date + 1 then
    return new;
  end if;

  select sort_order into v_start_order from periods where code = new.start_period;
  select sort_order into v_end_order from periods where code = new.end_period;
  if v_start_order is null or v_end_order is null then return new; end if;

  v_body := format('%s · %s · %s-%s교시가 비었어요',
    new.room_code,
    to_char(new.reservation_date, 'YYYY-MM-DD'),
    new.start_period, new.end_period);

  for pref in
    select user_id
    from student_preferences sp
    where sp.active = true
      and sp.user_id <> new.student_id
      and new.room_code = any(sp.preferred_rooms)
      and (
        array_length(sp.preferred_periods, 1) is null
        or exists (
          select 1 from unnest(sp.preferred_periods) pp
          join periods p2 on p2.code = pp
          where p2.sort_order between v_start_order and v_end_order
        )
      )
  loop
    perform public.notify_user(
      pref.user_id,
      'slot_available',
      '빈자리 알림',
      v_body,
      jsonb_build_object(
        'room_code', new.room_code,
        'date', to_char(new.reservation_date, 'YYYY-MM-DD'),
        'start_period', new.start_period,
        'end_period', new.end_period
      )
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists reservations_match_cancel on reservations;
create trigger reservations_match_cancel
  after update on reservations
  for each row execute function public.reservations_match_cancelled();
