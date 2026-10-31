-- 신고 플로우 (PRD §5.1.5): 무단 점유 / 비품 고장 / 청결 등 사진 첨부 신고

do $$ begin
  create type report_category as enum (
    'UNAUTHORIZED_USE',   -- 무단 점유
    'EQUIPMENT_BROKEN',   -- 비품 고장
    'CLEANLINESS',        -- 청결
    'OTHER'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_status as enum (
    'OPEN',          -- 접수됨
    'IN_PROGRESS',   -- 처리 중
    'RESOLVED',      -- 완료
    'DISMISSED'      -- 반려
  );
exception when duplicate_object then null; end $$;

create table if not exists reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  room_code text references rooms(code),
  category report_category not null,
  description text not null check (length(trim(description)) > 0),
  photo_url text,
  status report_status not null default 'OPEN',
  handled_by uuid references profiles(id),
  handled_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reports_reporter_idx on reports(reporter_id);
create index if not exists reports_room_idx on reports(room_code);
create index if not exists reports_status_idx on reports(status);

create or replace function public.reports_touch_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reports_touch on reports;
create trigger reports_touch
  before update on reports
  for each row execute function public.reports_touch_updated_at();

-- ===== Storage 버킷 =====
insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', false)
on conflict (id) do nothing;

drop policy if exists "student uploads report photo" on storage.objects;
create policy "student uploads report photo" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "student reads own report photo" on storage.objects;
create policy "student reads own report photo" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "staff reads report photos" on storage.objects;
create policy "staff reads report photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'report-photos'
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('OPERATOR','ADMIN')
    )
  );

-- ===== RLS =====
alter table reports enable row level security;

-- 승인된 학생만 신고 생성
drop policy if exists "reports student insert" on reports;
create policy "reports student insert" on reports
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'STUDENT'
        and p.approval_status = 'APPROVED'
    )
  );

-- 학생은 본인 신고만 조회
drop policy if exists "reports student select" on reports;
create policy "reports student select" on reports
  for select to authenticated using (reporter_id = auth.uid());

-- 운영진/행정실은 전체 조회·수정
drop policy if exists "reports staff select" on reports;
create policy "reports staff select" on reports
  for select to authenticated using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('OPERATOR','ADMIN')
    )
  );

drop policy if exists "reports staff update" on reports;
create policy "reports staff update" on reports
  for update to authenticated using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('OPERATOR','ADMIN')
    )
  );
