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
