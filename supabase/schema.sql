create type public.member_role as enum ('admin', 'manager', 'member');
create type public.device_status as enum ('active', 'maintenance', 'retired');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  role public.member_role not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  serial_number text not null unique,
  model text not null,
  location text,
  status public.device_status not null default 'active',
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index devices_status_idx on public.devices(status);
create index devices_serial_number_idx on public.devices(serial_number);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_devices_updated_at
before update on public.devices
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, nullif(new.raw_user_meta_data->>'full_name', ''), 'admin')
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_member_role()
returns public.member_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

alter table public.profiles enable row level security;
alter table public.devices enable row level security;

create policy "Members can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "Authenticated members can read profiles"
on public.profiles
for select
to authenticated
using (true);

create policy "Authenticated members can update profiles"
on public.profiles
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated members can read devices"
on public.devices
for select
to authenticated
using (true);

create policy "Authenticated members can create devices"
on public.devices
for insert
to authenticated
with check (true);

create policy "Authenticated members can update devices"
on public.devices
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated members can delete devices"
on public.devices
for delete
to authenticated
using (true);

notify pgrst, 'reload schema';
