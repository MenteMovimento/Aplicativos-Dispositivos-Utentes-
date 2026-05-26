create table if not exists public.device_history (
  id uuid primary key default gen_random_uuid(),
  device_id uuid,
  device_name text,
  serial_number text,
  action text not null,
  summary text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.device_attachments (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  file_name text not null,
  file_path text not null unique,
  file_type text,
  file_size bigint,
  uploaded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists device_history_device_id_idx
on public.device_history(device_id);

create index if not exists device_attachments_device_id_idx
on public.device_attachments(device_id);

alter table public.device_history enable row level security;
alter table public.device_attachments enable row level security;

drop policy if exists "Authenticated members can read device history" on public.device_history;
drop policy if exists "Authenticated members can create device history" on public.device_history;
drop policy if exists "Authenticated members can read device attachments" on public.device_attachments;
drop policy if exists "Authenticated members can create device attachments" on public.device_attachments;
drop policy if exists "Authenticated members can delete device attachments" on public.device_attachments;

create policy "Authenticated members can read device history"
on public.device_history
for select
to authenticated
using (true);

create policy "Authenticated members can create device history"
on public.device_history
for insert
to authenticated
with check (true);

create policy "Authenticated members can read device attachments"
on public.device_attachments
for select
to authenticated
using (true);

create policy "Authenticated members can create device attachments"
on public.device_attachments
for insert
to authenticated
with check (true);

create policy "Authenticated members can delete device attachments"
on public.device_attachments
for delete
to authenticated
using (true);

insert into storage.buckets (id, name, public)
values ('device-attachments', 'device-attachments', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated members can read device attachment files" on storage.objects;
drop policy if exists "Authenticated members can create device attachment files" on storage.objects;
drop policy if exists "Authenticated members can delete device attachment files" on storage.objects;

create policy "Authenticated members can read device attachment files"
on storage.objects
for select
to authenticated
using (bucket_id = 'device-attachments');

create policy "Authenticated members can create device attachment files"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'device-attachments');

create policy "Authenticated members can delete device attachment files"
on storage.objects
for delete
to authenticated
using (bucket_id = 'device-attachments');

notify pgrst, 'reload schema';
