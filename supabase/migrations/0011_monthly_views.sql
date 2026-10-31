-- 월간 추이 뷰 (PRD §1.1 월간/학기말 운영 리포트)

create or replace view public.monthly_reservation_stats as
select
  to_char(date_trunc('month', reservation_date), 'YYYY-MM') as month,
  count(*)::integer as total,
  count(*) filter (where status in ('AUTO_APPROVED', 'APPROVED'))::integer as approved,
  count(*) filter (where checked_in_at is not null)::integer as checked_in,
  count(*) filter (where no_show)::integer as no_show
from reservations
group by date_trunc('month', reservation_date);

create or replace view public.monthly_report_stats as
select
  to_char(date_trunc('month', created_at at time zone 'Asia/Seoul'), 'YYYY-MM') as month,
  count(*)::integer as total,
  count(*) filter (where category = 'UNAUTHORIZED_USE')::integer as unauthorized_use,
  count(*) filter (where category = 'EQUIPMENT_BROKEN')::integer as equipment_broken,
  count(*) filter (where category = 'CLEANLINESS')::integer as cleanliness,
  count(*) filter (where category = 'OTHER')::integer as other,
  count(*) filter (where status = 'RESOLVED')::integer as resolved
from reports
group by date_trunc('month', created_at at time zone 'Asia/Seoul');

grant select on public.monthly_reservation_stats to authenticated;
grant select on public.monthly_report_stats to authenticated;
