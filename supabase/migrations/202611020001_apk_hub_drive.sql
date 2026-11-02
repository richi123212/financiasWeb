-- APK Hub con sesion obligatoria + Drive privado. Ejecutar completo en SQL Editor.
-- No modifica ni elimina tablas o datos de los modulos existentes.
begin;

insert into storage.buckets (id, name, public, allowed_mime_types)
values
  ('apps-repository', 'apps-repository', false, array['application/vnd.android.package-archive','application/octet-stream']),
  ('personal-drive', 'personal-drive', false, null)
on conflict (id) do update set public = excluded.public, allowed_mime_types = excluded.allowed_mime_types;
-- Se conserva el limite global y cualquier limite existente del bucket.

create table if not exists public.apk_releases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  app_name text not null check (length(trim(app_name)) between 1 and 100),
  app_slug text not null check (app_slug ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
  version text not null check (length(trim(version)) between 1 and 60),
  release_number bigint not null check (release_number > 0),
  changelog text not null default '' check (length(changelog) <= 10000),
  file_name text not null check (length(file_name) between 1 and 255),
  file_size_bytes bigint not null check (file_size_bytes > 0),
  mime_type text not null default 'application/vnd.android.package-archive',
  storage_path text not null unique,
  status text not null default 'uploading' check (status in ('uploading','ready','deleting')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (user_id, app_slug, release_number),
  unique (user_id, app_slug, version),
  check (storage_path like user_id::text || '/' || id::text || '/%')
);

create table if not exists public.drive_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  file_name text not null check (length(file_name) between 1 and 255),
  storage_path text not null unique,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  mime_type text not null,
  category text not null check (category in ('video','audio','pdf','archive','image','document','other')),
  status text not null default 'uploading' check (status in ('uploading','ready','deleting')),
  created_at timestamptz not null default now(),
  check (storage_path like user_id::text || '/' || id::text || '/%')
);
-- Si se ejecuto antes el ejemplo reducido del PDF, detenerse sin cambiar sus datos.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='apk_releases' and column_name='release_number')
    or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='drive_files' and column_name='status') then
    raise exception 'Las tablas de archivos ya existen con otra estructura. No se borraron datos. Solicita una migracion de esa estructura antes de continuar.';
  end if;
end $$;
create table if not exists public.apk_release_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  app_slug text not null,
  last_number bigint not null check (last_number > 0),
  primary key (user_id, app_slug)
);
alter table public.apk_release_counters enable row level security;
revoke all on public.apk_release_counters from anon, authenticated;
create index if not exists apk_releases_catalog on public.apk_releases(status, published_at desc);
create index if not exists apk_releases_owner on public.apk_releases(user_id, created_at desc);
create index if not exists drive_files_owner on public.drive_files(user_id, category, created_at desc);

alter table public.apk_releases enable row level security;
alter table public.drive_files enable row level security;
drop policy if exists apk_catalog_read on public.apk_releases;
create policy apk_catalog_read on public.apk_releases for select to authenticated
  using (status = 'ready' or user_id = (select auth.uid()));
drop policy if exists drive_owner_read on public.drive_files;
create policy drive_owner_read on public.drive_files for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.apk_releases, public.drive_files from public, anon, authenticated;
grant select on public.apk_releases to authenticated;
grant select on public.drive_files to authenticated;
drop policy if exists apk_catalog_guard on public.apk_releases;
create policy apk_catalog_guard on public.apk_releases as restrictive for select to public
  using ((select auth.uid()) is not null and (status='ready' or user_id=(select auth.uid())));
drop policy if exists drive_owner_guard on public.drive_files;
create policy drive_owner_guard on public.drive_files as restrictive for select to public
  using (user_id=(select auth.uid()));

