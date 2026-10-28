-- Ejecutar completo en Supabase SQL Editor antes de desplegar el frontend.
begin;
create table if not exists public.note_folders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 100),
 color_hex text not null default '#6366f1', icon text not null default '📁',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id, user_id)
);
create table if not exists public.notes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 folder_id uuid references public.note_folders(id) on delete set null,
 title text not null check (length(trim(title)) between 1 and 200),
 content text not null default '', tags text[] not null default '{}', pinned boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Folder ownership is checked on every write; a foreign folder cannot be attached.
create or replace function public.validate_note_folder() returns trigger
language plpgsql set search_path = public as $$
begin
 if new.folder_id is not null and not exists(select 1 from public.note_folders where id = new.folder_id and user_id = new.user_id) then
   raise exception 'La carpeta no pertenece al usuario';
 end if;
 return new;
end $$;
drop trigger if exists validate_note_folder on public.notes;
create trigger validate_note_folder before insert or update on public.notes for each row execute function public.validate_note_folder();

create table if not exists public.cajitas_apartados (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 120),
 target_amount numeric(14,2) not null default 0 check(target_amount >= 0),
 current_balance numeric(14,2) not null default 0 check(current_balance >= 0),
 institution text not null default '', notes text not null default '', color_hex text not null default '#10b981',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id, user_id)
);
create table if not exists public.cajitas_movimientos (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 apartado_id uuid not null,
 tipo text not null check(tipo in ('apartar','liberar')),
 monto numeric(14,2) not null check(monto > 0), nota text not null default '',
 created_at timestamptz not null default now(),
 foreign key(apartado_id, user_id) references public.cajitas_apartados(id, user_id) on delete cascade
);
create index if not exists notes_user_updated on public.notes(user_id, pinned desc, updated_at desc);
create index if not exists notes_folder on public.notes(folder_id);
create index if not exists folders_user on public.note_folders(user_id);
create index if not exists cajitas_user on public.cajitas_apartados(user_id);
create index if not exists movimientos_user_date on public.cajitas_movimientos(user_id, created_at desc);

alter table public.note_folders enable row level security;
alter table public.notes enable row level security;
alter table public.cajitas_apartados enable row level security;
alter table public.cajitas_movimientos enable row level security;
drop policy if exists notes_owner on public.notes;
create policy notes_owner on public.notes for all to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
drop policy if exists folders_owner on public.note_folders;
create policy folders_owner on public.note_folders for all to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
drop policy if exists cajitas_owner on public.cajitas_apartados;
create policy cajitas_owner on public.cajitas_apartados for all to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
drop policy if exists movimientos_owner on public.cajitas_movimientos;
create policy movimientos_owner on public.cajitas_movimientos for select to authenticated using(user_id = auth.uid());

create or replace function public.module_updated_at() returns trigger
language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists notes_updated on public.notes;
create trigger notes_updated before update on public.notes for each row execute function public.module_updated_at();
drop trigger if exists folders_updated on public.note_folders;
create trigger folders_updated before update on public.note_folders for each row execute function public.module_updated_at();
drop trigger if exists cajitas_updated on public.cajitas_apartados;
create trigger cajitas_updated before update on public.cajitas_apartados for each row execute function public.module_updated_at();

-- Single database transaction; concurrent changes cannot lose updates or overdraw a box.
create or replace function public.mover_reserva(p_apartado_id uuid, p_tipo text, p_monto numeric, p_nota text default '')
returns public.cajitas_movimientos language plpgsql security definer set search_path = public as $$
declare box public.cajitas_apartados; movement public.cajitas_movimientos;
begin
 if auth.uid() is null then raise exception 'Sesión requerida'; end if;
 if p_tipo is null or p_tipo not in ('apartar','liberar') or p_monto is null or p_monto <= 0 or p_monto <> round(p_monto,2) or p_monto::text in ('NaN','Infinity','-Infinity') then
   raise exception 'Movimiento inválido';
 end if;
 select * into box from public.cajitas_apartados where id = p_apartado_id and user_id = auth.uid() for update;
 if not found then raise exception 'Apartado no encontrado'; end if;
 if p_tipo = 'liberar' and p_monto > box.current_balance then raise exception 'Saldo insuficiente en el apartado'; end if;
 update public.cajitas_apartados set current_balance = current_balance + case when p_tipo = 'apartar' then p_monto else -p_monto end where id = box.id;
 insert into public.cajitas_movimientos(user_id, apartado_id, tipo, monto, nota) values(auth.uid(),box.id,p_tipo,p_monto,coalesce(p_nota,'')) returning * into movement;
 return movement;
end $$;
revoke all on function public.mover_reserva(uuid,text,numeric,text) from public, anon;
grant execute on function public.mover_reserva(uuid,text,numeric,text) to authenticated;

-- Restrict balance writes to the RPC. Users may edit only box metadata.
revoke all on public.cajitas_apartados from anon, authenticated;
grant select, delete on public.cajitas_apartados to authenticated;
grant insert(user_id,name,target_amount,institution,notes,color_hex) on public.cajitas_apartados to authenticated;
grant update(name,target_amount,institution,notes,color_hex,updated_at) on public.cajitas_apartados to authenticated;
revoke all on public.cajitas_movimientos from anon, authenticated;
grant select on public.cajitas_movimientos to authenticated;
grant select, insert, update, delete on public.notes, public.note_folders to authenticated;

create or replace function public.prevent_funded_box_delete() returns trigger language plpgsql security definer set search_path = public as $$
begin
 if old.current_balance > 0 and exists(select 1 from auth.users where id = old.user_id) then raise exception 'Libera el saldo antes de eliminar el apartado'; end if;
 return old;
end $$;
drop trigger if exists prevent_funded_box_delete on public.cajitas_apartados;
create trigger prevent_funded_box_delete before delete on public.cajitas_apartados for each row execute function public.prevent_funded_box_delete();
commit;
