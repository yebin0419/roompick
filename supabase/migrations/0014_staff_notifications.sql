-- 운영진용 인앱 알림 (notifications 테이블 재사용. push 토큰 없으면 전송만 skip)
-- 트리거 이벤트 3종:
--   1) 학생증 사진 최초 제출 (PENDING + url 세팅)
--   2) 새 예약이 PENDING_OPERATOR / PENDING_ADMIN 로 생성
--   3) 새 신고 OPEN

create or replace function public.notify_staff(
  p_roles text[],
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer set search_path = public
as $$
declare
  staff record;
begin
  for staff in
    select id from profiles where role::text = any(p_roles)
  loop
    perform public.notify_user(staff.id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb));
  end loop;
end;
$$;

-- ===== 학생증 제출 =====
-- INSERT 시엔 보통 url null 로 생성됨 → UPDATE(url null→not null, 상태 PENDING)에서 발사.
create or replace function public.profile_notify_card_submitted()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.student_id_card_url is not null
     and (old.student_id_card_url is distinct from new.student_id_card_url)
     and new.approval_status = 'PENDING'
     and new.role = 'STUDENT' then
    perform public.notify_staff(
      ARRAY['OPERATOR','ADMIN'],
      'staff_student_pending',
      '학생증 승인 대기',
      format('%s · 학번 %s',
        coalesce(new.name, '(이름 미입력)'),
        coalesce(new.student_number, '-')),
      jsonb_build_object('student_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists profile_notify_card_submitted on profiles;
create trigger profile_notify_card_submitted
  after update on profiles
  for each row execute function public.profile_notify_card_submitted();

-- ===== 예약 생성 =====
create or replace function public.reservation_notify_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_body text;
  v_roles text[];
  v_title text;
begin
  if new.status not in ('PENDING_OPERATOR','PENDING_ADMIN') then
    return new;
  end if;
  if new.status = 'PENDING_OPERATOR' then
    v_roles := ARRAY['OPERATOR','ADMIN'];
    v_title := '예약 승인 대기 (운영진)';
  else
    v_roles := ARRAY['ADMIN'];
    v_title := '예약 승인 대기 (행정실)';
  end if;
  v_body := format('%s · %s · %s-%s교시 · %s명',
    new.room_code,
    to_char(new.reservation_date, 'YYYY-MM-DD'),
    new.start_period, new.end_period,
    new.attendees);
  perform public.notify_staff(
    v_roles,
    'staff_reservation_pending',
    v_title,
    v_body,
    jsonb_build_object('reservation_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists reservation_notify_created on reservations;
create trigger reservation_notify_created
  after insert on reservations
  for each row execute function public.reservation_notify_created();

-- ===== 신고 생성 =====
create or replace function public.report_notify_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_cat_label text;
begin
  v_cat_label := case new.category
    when 'UNAUTHORIZED_USE' then '무단 점유'
    when 'EQUIPMENT_BROKEN' then '비품 고장'
    when 'CLEANLINESS' then '청결 문제'
    else '기타'
  end;
  perform public.notify_staff(
    ARRAY['OPERATOR','ADMIN'],
    'staff_report_open',
    format('신고 접수: %s', v_cat_label),
    format('%s · %s',
      coalesce(new.room_code, '강의실 미지정'),
      substring(new.description from 1 for 60)),
    jsonb_build_object('report_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists report_notify_created on reports;
create trigger report_notify_created
  after insert on reports
  for each row execute function public.report_notify_created();