-- Evita borrar metadatos manualmente mientras el objeto fisico siga existiendo.
create or replace function public.guard_file_metadata_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
declare bucket text := case when tg_table_name='apk_releases' then 'apps-repository' else 'personal-drive' end;
begin
  if exists (select 1 from storage.objects where bucket_id=bucket and name=old.storage_path) then
    raise exception 'Primero elimina el archivo mediante Storage; no borres solo sus metadatos';
  end if;
  return old;
end $$;
revoke all on function public.guard_file_metadata_delete() from public, anon, authenticated;
drop trigger if exists guard_file_metadata_delete on public.apk_releases;
create trigger guard_file_metadata_delete before delete on public.apk_releases for each row execute function public.guard_file_metadata_delete();
drop trigger if exists guard_file_metadata_delete on public.drive_files;
create trigger guard_file_metadata_delete before delete on public.drive_files for each row execute function public.guard_file_metadata_delete();

-- Cada objeto necesita primero una reserva de metadatos de su propietario.
-- No se permiten sobrescrituras: cada archivo tiene una ruta UUID nueva.
drop policy if exists portal_apk_insert on storage.objects;
create policy portal_apk_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'apps-repository' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.apk_releases r where r.storage_path = name and r.user_id = (select auth.uid()) and r.status = 'uploading')
);
drop policy if exists portal_apk_select on storage.objects;
create policy portal_apk_select on storage.objects for select to authenticated using (
  bucket_id = 'apps-repository' and exists (select 1 from public.apk_releases r where r.storage_path = name and (r.status = 'ready' or r.user_id = (select auth.uid())))
);
drop policy if exists portal_apk_delete on storage.objects;
create policy portal_apk_delete on storage.objects for delete to authenticated using (
  bucket_id = 'apps-repository' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.apk_releases r where r.storage_path = name and r.user_id = (select auth.uid()) and r.status = 'deleting')
);
drop policy if exists portal_drive_insert on storage.objects;
create policy portal_drive_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'personal-drive' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.drive_files f where f.storage_path = name and f.user_id = (select auth.uid()) and f.status = 'uploading')
);
drop policy if exists portal_drive_select on storage.objects;
create policy portal_drive_select on storage.objects for select to authenticated using (
  bucket_id = 'personal-drive' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.drive_files f where f.storage_path = name and f.user_id = (select auth.uid()))
);
drop policy if exists portal_drive_delete on storage.objects;
create policy portal_drive_delete on storage.objects for delete to authenticated using (
  bucket_id = 'personal-drive' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.drive_files f where f.storage_path = name and f.user_id = (select auth.uid()) and f.status = 'deleting')
);

-- Estos limites se aplican tambien si el proyecto ya tiene otras politicas amplias.
-- No cambian el acceso a buckets ajenos a estos dos modulos.
drop policy if exists portal_files_session on storage.objects;
create policy portal_files_session on storage.objects as restrictive for all to public
using (bucket_id not in ('apps-repository','personal-drive') or (select auth.uid()) is not null)
with check (bucket_id not in ('apps-repository','personal-drive') or (select auth.uid()) is not null);
drop policy if exists portal_files_no_overwrite on storage.objects;
create policy portal_files_no_overwrite on storage.objects as restrictive for update to public
using (bucket_id not in ('apps-repository','personal-drive'))
with check (bucket_id not in ('apps-repository','personal-drive'));
drop policy if exists portal_files_delete_owner on storage.objects;
create policy portal_files_delete_owner on storage.objects as restrictive for delete to public using (
  bucket_id not in ('apps-repository','personal-drive') or (
    (storage.foldername(name))[1]=(select auth.uid())::text and (
      (bucket_id='apps-repository' and exists(select 1 from public.apk_releases where storage_path=name and user_id=(select auth.uid()) and status='deleting')) or
      (bucket_id='personal-drive' and exists(select 1 from public.drive_files where storage_path=name and user_id=(select auth.uid()) and status='deleting'))
    )
  )
);
drop policy if exists portal_files_insert_owner on storage.objects;
create policy portal_files_insert_owner on storage.objects as restrictive for insert to public with check (
  bucket_id not in ('apps-repository','personal-drive') or (
    (storage.foldername(name))[1]=(select auth.uid())::text and (
      (bucket_id='apps-repository' and exists(select 1 from public.apk_releases where storage_path=name and user_id=(select auth.uid()) and status='uploading')) or
      (bucket_id='personal-drive' and exists(select 1 from public.drive_files where storage_path=name and user_id=(select auth.uid()) and status='uploading'))
    )
  )
);
drop policy if exists portal_drive_private_read on storage.objects;
create policy portal_drive_private_read on storage.objects as restrictive for select to public using (
  bucket_id <> 'personal-drive' or (
    (storage.foldername(name))[1]=(select auth.uid())::text and
    exists(select 1 from public.drive_files where storage_path=name and user_id=(select auth.uid()))
  )
);
drop policy if exists portal_apk_catalog_guard on storage.objects;
create policy portal_apk_catalog_guard on storage.objects as restrictive for select to public using (
  bucket_id <> 'apps-repository' or
  exists(select 1 from public.apk_releases where storage_path=name and (status='ready' or user_id=(select auth.uid())))
);

