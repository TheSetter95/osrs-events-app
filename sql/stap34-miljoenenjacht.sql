-- ============================================================================
-- STAP 34: Miljoenenjacht
-- ============================================================================
-- Voeg toe: spelvorm "miljoenenjacht" (koffers + opdrachtenlijst + pulls).
-- UNTESTED: draai in delen (de blokken zijn genummerd) en test op een testevent.
-- Vereist: stap 28 en stap 33 zijn al gedraaid.
--
-- Opzet in het kort:
--   * mj_assignments (+ requirements, accepted items, submissions, completions)
--     werken net als Bingo: een team voltooit een opdracht -> 1 pull.
--   * mj_cases = de koffers. Iedereen mag zien WELKE koffers open zijn en wat erin zat.
--   * mj_case_prizes = de geheime inhoud van gesloten koffers. Alleen
--     organizers/owners kunnen dit lezen. Bij het openen kopieert de database-functie
--     mj_open_case() de prijs naar mj_cases.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Event-type 'miljoenenjacht' toestaan
-- ----------------------------------------------------------------------------
-- Afhankelijk van hoe events.type is opgezet is dit een CHECK-regel of een enum.
-- Dit blok past zich aan. Controleer daarna met de SELECT onderaan dit blok.
do $$
declare
  col_type text;
  enum_name text;
  con record;
begin
  select data_type, udt_name into col_type, enum_name
  from information_schema.columns
  where table_schema = 'public' and table_name = 'events' and column_name = 'type';

  if col_type = 'USER-DEFINED' then
    execute format('alter type %I add value if not exists %L', enum_name, 'miljoenenjacht');
  else
    for con in
      select conname
      from pg_constraint
      where conrelid = 'public.events'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%pvp_toernooi%'
    loop
      execute format('alter table public.events drop constraint %I', con.conname);
    end loop;

    alter table public.events
      add constraint events_type_check
      check (type in ('bingo','ganzebord','droprace','gauntlet','pvp_toernooi','miljoenenjacht'));
  end if;
end $$;

-- Controle: moet 'miljoenenjacht' bevatten (of bij een enum: de enum-waarden tonen)
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'public.events'::regclass and contype = 'c';


