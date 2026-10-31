-- 운영 리포트 아카이브 (PRD §1.1 / §5.2.2)
-- 특정 시점의 KPI·자동 추천을 스냅샷으로 저장. 실시간 analytics 뷰와 별개로
-- 행정실이 공식 의사결정 레코드로 사용.

do $$ begin
  create type ops_report_status as enum ('DRAFT', 'PUBLISHED');
exception when duplicate_object then null; end $$;

create table if not exists operations_reports (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  period_label text not null,  -- 'YYYY-MM' 또는 '2026-S1' 등
  status ops_report_status not null default 'DRAFT',
  kpi jsonb not null default '{}'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ops_reports_period_idx on operations_reports(period_label);
create index if not exists ops_reports_status_idx on operations_reports(status);

create or replace function public.ops_reports_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists ops_reports_touch_trigger on operations_reports;
create trigger ops_reports_touch_trigger
  before update on operations_reports
  for each row execute function public.ops_reports_touch();

alter table operations_reports enable row level security;

drop policy if exists "ops_reports admin all" on operations_reports;
create policy "ops_reports admin all" on operations_reports
  for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'ADMIN'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'ADMIN'));

-- ===== 자동 리포트 생성 RPC =====
-- p_month: 'YYYY-MM' 형식. 미지정 시 현재 월.
create or replace function public.generate_operations_report(p_month text default null)
returns operations_reports
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_month text;
  v_start date;
  v_end date;
  v_total integer; v_approved integer; v_checked integer; v_noshow integer;
  v_checkin_rate integer;
  v_reports_total integer; v_reports_open integer;
  v_kpi jsonb;
  v_recs jsonb := '[]'::jsonb;
  v_record record;
  v_report operations_reports%rowtype;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다';
  end if;
  if not exists (select 1 from profiles where id = v_user_id and role = 'ADMIN') then
    raise exception '행정실 권한이 필요합니다';
  end if;

  v_month := coalesce(p_month, to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM'));
  v_start := (v_month || '-01')::date;
  v_end := (v_start + interval '1 month')::date;

  -- ===== KPI 집계 =====
  select
    count(*),
    count(*) filter (where status in ('AUTO_APPROVED','APPROVED')),
    count(*) filter (where checked_in_at is not null),
    count(*) filter (where no_show)
  into v_total, v_approved, v_checked, v_noshow
  from reservations
  where reservation_date >= v_start and reservation_date < v_end;

  v_checkin_rate := case when v_approved > 0
    then round(v_checked::numeric / v_approved * 100)::integer else 0 end;

  select count(*), count(*) filter (where status in ('OPEN','IN_PROGRESS'))
  into v_reports_total, v_reports_open
  from reports
  where (created_at at time zone 'Asia/Seoul')::date >= v_start
    and (created_at at time zone 'Asia/Seoul')::date < v_end;

  v_kpi := jsonb_build_object(
    'period', v_month,
    'reservations_total', v_total,
    'reservations_approved', v_approved,
    'checked_in', v_checked,
    'checkin_rate_pct', v_checkin_rate,
    'no_shows', v_noshow,
    'reports_total', v_reports_total,
    'reports_open', v_reports_open
  );

  -- ===== 자동 추천 생성 =====

  -- 1) 공간 재배치: 유휴율 TOP 3
  for v_record in
    select code, building, floor, idle_pct
    from room_weekly_utilization
    where idle_pct >= 70
    order by idle_pct desc
    limit 3
  loop
    v_recs := v_recs || jsonb_build_object(
      'type', 'space_reallocation',
      'severity', 'info',
      'title', format('%s 분할·용도 변경 검토', v_record.code),
      'detail', format('%s %s · 주당 유휴율 %s%%',
        v_record.building, coalesce(v_record.floor,'-'), v_record.idle_pct)
    );
  end loop;

  -- 2) 시설 투자: 당월 신고 TOP 3 강의실
  for v_record in
    select room_code, count(*) as cnt
    from reports
    where room_code is not null
      and (created_at at time zone 'Asia/Seoul')::date >= v_start
      and (created_at at time zone 'Asia/Seoul')::date < v_end
    group by room_code
    having count(*) >= 2
    order by count(*) desc
    limit 3
  loop
    v_recs := v_recs || jsonb_build_object(
      'type', 'facility_priority',
      'severity', 'warning',
      'title', format('%s 시설 투자 우선순위', v_record.room_code),
      'detail', format('당월 신고 %s건', v_record.cnt)
    );
  end loop;

  -- 3) 정책 조정: 노쇼율 15% 이상 교시
  for v_record in
    select start_period,
           count(*) filter (where status in ('AUTO_APPROVED','APPROVED')) as approved_cnt,
           count(*) filter (where no_show) as noshow_cnt
    from reservations
    where reservation_date >= v_start and reservation_date < v_end
    group by start_period
    having count(*) filter (where status in ('AUTO_APPROVED','APPROVED')) >= 5
       and count(*) filter (where no_show)::numeric
           / nullif(count(*) filter (where status in ('AUTO_APPROVED','APPROVED')), 0)
           >= 0.15
    order by noshow_cnt desc
  loop
    v_recs := v_recs || jsonb_build_object(
      'type', 'policy_grace',
      'severity', 'warning',
      'title', format('%s교시 체크인 유예 단축 권장', v_record.start_period),
      'detail', format('승인 %s건 중 노쇼 %s건 (%s%%)',
        v_record.approved_cnt, v_record.noshow_cnt,
        round(v_record.noshow_cnt::numeric / v_record.approved_cnt * 100))
    );
  end loop;

  -- 4) 처리 백로그
  if v_reports_total > 0 and v_reports_open::numeric / v_reports_total >= 0.2 then
    v_recs := v_recs || jsonb_build_object(
      'type', 'report_backlog',
      'severity', 'danger',
      'title', '신고 처리 백로그 알림',
      'detail', format('당월 신고 %s건 중 미처리 %s건', v_reports_total, v_reports_open)
    );
  end if;

  -- ===== insert =====
  insert into operations_reports (title, period_label, kpi, recommendations, created_by)
  values (
    format('%s 운영 리포트', v_month),
    v_month,
    v_kpi,
    v_recs,
    v_user_id
  )
  returning * into v_report;

  return v_report;
end;
$$;

grant execute on function public.generate_operations_report(text) to authenticated;
