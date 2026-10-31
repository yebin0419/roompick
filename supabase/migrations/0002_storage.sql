-- 학생증 사진 저장용 Storage 버킷 (PRD §2.3)
-- 학생은 본인 파일 업로드만 가능, 운영진/행정실만 조회 가능.

insert into storage.buckets (id, name, public)
values ('student-id-cards', 'student-id-cards', false)
on conflict (id) do nothing;

-- 학생 본인은 자기 폴더(auth.uid()/...)에만 업로드/덮어쓰기
drop policy if exists "student uploads own card" on storage.objects;
create policy "student uploads own card" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'student-id-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "student replaces own card" on storage.objects;
create policy "student replaces own card" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'student-id-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 운영진·행정실은 모든 학생증 조회
drop policy if exists "staff reads cards" on storage.objects;
create policy "staff reads cards" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'student-id-cards'
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('OPERATOR', 'ADMIN')
    )
  );

-- 학생 본인도 자기 학생증은 조회 가능 (재제출 UI에서 미리보기)
drop policy if exists "student reads own card" on storage.objects;
create policy "student reads own card" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'student-id-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