-- ----------------------------------------------------------------------------
-- 2. Hulpfuncties (security definer, zodat RLS-regels er veilig gebruik van kunnen maken)
-- ----------------------------------------------------------------------------
create or replace function public.mj_event_role(p_event uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select cm.role
  from public.events e
  join public.community_members cm on cm.community_id = e.community_id
  where e.id = p_event and cm.profile_id = auth.uid()
  limit 1
$$;

create or replace function public.mj_is_event_member(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mj_event_role(p_event) is not null
$$;

create or replace function public.mj_is_event_manager(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.mj_event_role(p_event) in ('owner','organizer'), false)
$$;

create or replace function public.mj_is_event_owner(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.mj_event_role(p_event) = 'owner', false)
$$;

-- Zit de ingelogde gebruiker in dit team? (koppeling loopt via Discord-ID, net als de plugin)
create or replace function public.mj_is_team_member(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.participants p
    join public.profiles pr on pr.discord_id = p.discord_id
    where p.team_id = p_team and pr.id = auth.uid()
  )
$$;

grant execute on function public.mj_event_role(uuid) to authenticated;
grant execute on function public.mj_is_event_member(uuid) to authenticated;
grant execute on function public.mj_is_event_manager(uuid) to authenticated;
grant execute on function public.mj_is_event_owner(uuid) to authenticated;
grant execute on function public.mj_is_team_member(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 3. Tabellen
-- ----------------------------------------------------------------------------
create table if not exists public.mj_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  position int not null check (position >= 1),
  title text not null,
  description text,
  wiki_url text,
  image_url text,
  glow_color text,
  effect_type text not null default 'geen' check (effect_type in ('geen','verzamel_item')),
  created_at timestamptz not null default now(),
  unique (event_id, position)
);

create table if not exists public.mj_assignment_requirements (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.mj_assignments(id) on delete cascade,
  label text not null,
  required_quantity int not null check (required_quantity >= 1)
);

create table if not exists public.mj_requirement_accepted_items (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.mj_assignment_requirements(id) on delete cascade,
  item_id bigint not null,
  item_name text not null
);

create table if not exists public.mj_item_submissions (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.mj_assignment_requirements(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  quantity int not null check (quantity >= 1),
  source text not null check (source in ('plugin','screenshot')),
  status text not null default 'pending' check (status in ('confirmed','pending','rejected')),
  screenshot_url text,
  rejection_reason text,
  submitted_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.mj_completions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.mj_assignments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (assignment_id, team_id)
);

create table if not exists public.mj_cases (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  case_number int not null check (case_number >= 1),
  opened_at timestamptz,
  opened_by_team_id uuid references public.teams(id) on delete set null,
  opened_by_profile uuid references public.profiles(id) on delete set null,
  revealed_label text,
  revealed_gp bigint,
  unique (event_id, case_number)
);

create table if not exists public.mj_case_prizes (
  case_id uuid primary key references public.mj_cases(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 100),
  gp_value bigint check (gp_value is null or gp_value >= 0)
);

create index if not exists mj_assignments_event_idx on public.mj_assignments(event_id);
create index if not exists mj_requirements_assignment_idx on public.mj_assignment_requirements(assignment_id);
create index if not exists mj_accepted_items_requirement_idx on public.mj_requirement_accepted_items(requirement_id);
create index if not exists mj_accepted_items_item_idx on public.mj_requirement_accepted_items(item_id);
create index if not exists mj_submissions_requirement_team_idx on public.mj_item_submissions(requirement_id, team_id);
create index if not exists mj_completions_team_idx on public.mj_completions(team_id);
create index if not exists mj_cases_event_idx on public.mj_cases(event_id);


-- ----------------------------------------------------------------------------
-- 4. Row Level Security
-- ----------------------------------------------------------------------------
alter table public.mj_assignments enable row level security;
alter table public.mj_assignment_requirements enable row level security;
alter table public.mj_requirement_accepted_items enable row level security;
alter table public.mj_item_submissions enable row level security;
alter table public.mj_completions enable row level security;
alter table public.mj_cases enable row level security;
alter table public.mj_case_prizes enable row level security;

-- mj_assignments: leden lezen, organizers/owners beheren
drop policy if exists mj_assignments_select on public.mj_assignments;
create policy mj_assignments_select on public.mj_assignments
  for select to authenticated using (public.mj_is_event_member(event_id));

drop policy if exists mj_assignments_manage on public.mj_assignments;
create policy mj_assignments_manage on public.mj_assignments
  for all to authenticated
  using (public.mj_is_event_manager(event_id))
  with check (public.mj_is_event_manager(event_id));

-- requirements: via de opdracht naar het event
drop policy if exists mj_requirements_select on public.mj_assignment_requirements;
create policy mj_requirements_select on public.mj_assignment_requirements
  for select to authenticated using (
    exists (select 1 from public.mj_assignments a
            where a.id = assignment_id and public.mj_is_event_member(a.event_id))
  );

drop policy if exists mj_requirements_manage on public.mj_assignment_requirements;
create policy mj_requirements_manage on public.mj_assignment_requirements
  for all to authenticated
  using (exists (select 1 from public.mj_assignments a
                 where a.id = assignment_id and public.mj_is_event_manager(a.event_id)))
  with check (exists (select 1 from public.mj_assignments a
                      where a.id = assignment_id and public.mj_is_event_manager(a.event_id)));

-- accepted items: via requirement -> opdracht -> event
drop policy if exists mj_accepted_select on public.mj_requirement_accepted_items;
create policy mj_accepted_select on public.mj_requirement_accepted_items
  for select to authenticated using (
    exists (select 1 from public.mj_assignment_requirements r
            join public.mj_assignments a on a.id = r.assignment_id
            where r.id = requirement_id and public.mj_is_event_member(a.event_id))
  );

drop policy if exists mj_accepted_manage on public.mj_requirement_accepted_items;
create policy mj_accepted_manage on public.mj_requirement_accepted_items
  for all to authenticated
  using (exists (select 1 from public.mj_assignment_requirements r
                 join public.mj_assignments a on a.id = r.assignment_id
                 where r.id = requirement_id and public.mj_is_event_manager(a.event_id)))
  with check (exists (select 1 from public.mj_assignment_requirements r
                      join public.mj_assignments a on a.id = r.assignment_id
                      where r.id = requirement_id and public.mj_is_event_manager(a.event_id)));

-- submissions: leden lezen; teamleden en organizers sturen in; alleen owners beoordelen
drop policy if exists mj_submissions_select on public.mj_item_submissions;
create policy mj_submissions_select on public.mj_item_submissions
  for select to authenticated using (
    exists (select 1 from public.mj_assignment_requirements r
            join public.mj_assignments a on a.id = r.assignment_id
            where r.id = requirement_id and public.mj_is_event_member(a.event_id))
  );

drop policy if exists mj_submissions_insert on public.mj_item_submissions;
create policy mj_submissions_insert on public.mj_item_submissions
  for insert to authenticated with check (
    submitted_by = auth.uid()
    and source = 'screenshot'
    and status = 'pending'
    and public.mj_is_team_member(team_id)
  );

drop policy if exists mj_submissions_review on public.mj_item_submissions;
create policy mj_submissions_review on public.mj_item_submissions
  for update to authenticated
  using (exists (select 1 from public.mj_assignment_requirements r
                 join public.mj_assignments a on a.id = r.assignment_id
                 where r.id = requirement_id and public.mj_is_event_owner(a.event_id)))
  with check (exists (select 1 from public.mj_assignment_requirements r
                      join public.mj_assignments a on a.id = r.assignment_id
                      where r.id = requirement_id and public.mj_is_event_owner(a.event_id)));

-- completions: leden lezen; organizers/owners kunnen handmatig afvinken
-- (automatische voltooiing loopt via de server met de service role)
drop policy if exists mj_completions_select on public.mj_completions;
create policy mj_completions_select on public.mj_completions
  for select to authenticated using (
    exists (select 1 from public.mj_assignments a
            where a.id = assignment_id and public.mj_is_event_member(a.event_id))
  );

drop policy if exists mj_completions_manage on public.mj_completions;
create policy mj_completions_manage on public.mj_completions
  for all to authenticated
  using (exists (select 1 from public.mj_assignments a
                 where a.id = assignment_id and public.mj_is_event_manager(a.event_id)))
  with check (exists (select 1 from public.mj_assignments a
                      where a.id = assignment_id and public.mj_is_event_manager(a.event_id)));

-- koffers: leden zien welke open zijn; alleen managers maken/wijzigen koffers.
-- Openen gebeurt uitsluitend via mj_open_case() met de service role.
drop policy if exists mj_cases_select on public.mj_cases;
create policy mj_cases_select on public.mj_cases
  for select to authenticated using (public.mj_is_event_member(event_id));

drop policy if exists mj_cases_manage on public.mj_cases;
create policy mj_cases_manage on public.mj_cases
  for all to authenticated
  using (public.mj_is_event_manager(event_id))
  with check (public.mj_is_event_manager(event_id));

-- geheime prijzen: ALLEEN managers (spelers kunnen dit nooit lezen)
drop policy if exists mj_case_prizes_manage on public.mj_case_prizes;
create policy mj_case_prizes_manage on public.mj_case_prizes
  for all to authenticated
  using (exists (select 1 from public.mj_cases c
                 where c.id = case_id and public.mj_is_event_manager(c.event_id)))
  with check (exists (select 1 from public.mj_cases c
                      where c.id = case_id and public.mj_is_event_manager(c.event_id)));


-- ----------------------------------------------------------------------------
-- 5. Koffer openen (atomair)
-- ----------------------------------------------------------------------------
-- Wordt alleen door de server aangeroepen (service role), nadat de API heeft
-- gecontroleerd dat de gebruiker bij het team hoort of organizer is.
-- Het team-record wordt vergrendeld, zodat twee tegelijke kliks niet allebei
-- dezelfde pull kunnen gebruiken. Foutcodes: geen_team, niet_actief, geen_pulls,
-- koffer_bestaat_niet, koffer_al_open.
create or replace function public.mj_open_case(
  p_event uuid,
  p_team uuid,
  p_case int,
  p_profile uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_completed int;
  v_opened int;
  v_case public.mj_cases%rowtype;
  v_prize public.mj_case_prizes%rowtype;
begin
  perform 1 from public.teams where id = p_team and event_id = p_event for update;
  if not found then
    raise exception 'geen_team';
  end if;

  select status into v_status from public.events where id = p_event;
  if v_status is distinct from 'active' then
    raise exception 'niet_actief';
  end if;

  select count(*) into v_completed
  from public.mj_completions c
  join public.mj_assignments a on a.id = c.assignment_id
  where a.event_id = p_event and c.team_id = p_team;

  select count(*) into v_opened
  from public.mj_cases
  where event_id = p_event and opened_by_team_id = p_team and opened_at is not null;

  if v_opened >= v_completed then
    raise exception 'geen_pulls';
  end if;

  select * into v_case from public.mj_cases
  where event_id = p_event and case_number = p_case for update;
  if not found then
    raise exception 'koffer_bestaat_niet';
  end if;
  if v_case.opened_at is not null then
    raise exception 'koffer_al_open';
  end if;

  select * into v_prize from public.mj_case_prizes where case_id = v_case.id;
  if not found then
    raise exception 'koffer_bestaat_niet';
  end if;

  update public.mj_cases
  set opened_at = now(),
      opened_by_team_id = p_team,
      opened_by_profile = p_profile,
      revealed_label = v_prize.label,
      revealed_gp = v_prize.gp_value
  where id = v_case.id;

  return json_build_object(
    'caseNumber', p_case,
    'label', v_prize.label,
    'gp', v_prize.gp_value,
    'pullsLeft', v_completed - v_opened - 1
  );
end;
$$;

revoke all on function public.mj_open_case(uuid, uuid, int, uuid) from public, anon, authenticated;
grant execute on function public.mj_open_case(uuid, uuid, int, uuid) to service_role;
