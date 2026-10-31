-- Storage 버킷 및 정책

insert into storage.buckets (id, name, public)
values
  ('student-cards', 'student-cards', true),
  ('checkin-photos', 'checkin-photos', true),
  ('report-photos', 'report-photos', true)
on conflict (id) do nothing;

-- student-cards : 본인 업로드, 본인+스태프 조회
drop policy if exists "sc_insert_own" on storage.objects;
create policy "sc_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'student-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "sc_select" on storage.objects;
create policy "sc_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'student-cards'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_staff()
    )
  );

drop policy if exists "sc_update_own" on storage.objects;
create policy "sc_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'student-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- checkin-photos : 본인 업로드, 전체 조회(승인된 로그인 사용자)
drop policy if exists "cp_insert_own" on storage.objects;
create policy "cp_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'checkin-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "cp_select" on storage.objects;
create policy "cp_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'checkin-photos');

-- report-photos : 본인 업로드, 전체 조회
drop policy if exists "rp_insert_own" on storage.objects;
create policy "rp_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "rp_select" on storage.objects;
create policy "rp_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'report-photos');
