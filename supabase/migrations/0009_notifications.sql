  -- 푸시 알림 (PRD §5.1.5)
  --   - 예약 승인/거절 완료
  --   - 예약 종료 10분 전
  -- Expo Push Service 를 Postgres 트리거에서 pg_net 으로 직접 호출.
  --
  -- 사전 조건: Supabase Dashboard → Database → Extensions 에서 `pg_net` 을 활성화.

  create extension if not exists pg_net with schema extensions;

  -- ===== 테이블 =====
  create table if not exists push_tokens (
    user_id uuid not null references auth.users(id) on delete cascade,
    token text not null,
    platform text,
    last_seen_at timestamptz not null default now(),
    primary key (user_id, token)
  );

  create table if not exists notifications (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    type text not null,                 -- 'reservation_decided' | 'ending_soon' 등
    title text not null,
    body text not null,
    data jsonb not null default '{}'::jsonb,
    read_at timestamptz,
    created_at timestamptz not null default now()
  );

  create index if not exists notifications_user_idx
    on notifications(user_id, created_at desc);

  -- ===== RLS =====
  alter table push_tokens enable row level security;
  alter table notifications enable row level security;

  drop policy if exists "push_tokens self rw" on push_tokens;
  create policy "push_tokens self rw" on push_tokens
    for all to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

  drop policy if exists "notifications self read" on notifications;
  create policy "notifications self read" on notifications
    for select to authenticated using (user_id = auth.uid());

  drop policy if exists "notifications self update" on notifications;
  create policy "notifications self update" on notifications
    for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

  -- ===== helper: 알림 1건 저장 + Expo Push 전송 =====
  -- SECURITY DEFINER 로 선언해 트리거에서 호출 시에도 RLS 우회 insert.
  create or replace function public.notify_user(
    p_user_id uuid,
    p_type text,
    p_title text,
    p_body text,
    p_data jsonb default '{}'::jsonb
  ) returns void
  language plpgsql
  security definer set search_path = public, extensions
  as $$
  declare
    tok record;
  begin
    -- 1) 인앱 알림 히스토리
    insert into notifications (user_id, type, title, body, data)
    values (p_user_id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb));

    -- 2) Expo Push 전송 (등록된 모든 디바이스로)
    for tok in select token from push_tokens where user_id = p_user_id loop
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb,
        body := jsonb_build_object(
          'to', tok.token,
          'title', p_title,
          'body', p_body,
          'sound', 'default',
          'data', coalesce(p_data, '{}'::jsonb)
        )
      );
    end loop;
  end;
  $$;

  -- ===== 트리거: 예약 상태가 결정형으로 바뀌면 푸시 =====
  create or replace function public.reservations_notify_after_update()
  returns trigger
  language plpgsql
  security definer set search_path = public
  as $$
  declare
    v_title text;
    v_body  text;
  begin
    if old.status is distinct from new.status
      and new.status in ('APPROVED', 'REJECTED') then
      if new.status = 'APPROVED' then
        v_title := '예약이 승인되었어요';
        v_body := format('%s · %s · %s-%s교시',
          new.room_code, to_char(new.reservation_date, 'YYYY-MM-DD'),
          new.start_period, new.end_period);
      else
        v_title := '예약이 거절되었어요';
        v_body := coalesce(new.rejected_reason, '사유 미입력');
      end if;
      perform public.notify_user(
        new.student_id,
        'reservation_decided',
        v_title,
        v_body,
        jsonb_build_object(
          'reservation_id', new.id,
          'status', new.status
        )
      );
    end if;
    return new;
  end;
  $$;

  drop trigger if exists reservations_notify_update on reservations;
  create trigger reservations_notify_update
    after update on reservations
    for each row execute function public.reservations_notify_after_update();

  -- ===== 종료 10분 전 리마인더 =====
  -- cron 또는 수동 호출: select send_ending_soon_reminders();
  -- 중복 발송 방지를 위해 notifications 테이블의 같은 유형 레코드 유무를 체크.
  create or replace function public.send_ending_soon_reminders()
  returns integer
  language plpgsql
  security definer set search_path = public
  as $$
  declare
    v_count integer := 0;
    r record;
    v_end_ts timestamptz;
  begin
    for r in
      select res.id, res.student_id, res.room_code, res.reservation_date, res.end_period,
            ((res.reservation_date::timestamp + p.end_time) at time zone 'Asia/Seoul') as end_ts
      from reservations res
      join periods p on p.code = res.end_period
      where res.status in ('AUTO_APPROVED','APPROVED')
        and res.checked_in_at is not null
        and not exists (
          select 1 from notifications n
          where n.user_id = res.student_id
            and n.type = 'ending_soon'
            and n.data->>'reservation_id' = res.id::text
        )
    loop
      v_end_ts := r.end_ts;
      if v_end_ts > now() and v_end_ts <= now() + interval '10 minutes' then
        perform public.notify_user(
          r.student_id,
          'ending_soon',
          '이용 종료 10분 전',
          format('%s 예약이 곧 종료됩니다', r.room_code),
          jsonb_build_object('reservation_id', r.id)
        );
        v_count := v_count + 1;
      end if;
    end loop;
    return v_count;
  end;
  $$;

  grant execute on function public.send_ending_soon_reminders() to authenticated;
