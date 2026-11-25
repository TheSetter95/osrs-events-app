-- =====================================================================
-- Stap 33: opdrachtenbibliotheek (gedeelde database voor Bingo, Ganzebord
-- en Miljoenenjacht)
-- Voer dit uit in Supabase -> SQL Editor.
--
-- LET OP: niet getest tegen jouw echte database. Voer het in een keer uit,
-- lees de uitvoer, en test daarna op de pagina /opdrachten.
--
-- Rechten (zoals afgesproken):
--  - Alle owners (van welke community dan ook) en sitebeheerders mogen alle
--    opdrachten LEZEN en nieuwe opdrachten TOEVOEGEN.
--  - Alleen de maker (en een sitebeheerder) mag een opdracht WIJZIGEN of VERWIJDEREN.
-- Vereist: stap 28 (profiles.is_super_admin).
-- =====================================================================

-- Hulpfuncties (security definer, zodat de policies geen eindeloze lus maken)
create or replace function is_any_community_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from community_members
    where profile_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_super_admin from profiles where id = auth.uid()), false);
$$;

grant execute on function is_any_community_owner() to authenticated;
grant execute on function is_site_admin() to authenticated;

-- De tabel
create table if not exists assignment_templates (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  title text not null,
  description text not null,

  -- Voor welke spelvormen is deze opdracht bedoeld?
  game_types text[] not null default '{}',

  -- 'verzamel_item' = items verzamelen (met item-ID's, zodat de plugin het kan volgen)
  -- 'tekst' = een gewone opdracht zonder item-controle
  kind text not null default 'tekst',

  -- Zelfde vorm als de vakjes-editor van het Ganzebord/Bingo gebruikt:
  -- [{ "label": "...", "quantity": 1, "items": [{ "itemId": 1234, "itemName": "Abyssal whip" }, ...] }, ...]
  -- Meerdere items in een groep zijn alternatieven voor elkaar.
  requirement_groups jsonb not null default '[]'::jsonb,

  wiki_url text,

  difficulty text,                      -- makkelijk | gemiddeld | moeilijk (leeg = niet ingesteld)
  membership text not null default 'beide',  -- f2p | p2p | beide
  tags text[] not null default '{}',

  constraint assignment_title_len check (char_length(title) between 1 and 100),
  constraint assignment_description_len check (char_length(description) between 1 and 1000),
  constraint assignment_game_types check (
    cardinality(game_types) >= 1
    and game_types <@ array['bingo', 'ganzebord', 'miljoenenjacht']
  ),
  constraint assignment_kind check (kind in ('verzamel_item', 'tekst')),
  constraint assignment_groups_array check (jsonb_typeof(requirement_groups) = 'array'),
  constraint assignment_difficulty check (difficulty is null or difficulty in ('makkelijk', 'gemiddeld', 'moeilijk')),
  constraint assignment_membership check (membership in ('f2p', 'p2p', 'beide'))
);

create index if not exists assignment_templates_created_at_idx on assignment_templates (created_at desc);
create index if not exists assignment_templates_game_types_idx on assignment_templates using gin (game_types);

-- updated_at automatisch bijwerken
create or replace function set_assignment_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_assignment_updated_at on assignment_templates;
create trigger set_assignment_updated_at
  before update on assignment_templates
  for each row execute function set_assignment_updated_at();

-- Beveiliging
alter table assignment_templates enable row level security;

drop policy if exists "Owners lezen opdrachten" on assignment_templates;
create policy "Owners lezen opdrachten" on assignment_templates
  for select using (is_any_community_owner() or is_site_admin());

drop policy if exists "Owners voegen opdrachten toe" on assignment_templates;
create policy "Owners voegen opdrachten toe" on assignment_templates
  for insert with check (
    (is_any_community_owner() or is_site_admin()) and created_by = auth.uid()
  );

drop policy if exists "Maker wijzigt eigen opdrachten" on assignment_templates;
create policy "Maker wijzigt eigen opdrachten" on assignment_templates
  for update using (created_by = auth.uid() or is_site_admin())
  with check (created_by = auth.uid() or is_site_admin());

drop policy if exists "Maker verwijdert eigen opdrachten" on assignment_templates;
create policy "Maker verwijdert eigen opdrachten" on assignment_templates
  for delete using (created_by = auth.uid() or is_site_admin());

-- Controle na het uitvoeren (als je ingelogd bent als owner in de website
-- werkt de pagina /opdrachten; in de SQL Editor kun je dit bekijken):
--   select count(*) from assignment_templates;
--   select policyname, cmd from pg_policies where tablename = 'assignment_templates';
