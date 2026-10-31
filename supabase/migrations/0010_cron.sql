-- 노쇼 자동 집계 및 종료 임박 알림 cron (PRD §5.1.4 / §5.1.5)
--
-- 사전 조건: Supabase Dashboard → Database → Extensions 에서 `pg_cron` 을 활성화.
-- 모니터링: `select * from cron.job_run_details order by start_time desc limit 20;`

create extension if not exists pg_cron with schema extensions;

-- ===== mark_no_shows() 교체: 노쇼 적립 시 학생에게 알림 발송 =====
create or replace function public.mark_no_shows()
returns integer
language plpgsql
security definer set search_path = public
as 
declare
  v_grace interval := interval '15 minutes';
  v_count integer := 0;
  r record;
begin
  for r in
    select res.id, res.student_id, res.room_code, res.reservation_date,
           res.start_period, res.end_period,
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

    -- 학생에게 노쇼 적립 알림
    perform public.notify_user(
      r.student_id,
      'no_show',
      '노쇼 1회 적립',
      format('%s · %s · %s-%s교시 미체크인',
        r.room_code,
        to_char(r.reservation_date, 'YYYY-MM-DD'),
        r.start_period,
        r.end_period),
      jsonb_build_object('reservation_id', r.id)
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.mark_no_shows() to authenticated;

-- ===== cron 스케줄 등록 =====
-- 재실행 안전성을 위해 등록 전 제거.
do $$
begin
  perform cron.unschedule('roompick-mark-no-shows')
    where exists (select 1 from cron.job where jobname = 'roompick-mark-no-shows');
exception when others then null; end $$;

do $$
begin
  perform cron.unschedule('roompick-ending-soon')
    where exists (select 1 from cron.job where jobname = 'roompick-ending-soon');
exception when others then null; end $$;

-- 15분마다 노쇼 집계. 유예 15분과 매칭하면서 과도한 부하는 피함.
select cron.schedule(
  'roompick-mark-no-shows',
  '*/15 * * * *',
  $cron$ select public.mark_no_shows(); $cron$
);

-- 1분마다 종료 임박 알림 체크. 10분 윈도우 안에서 놓침 없이 발사.
select cron.schedule(
  'roompick-ending-soon',
  '* * * * *',
  $cron$ select public.send_ending_soon_reminders(); $cron$
);
