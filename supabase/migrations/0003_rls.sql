-- Row Level Security

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.courses enable row level security;
alter table public.reservations enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;
alter table public.system_policies enable row level security;

-- Helper
create or replace function public.current_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('OPERATOR', 'ADMIN')
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'ADMIN'
  );
$$;

create or replace function public.is_approved_student() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'STUDENT'
      and approval_status = 'APPROVED'
  );
$$;

-- profiles
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
    and approval_status = (select approval_status from public.profiles where id = auth.uid())
  );

drop policy if exists "profiles_staff_update" on public.profiles;
create policy "profiles_staff_update" on public.profiles
  for update to authenticated
  using (public.is_staff());

-- rooms (전역 공개)
drop policy if exists "rooms_select_all" on public.rooms;
create policy "rooms_select_all" on public.rooms
  for select to authenticated using (true);

drop policy if exists "rooms_staff_write" on public.rooms;
create policy "rooms_staff_write" on public.rooms
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- courses
drop policy if exists "courses_select_all" on public.courses;
create policy "courses_select_all" on public.courses
  for select to authenticated using (true);

drop policy if exists "courses_staff_write" on public.courses;
create policy "courses_staff_write" on public.courses
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- reservations
drop policy if exists "reservations_select" on public.reservations;
create policy "reservations_select" on public.reservations
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "reservations_student_insert" on public.reservations;
create policy "reservations_student_insert" on public.reservations
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved_student());

drop policy if exists "reservations_student_update" on public.reservations;
create policy "reservations_student_update" on public.reservations
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "reservations_staff_update" on public.reservations;
create policy "reservations_staff_update" on public.reservations
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "reservations_student_delete" on public.reservations;
create policy "reservations_student_delete" on public.reservations
  for delete to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- reports
drop policy if exists "reports_select" on public.reports;
create policy "reports_select" on public.reports
  for select to authenticated
  using (reporter_id = auth.uid() or public.is_staff());

drop policy if exists "reports_student_insert" on public.reports;
create policy "reports_student_insert" on public.reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "reports_staff_update" on public.reports;
create policy "reports_staff_update" on public.reports
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- notifications
drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "notifications_staff_insert" on public.notifications;
create policy "notifications_staff_insert" on public.notifications
  for insert to authenticated with check (public.is_staff());

-- system_policies (읽기는 모두, 쓰기는 ADMIN만)
drop policy if exists "policies_select" on public.system_policies;
create policy "policies_select" on public.system_policies
  for select to authenticated using (true);

drop policy if exists "policies_admin_write" on public.system_policies;
create policy "policies_admin_write" on public.system_policies
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
