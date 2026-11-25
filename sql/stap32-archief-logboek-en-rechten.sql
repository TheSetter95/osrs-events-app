-- =====================================================================
-- Stap 32: archief bij verwijderen, audit-log en strengere rechten
-- Voer dit uit in Supabase -> SQL Editor.
--
-- LET OP: dit is NIET getest tegen jouw echte database.
--  1. Maak eerst een export/back-up van je data (zie onderaan).
--  2. Voer de delen A t/m E een voor een uit en lees de foutmeldingen.
--  3. Test daarna met een testevent: aanmaken, vullen, verwijderen,
--     herstellen (deel F).
-- Tabel- en kolomnamen zijn afgeleid uit de code van de website.
-- Geeft een deel een fout over een onbekende tabel of kolom? Pas die
-- naam aan en voer het deel opnieuw uit; er is niets stuk gegaan.
-- =====================================================================


-- ---------------------------------------------------------------------
-- A. Archief: een kopie van een event, vlak voordat het verwijderd wordt
-- ---------------------------------------------------------------------
create table if not exists deleted_event_archives (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,            -- bewust GEEN foreign key: het event is weg
  community_id uuid,
  event_name text,
  deleted_at timestamptz not null default now(),
  deleted_by uuid,                   -- auth.uid() van wie het deed (null = buiten de website)
  deleted_by_role text,              -- 'authenticated' of 'service_role'
  snapshot jsonb not null
);

alter table deleted_event_archives enable row level security;

-- Alleen owners van de community mogen het archief lezen; schrijven kan alleen
-- de trigger hieronder (security definer) en de beheerder in de SQL Editor.
drop policy if exists "Owners lezen archief" on deleted_event_archives;
create policy "Owners lezen archief" on deleted_event_archives
  for select using (community_id is not null and is_community_owner(community_id));

create or replace function archive_event_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  snap jsonb;
begin
  snap := jsonb_build_object(
    'event',  to_jsonb(old),
    'teams',  coalesce((select jsonb_agg(to_jsonb(t)) from teams t where t.event_id = old.id), '[]'::jsonb),
    'participants', coalesce((select jsonb_agg(to_jsonb(p)) from participants p where p.event_id = old.id), '[]'::jsonb),

    -- Ganzebord
    'board_tiles', coalesce((select jsonb_agg(to_jsonb(x)) from board_tiles x where x.event_id = old.id), '[]'::jsonb),
    'board_tile_requirements', coalesce((select jsonb_agg(to_jsonb(r)) from board_tile_requirements r
        where r.tile_id in (select id from board_tiles where event_id = old.id)), '[]'::jsonb),
    'requirement_accepted_items', coalesce((select jsonb_agg(to_jsonb(a)) from requirement_accepted_items a
        where a.requirement_id in (select r.id from board_tile_requirements r
            join board_tiles bt on bt.id = r.tile_id where bt.event_id = old.id)), '[]'::jsonb),
    'item_submissions', coalesce((select jsonb_agg(to_jsonb(s)) from item_submissions s
        where s.requirement_id in (select r.id from board_tile_requirements r
            join board_tiles bt on bt.id = r.tile_id where bt.event_id = old.id)), '[]'::jsonb),
    'board_tile_reveals', coalesce((select jsonb_agg(to_jsonb(v)) from board_tile_reveals v where v.event_id = old.id), '[]'::jsonb),
    'progress_updates', coalesce((select jsonb_agg(to_jsonb(u)) from progress_updates u where u.event_id = old.id), '[]'::jsonb),

    -- Bingo
    'bingo_tiles', coalesce((select jsonb_agg(to_jsonb(x)) from bingo_tiles x where x.event_id = old.id), '[]'::jsonb),
    'bingo_tile_requirements', coalesce((select jsonb_agg(to_jsonb(r)) from bingo_tile_requirements r
        where r.tile_id in (select id from bingo_tiles where event_id = old.id)), '[]'::jsonb),
    'bingo_requirement_accepted_items', coalesce((select jsonb_agg(to_jsonb(a)) from bingo_requirement_accepted_items a
        where a.requirement_id in (select r.id from bingo_tile_requirements r
            join bingo_tiles bt on bt.id = r.tile_id where bt.event_id = old.id)), '[]'::jsonb),
    'bingo_item_submissions', coalesce((select jsonb_agg(to_jsonb(s)) from bingo_item_submissions s
        where s.requirement_id in (select r.id from bingo_tile_requirements r
            join bingo_tiles bt on bt.id = r.tile_id where bt.event_id = old.id)), '[]'::jsonb),
    'bingo_completions', coalesce((select jsonb_agg(to_jsonb(c)) from bingo_completions c
        where c.tile_id in (select id from bingo_tiles where event_id = old.id)), '[]'::jsonb),

    -- Losse Races
    'drop_races', coalesce((select jsonb_agg(to_jsonb(x)) from drop_races x where x.event_id = old.id), '[]'::jsonb),
    'drop_race_accepted_items', coalesce((select jsonb_agg(to_jsonb(a)) from drop_race_accepted_items a
        where a.race_id in (select id from drop_races where event_id = old.id)), '[]'::jsonb),
    'drop_race_submissions', coalesce((select jsonb_agg(to_jsonb(s)) from drop_race_submissions s
        where s.race_id in (select id from drop_races where event_id = old.id)), '[]'::jsonb),

    -- Gauntlet
    'gauntlet_stages', coalesce((select jsonb_agg(to_jsonb(x)) from gauntlet_stages x where x.event_id = old.id), '[]'::jsonb),
    'gauntlet_stage_accepted_items', coalesce((select jsonb_agg(to_jsonb(a)) from gauntlet_stage_accepted_items a
        where a.stage_id in (select id from gauntlet_stages where event_id = old.id)), '[]'::jsonb),
    'gauntlet_submissions', coalesce((select jsonb_agg(to_jsonb(s)) from gauntlet_submissions s
        where s.stage_id in (select id from gauntlet_stages where event_id = old.id)), '[]'::jsonb)
  );

  insert into deleted_event_archives (event_id, community_id, event_name, deleted_by, deleted_by_role, snapshot)
  values (old.id, old.community_id, old.name, auth.uid(), auth.role(), snap);

  return old;
