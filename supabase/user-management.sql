alter table public.profiles
add column if not exists email text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_email_key'
  ) then
    alter table public.profiles
    add constraint profiles_email_key unique (email);
  end if;
end $$;

update public.profiles
set email = auth.users.email
from auth.users
where public.profiles.id = auth.users.id
  and public.profiles.email is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_role public.member_role;
begin
  select
    case
      when exists (select 1 from public.profiles) then 'member'::public.member_role
      else 'admin'::public.member_role
    end
  into next_role;

  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, nullif(new.raw_user_meta_data->>'full_name', ''), next_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;

create policy "Admins can read all profiles"
on public.profiles
for select
to authenticated
using (public.current_member_role() = 'admin');

create policy "Admins can update profiles"
on public.profiles
for update
to authenticated
using (public.current_member_role() = 'admin')
with check (public.current_member_role() = 'admin');
