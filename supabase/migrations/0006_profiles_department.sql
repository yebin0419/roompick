-- profiles.department 컬럼 추가 + 신규가입 트리거 보강

alter table public.profiles
  add column if not exists department text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, student_id, department, role, approval_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'student_id', ''),
    coalesce(new.raw_user_meta_data->>'department', ''),
    'STUDENT',
    'PENDING'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