end;
$$;

drop trigger if exists archive_event_before_delete on events;
create trigger archive_event_before_delete
  before delete on events
  for each row execute function archive_event_before_delete();


-- ---------------------------------------------------------------------
-- B. Herstellen vanuit het archief (alleen jij als beheerder, in de SQL Editor)
--    Gebruik: select restore_deleted_event('<archive id>');
-- ---------------------------------------------------------------------
create or replace function restore_deleted_event(p_archive_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  snap jsonb;
begin
  select snapshot into snap from deleted_event_archives where id = p_archive_id;
  if snap is null then
    raise exception 'Archief % niet gevonden', p_archive_id;
  end if;

  -- Volgorde is belangrijk (eerst de ouders, dan de kinderen).
  insert into events select * from jsonb_populate_record(null::events, snap->'event') on conflict (id) do nothing;
  insert into teams select * from jsonb_populate_recordset(null::teams, snap->'teams') on conflict (id) do nothing;
  insert into participants select * from jsonb_populate_recordset(null::participants, snap->'participants') on conflict (id) do nothing;

  insert into board_tiles select * from jsonb_populate_recordset(null::board_tiles, snap->'board_tiles') on conflict (id) do nothing;
  insert into board_tile_requirements select * from jsonb_populate_recordset(null::board_tile_requirements, snap->'board_tile_requirements') on conflict (id) do nothing;
  insert into requirement_accepted_items select * from jsonb_populate_recordset(null::requirement_accepted_items, snap->'requirement_accepted_items') on conflict (id) do nothing;
  insert into item_submissions select * from jsonb_populate_recordset(null::item_submissions, snap->'item_submissions') on conflict (id) do nothing;
  insert into board_tile_reveals select * from jsonb_populate_recordset(null::board_tile_reveals, snap->'board_tile_reveals') on conflict do nothing;
  insert into progress_updates select * from jsonb_populate_recordset(null::progress_updates, snap->'progress_updates') on conflict (id) do nothing;

  insert into bingo_tiles select * from jsonb_populate_recordset(null::bingo_tiles, snap->'bingo_tiles') on conflict (id) do nothing;
  insert into bingo_tile_requirements select * from jsonb_populate_recordset(null::bingo_tile_requirements, snap->'bingo_tile_requirements') on conflict (id) do nothing;
  insert into bingo_requirement_accepted_items select * from jsonb_populate_recordset(null::bingo_requirement_accepted_items, snap->'bingo_requirement_accepted_items') on conflict (id) do nothing;
  insert into bingo_item_submissions select * from jsonb_populate_recordset(null::bingo_item_submissions, snap->'bingo_item_submissions') on conflict (id) do nothing;
  insert into bingo_completions select * from jsonb_populate_recordset(null::bingo_completions, snap->'bingo_completions') on conflict (id) do nothing;

  insert into drop_races select * from jsonb_populate_recordset(null::drop_races, snap->'drop_races') on conflict (id) do nothing;
  insert into drop_race_accepted_items select * from jsonb_populate_recordset(null::drop_race_accepted_items, snap->'drop_race_accepted_items') on conflict (id) do nothing;
  insert into drop_race_submissions select * from jsonb_populate_recordset(null::drop_race_submissions, snap->'drop_race_submissions') on conflict (id) do nothing;

  insert into gauntlet_stages select * from jsonb_populate_recordset(null::gauntlet_stages, snap->'gauntlet_stages') on conflict (id) do nothing;
  insert into gauntlet_stage_accepted_items select * from jsonb_populate_recordset(null::gauntlet_stage_accepted_items, snap->'gauntlet_stage_accepted_items') on conflict (id) do nothing;
  insert into gauntlet_submissions select * from jsonb_populate_recordset(null::gauntlet_submissions, snap->'gauntlet_submissions') on conflict (id) do nothing;

  return 'Event hersteld: ' || (snap->'event'->>'name');
end;
$$;

-- Niemand via de website mag deze functie aanroepen.
revoke execute on function restore_deleted_event(uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- C. Audit-log: wie deed wat (verwijderen, status, posities, vrijgaven)
-- ---------------------------------------------------------------------
create table if not exists event_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  community_id uuid,
  event_id uuid,
  event_name text,
  action text not null,
  actor_id uuid,          -- leeg = wijziging buiten de website (bijv. direct in Supabase)
  actor_db_role text,     -- 'authenticated' (via website) of 'service_role' (plugin/server)
  details jsonb
);

create index if not exists event_audit_log_event_idx on event_audit_log (event_id, created_at desc);

alter table event_audit_log enable row level security;

drop policy if exists "Owners lezen logboek" on event_audit_log;
create policy "Owners lezen logboek" on event_audit_log
  for select using (community_id is not null and is_community_owner(community_id));

-- Events: verwijderd en status gewijzigd
create or replace function log_event_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    insert into event_audit_log (community_id, event_id, event_name, action, actor_id, actor_db_role, details)
    values (old.community_id, old.id, old.name, 'event_verwijderd', auth.uid(), auth.role(),
            jsonb_build_object('status', old.status, 'type', old.type));
    return old;
  elsif (tg_op = 'UPDATE') then
    if new.status is distinct from old.status then
      insert into event_audit_log (community_id, event_id, event_name, action, actor_id, actor_db_role, details)
      values (new.community_id, new.id, new.name, 'status_gewijzigd', auth.uid(), auth.role(),
              jsonb_build_object('van', old.status, 'naar', new.status));
    end if;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists log_event_changes on events;
create trigger log_event_changes
  after update or delete on events
  for each row execute function log_event_changes();

-- Teams: positie, vrijgave (can_roll) en straf
create or replace function log_team_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
begin
  select id, name, community_id into ev from events where id = new.event_id;

  if new.board_position is distinct from old.board_position then
    insert into event_audit_log (community_id, event_id, event_name, action, actor_id, actor_db_role, details)
    values (ev.community_id, ev.id, ev.name, 'positie_gewijzigd', auth.uid(), auth.role(),
            jsonb_build_object('team_id', new.id, 'team', new.name, 'van', old.board_position, 'naar', new.board_position));
  end if;

  if new.can_roll is distinct from old.can_roll then
    insert into event_audit_log (community_id, event_id, event_name, action, actor_id, actor_db_role, details)
    values (ev.community_id, ev.id, ev.name, 'vrijgave_gewijzigd', auth.uid(), auth.role(),
            jsonb_build_object('team_id', new.id, 'team', new.name, 'can_roll', new.can_roll));
  end if;

  if new.pending_penalty is distinct from old.pending_penalty then
    insert into event_audit_log (community_id, event_id, event_name, action, actor_id, actor_db_role, details)
    values (ev.community_id, ev.id, ev.name, 'strafstatus_gewijzigd', auth.uid(), auth.role(),
            jsonb_build_object('team_id', new.id, 'team', new.name, 'pending_penalty', new.pending_penalty));
  end if;

  return new;
end;
$$;

drop trigger if exists log_team_changes on teams;
create trigger log_team_changes
  after update on teams
  for each row execute function log_team_changes();

-- Bingo: vakje afgevinkt of teruggezet
create or replace function log_bingo_completion_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tile_id uuid;
  v_team_id uuid;
  ev record;
begin
  if (tg_op = 'DELETE') then
    v_tile_id := old.tile_id; v_team_id := old.team_id;
  else
    v_tile_id := new.tile_id; v_team_id := new.team_id;
  end if;

  select e.id, e.name, e.community_id into ev
  from bingo_tiles bt join events e on e.id = bt.event_id
  where bt.id = v_tile_id;

  if ev.id is not null then
    insert into event_audit_log (community_id, event_id, event_name, action, actor_id, actor_db_role, details)
    values (ev.community_id, ev.id, ev.name,
            case when tg_op = 'DELETE' then 'bingo_vak_teruggezet' else 'bingo_vak_afgevinkt' end,
            auth.uid(), auth.role(),
            jsonb_build_object('tile_id', v_tile_id, 'team_id', v_team_id));
  end if;

  if (tg_op = 'DELETE') then return old; else return new; end if;
end;
$$;

drop trigger if exists log_bingo_completion_changes on bingo_completions;
create trigger log_bingo_completion_changes
  after insert or delete on bingo_completions
  for each row execute function log_bingo_completion_changes();


-- ---------------------------------------------------------------------
-- D. Strengere rechten op events
--    Vervangt de breed-toegestane policy "Organizers beheren events".
--    Organizers kunnen events nog steeds maken en wijzigen (status, config);
--    verwijderen mag alleen een OWNER en alleen van een CONCEPT-event.
-- ---------------------------------------------------------------------
drop policy if exists "Organizers beheren events" on events;
drop policy if exists "Organizers maken events" on events;
drop policy if exists "Organizers wijzigen events" on events;
drop policy if exists "Owners verwijderen concept-events" on events;

create policy "Organizers maken events" on events for insert with check (
  exists (
    select 1 from community_members m
    where m.community_id = events.community_id
      and m.profile_id = auth.uid()
      and m.role in ('owner', 'organizer')
  )
);

create policy "Organizers wijzigen events" on events for update using (
  exists (
    select 1 from community_members m
    where m.community_id = events.community_id
      and m.profile_id = auth.uid()
      and m.role in ('owner', 'organizer')
  )
);

create policy "Owners verwijderen concept-events" on events for delete using (
  events.status = 'draft' and is_community_owner(events.community_id)
);
-- De bestaande policy "Events zijn publiek leesbaar" blijft gewoon gelden.


-- ---------------------------------------------------------------------
-- E. Gebruikers mogen hun eigen rechten-vlaggen niet wijzigen
--    (voorkomt dat iemand zichzelf super-admin maakt via de publieke API)
--    Controleer eerst met:
--      select policyname, cmd, qual, with_check from pg_policies where tablename = 'profiles';
-- ---------------------------------------------------------------------
create or replace function guard_profile_flags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.is_super_admin is distinct from old.is_super_admin
      or new.can_create_communities is distinct from old.can_create_communities)
     and auth.uid() is not null
     and not coalesce((select p.is_super_admin from profiles p where p.id = auth.uid()), false) then
    raise exception 'Je mag deze instelling niet wijzigen.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_flags on profiles;