create or replace function public.reserve_file_upload(
  p_kind text, p_file_name text, p_size bigint, p_mime text,
  p_app_name text default '', p_app_slug text default '', p_version text default '', p_changelog text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); fid uuid := gen_random_uuid(); path text; item jsonb;
  edition bigint; category_name text; safe_name text;
begin
  if uid is null then raise exception 'Inicia sesion para subir archivos'; end if;
  if p_size is null or p_size <= 0 or p_file_name is null or length(p_file_name) not between 1 and 255 then
    raise exception 'El archivo debe tener nombre y contenido';
  end if;
  safe_name := left(regexp_replace(p_file_name, '[^a-zA-Z0-9._-]', '_', 'g'), 180);
  path := uid::text || '/' || fid::text || '/' || safe_name;
  if p_kind = 'apk' then
    if lower(p_file_name) not like '%.apk' then raise exception 'Selecciona un archivo APK'; end if;
    if p_app_slug is null or p_app_slug !~ '^[a-z0-9][a-z0-9-]{0,99}$' then raise exception 'Identificador de app invalido'; end if;
    insert into public.apk_release_counters(user_id, app_slug, last_number)
    values(uid,p_app_slug,(select coalesce(max(release_number),0)+1 from public.apk_releases where user_id=uid and app_slug=p_app_slug))
    on conflict (user_id, app_slug) do update set last_number = public.apk_release_counters.last_number + 1
    returning last_number into edition;
    insert into public.apk_releases(id,user_id,app_name,app_slug,version,release_number,changelog,file_name,file_size_bytes,storage_path)
    values(fid,uid,trim(p_app_name),p_app_slug,coalesce(nullif(trim(p_version),''),'Edicion ' || edition),edition,coalesce(p_changelog,''),p_file_name,p_size,path)
    returning to_jsonb(apk_releases.*) into item;
  elsif p_kind = 'drive' then
    category_name := case
      when p_mime like 'video/%' then 'video' when p_mime like 'audio/%' then 'audio'
      when p_mime = 'application/pdf' or lower(p_file_name) like '%.pdf' then 'pdf'
      when lower(p_file_name) ~ '\.(zip|rar|7z|gz|tar|bz2)$' then 'archive'
      when p_mime like 'image/%' then 'image'
      when lower(p_file_name) ~ '\.(txt|md|csv|docx?|xlsx?|pptx?|odt|rtf)$' then 'document' else 'other' end;
    insert into public.drive_files(id,user_id,file_name,storage_path,file_size_bytes,mime_type,category)
    values(fid,uid,p_file_name,path,p_size,coalesce(nullif(p_mime,''),'application/octet-stream'),category_name)
    returning to_jsonb(drive_files.*) into item;
  else raise exception 'Tipo de archivo invalido'; end if;
  return item;
end $$;

