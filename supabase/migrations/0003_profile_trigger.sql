-- auth.users insert → public.profiles row 자동 생성 (role=STUDENT, approval_status=PENDING).
-- 운영진/행정실 계정은 scripts/create_staff.mjs 에서 뒷단 upsert로 role을 덮어씀.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, approval_status, name, student_number)
  values (
    new.id,
    'STUDENT',
    'PENDING',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'student_number'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 학생 본인은 자기 프로필 insert/update 가능 (학생증 사진 URL 업데이트 등)
drop policy if exists "profile self update" on profiles;
create policy "profile self update" on profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- 역할·승인 상태는 운영진/행정실만 변경 가능 — 학생이 직접 못 바꾸게 WITH CHECK
    and role = 'STUDENT'
  );