create trigger guard_profile_flags
  before update on profiles
  for each row execute function guard_profile_flags();


-- ---------------------------------------------------------------------
-- F. Testen en gebruiken
-- ---------------------------------------------------------------------
-- 1) Maak in de website een testevent, vul het, verwijder het (als owner, status Concept).
-- 2) Bekijk het archief:
--      select id, event_name, deleted_at, deleted_by from deleted_event_archives order by deleted_at desc;
-- 3) Herstel:
--      select restore_deleted_event('<id uit stap 2>');
-- 4) Bekijk het logboek (wie deed wat):
--      select created_at, action, event_name, actor_id, actor_db_role, details
--      from event_audit_log order by created_at desc limit 100;
--    Een lege actor_id betekent: de wijziging gebeurde niet via de website
--    (bijvoorbeeld direct in de Supabase-tabel of door een server-proces).
--
-- Back-up maken vóór je begint (Supabase -> Database -> Backups, of lokaal):
--      pg_dump "<connection string>" --no-owner -f massiefgoud-backup.sql


-- ---------------------------------------------------------------------
-- G. OPTIONEEL, pas na testen: profielen niet meer voor iedereen leesbaar
--    De website leest profielnamen op veel plekken (inzenders, geschiedenis,
--    ledenlijst). Een te strenge regel kan die pagina's leeg laten lijken.
--    Test dit daarom eerst op een kopie van je project.
-- ---------------------------------------------------------------------
-- drop policy if exists "Profiles zijn publiek leesbaar" on profiles;
-- create policy "Ingelogde gebruikers lezen profielen" on profiles
--   for select using (auth.uid() is not null);
-- Dit sluit anonieme bezoekers uit (met alleen de publieke anon key), maar laat
-- ingelogde gebruikers nog steeds alle profielen zien. Wil je dat ook beperken,
-- gebruik dan een view met alleen id, username en avatar_url.
