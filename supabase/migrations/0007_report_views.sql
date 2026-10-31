-- 운영 리포트 집계 뷰 (PRD §5.2.2)
-- 세 축: 유휴율 (공간 재배치) · 신고 분포 (시설 관리) · 노쇼 분포 (정책 조정)

-- 1교시=60분·9교시(09-18시) 운영. 월~금 5일 → 주당 regular slot 수 = 45
-- 각 강의실의 "수업으로 점유된 regular slot 수" 를 집계. 유휴율 = (45 - occupied) / 45

create or replace view public.room_weekly_utilization as
select
  r.code,
  r.building,
  r.floor,
  r.category,
  coalesce(occ.slots, 0) as scheduled_slots,
  45 as total_slots,
  round((coalesce(occ.slots, 0)::numeric / 45) * 100, 1) as utilization_pct,
  round(((45 - coalesce(occ.slots, 0))::numeric / 45) * 100, 1) as idle_pct
from rooms r
left join (
  select cs.room_code, count(*) as slots
  from course_sessions cs
  join periods p on p.code = cs.period_code
  where cs.day in ('MON','TUE','WED','THU','FRI')
    and p.code in ('01','02','03','04','05','06','07','08','09')
  group by cs.room_code
) occ on occ.room_code = r.code
where r.in_scope = true;

-- 뷰에도 RLS 체크를 상위 테이블로 위임 (SECURITY INVOKER 디폴트)
grant select on public.room_weekly_utilization to authenticated;