create or replace function public.complete_file_upload(p_kind text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare item jsonb; bucket text; actual_size bigint;
begin
  if auth.uid() is null then raise exception 'Sesion requerida'; end if;
  if p_kind = 'apk' then
    bucket := 'apps-repository';
    select to_jsonb(r.*) into item from public.apk_releases r where r.id = p_id and r.user_id = auth.uid() for update;
  elsif p_kind = 'drive' then
    bucket := 'personal-drive';
    select to_jsonb(f.*) into item from public.drive_files f where f.id = p_id and f.user_id = auth.uid() for update;
  else raise exception 'Tipo invalido'; end if;
  if item is null then raise exception 'Archivo no encontrado'; end if;
  if item->>'status' = 'ready' then return; end if;
  if item->>'status' <> 'uploading' then raise exception 'El archivo esta pendiente de eliminacion'; end if;
  select (o.metadata->>'size')::bigint into actual_size from storage.objects o where o.bucket_id = bucket and o.name = item->>'storage_path';
  if actual_size is null or actual_size <> (item->>'file_size_bytes')::bigint then raise exception 'La carga aun no esta completa o su tamano no coincide'; end if;
  if p_kind = 'apk' then update public.apk_releases set status = 'ready', published_at = now() where id = p_id;
  else update public.drive_files set status = 'ready' where id = p_id; end if;
end $$;

create or replace function public.begin_file_deletion(p_kind text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare item jsonb; bucket text;
begin
  if auth.uid() is null then raise exception 'Sesion requerida'; end if;
  if p_kind = 'apk' then
    bucket := 'apps-repository';
    update public.apk_releases set status = 'deleting' where id = p_id and user_id = auth.uid() returning to_jsonb(apk_releases.*) into item;
  elsif p_kind = 'drive' then
    bucket := 'personal-drive';
    update public.drive_files set status = 'deleting' where id = p_id and user_id = auth.uid() returning to_jsonb(drive_files.*) into item;
  else raise exception 'Tipo invalido'; end if;
  if item is null then raise exception 'Archivo no encontrado o no te pertenece'; end if;
  return jsonb_build_object('bucket',bucket,'storage_path',item->>'storage_path');
end $$;

create or replace function public.finish_file_deletion(p_kind text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare item jsonb; bucket text;
begin
  if auth.uid() is null then raise exception 'Sesion requerida'; end if;
  if p_kind = 'apk' then
    bucket := 'apps-repository';
    select to_jsonb(r.*) into item from public.apk_releases r where r.id = p_id and r.user_id = auth.uid() for update;
  elsif p_kind = 'drive' then
    bucket := 'personal-drive';
    select to_jsonb(f.*) into item from public.drive_files f where f.id = p_id and f.user_id = auth.uid() for update;
  else raise exception 'Tipo invalido'; end if;
  if item is null then return; end if;
  if item->>'status' <> 'deleting' then raise exception 'Primero solicita la eliminacion'; end if;
  if exists (select 1 from storage.objects where bucket_id = bucket and name = item->>'storage_path') then
    raise exception 'El archivo todavia existe en Storage. Reintenta la eliminacion';
  end if;
  if p_kind = 'apk' then delete from public.apk_releases where id = p_id;
  else delete from public.drive_files where id = p_id; end if;
end $$;

revoke all on function public.reserve_file_upload(text,text,bigint,text,text,text,text,text) from public, anon;
revoke all on function public.complete_file_upload(text,uuid) from public, anon;
revoke all on function public.begin_file_deletion(text,uuid) from public, anon;
revoke all on function public.finish_file_deletion(text,uuid) from public, anon;
grant execute on function public.reserve_file_upload(text,text,bigint,text,text,text,text,text) to authenticated;
grant execute on function public.complete_file_upload(text,uuid) to authenticated;
grant execute on function public.begin_file_deletion(text,uuid) to authenticated;
grant execute on function public.finish_file_deletion(text,uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
