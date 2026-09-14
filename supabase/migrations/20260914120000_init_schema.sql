-- ============================================================
-- Joukkueen sakot — alkuperäinen tietokantaskeema
-- Supabase (PostgreSQL + Auth + RLS)
-- ============================================================
-- Kirjautuminen: Supabase Auth email+password, jossa käyttäjä näkee
-- vain "tunnus + PIN". Sovellus muodostaa synteettisen sähköpostin
-- (esim. tunnus@sakko.local) tunnuksesta, PIN toimii salasanana.
-- Tämä ei vaadi ulkoisen tilin (esim. Google) yhdistämistä.
--
-- Kirjoitukset (INSERT/UPDATE/DELETE) tehdään myöhemmässä vaiheessa
-- rakennettavien SECURITY DEFINER -funktioiden (RPC) kautta, jotka
-- vastaavat Code.gs:n funktioita (addFee, voteOnSuggestion, jne.) ja
-- tekevät samat oikeustarkistukset itse. Tässä skeemassa RLS sallii
-- toistaiseksi vain SELECT-lukuoikeudet suoraan tauluista — se pitää
-- datan turvassa jo ennen kuin liiketoimintalogiikka on rakennettu.
-- ============================================================

-- ---------- ENUMIT (check-rajoitteina, ei PG enum -tyyppeinä, jotta
-- arvojen lisääminen myöhemmin ei vaadi ALTER TYPE -migraatioita) ----------

-- ============================================================
-- PROFILES — vastaa vanhaa "Users"-sheettiä
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  global_role text not null default 'user' check (global_role in ('user','admin')),
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'Yksi rivi per rekisteröitynyt käyttäjä. id = auth.users.id. Vastaa vanhaa Users-sheettiä (UserID, PIN, GlobalRole) — PIN elää Supabase Authissa salasanana, ei tässä.';

-- Tunnus uniikki isot/pienet kirjaimet huomioimatta (vanha koodi vertasi aina toLowerCase()).
create unique index profiles_username_lower_idx on public.profiles (lower(username));

-- ============================================================
-- TEAMS — vastaa "Teams"-sheettiä + "TeamSettings"-sheetin arvot
-- omina sarakkeinaan (EAV-avain/arvo-malli ei ole tarpeen Postgresissa).
-- ============================================================
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  is_active boolean not null default true,
  -- --- entiset TeamSettings-avaimet, oletukset vastaavat SETTING_DEFAULTS ---
  vote_threshold int not null default 3 check (vote_threshold between 1 and 20),
  allow_player_suggest boolean not null default true,
  currency_symbol text not null default '€' check (char_length(currency_symbol) between 1 and 4),
  season_name text not null default '',
  max_fee_amount numeric(10,2) not null default 500 check (max_fee_amount > 0),
  created_at timestamptz not null default now()
);
comment on table public.teams is 'Joukkueet. Asetukset (entinen TeamSettings-sheetti) ovat suoraan sarakkeina, koska avainjoukko on kiinteä.';

-- ============================================================
-- TEAM_MEMBERS — vastaa "TeamMembers"-sheettiä.
-- user_id on NULL kun kyseessä on "shadow"-profiili (ei rekisteröitynyt
-- pelaaja, jolle on lisätty sakkoja etukäteen). Kun oikea käyttäjä
-- liittyy samalla käyttäjänimellä, tätä riviä päivitetään
-- (user_id asetetaan) sen sijaan, että luotaisiin uusi rivi — jolloin
-- KAIKKI tähän jäseneen linkitetyt sakot/ehdotukset siirtyvät automaattisesti
-- ilman erillistä "migroi sakot" -operaatiota (ks. fees.member_id alla).
-- Tämä korvaa vanhan koodin __shadow__<username> UserID-hakkerointia.
-- ============================================================
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  username text not null check (char_length(trim(username)) > 0),
  role text not null default 'player' check (role in ('player','approver','teamadmin')),
  status text not null default 'active' check (status in ('active','left')),
  created_at timestamptz not null default now()
);
comment on table public.team_members is 'Joukkueen jäsenyys. user_id NULL = "shadow"-profiili (ei rekisteröitynyt). Sakot ja ehdotukset viittaavat aina tähän riviin (member_id), ei suoraan profiiliin.';

-- Yhdellä rekisteröityneellä käyttäjällä korkeintaan yksi aktiivinen jäsenyys per joukkue.
create unique index team_members_active_user_idx
  on public.team_members(team_id, user_id)
  where user_id is not null and status = 'active';

-- Käyttäjänimi uniikki per joukkue (iso/pieni kirjain ei väliä) — kattaa sekä
-- rekisteröityneet että shadow-jäsenet, koska vanha _getTeamMemberByUsername
-- haki niistä molemmista erottelematta.
create unique index team_members_team_username_idx
  on public.team_members(team_id, lower(username));

create index team_members_team_id_idx on public.team_members(team_id);
create index team_members_user_id_idx on public.team_members(user_id);

-- ============================================================
-- FEE_TYPES — vastaa "FeeList"-sheettiä (nimetty selkeämmin uudelleen)
-- ============================================================
create table public.fee_types (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  reason text not null check (char_length(trim(reason)) > 0),
  default_amount numeric(10,2) not null check (default_amount >= 0),
  created_at timestamptz not null default now(),
  unique (team_id, reason)
);
comment on table public.fee_types is 'Joukkueen valmiit sakkotyypit oletussummineen. Vastaa vanhaa FeeList-sheettiä.';

-- ============================================================
-- FEES — vastaa "Fees"-sheettiä
-- ============================================================
create table public.fees (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  member_id uuid not null references public.team_members(id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  reason text not null check (char_length(trim(reason)) > 0),
  occurred_at timestamptz not null default now(),
  added_by text not null,
  status text not null default 'active' check (status in ('active','deleted','archived','paid')),
  created_at timestamptz not null default now()
);
comment on table public.fees is 'Yksittäiset sakot. team_id on tahallista denormalisointia (johdettavissa member_id:stä) RLS:n ja kyselyjen yksinkertaistamiseksi.';

create index fees_team_id_idx on public.fees(team_id);
create index fees_member_id_idx on public.fees(member_id);
create index fees_team_status_idx on public.fees(team_id, status);

-- ============================================================
-- SUGGESTIONS — vastaa "Suggestions"-sheettiä
-- ============================================================
create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  target_member_id uuid not null references public.team_members(id) on delete cascade,
  suggested_by_member_id uuid not null references public.team_members(id) on delete cascade,
  type text not null check (type in ('new_fee','removal','mark_paid')),
  amount numeric(10,2) not null check (amount >= 0),
  reason text not null check (char_length(trim(reason)) > 0),
  fee_date date,
  -- Poisto-/maksettu-ehdotus viittaa suoraan kohdesakkoon sen sijaan, että
  -- se etsittäisiin hyväksynnän yhteydessä (team_id+user+reason+amount+status)
  -- kuten vanha _applySuggestion teki — vanha tapa saattoi osua väärään
  -- riviin, jos samalla pelaajalla on kaksi identtistä aktiivista sakkoa
  -- (näin tapahtuu jo testidatassa: kaksi "TestiSakko" 6€ -sakkoa Testi3:lle).
  related_fee_id uuid references public.fees(id) on delete set null,
  comment text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
comment on table public.suggestions is 'Ehdotukset (uusi sakko / poisto / maksettu-merkintä). related_fee_id täsmentää kohdesakon suoraan poisto/maksettu-tyypeille.';

create index suggestions_team_status_idx on public.suggestions(team_id, status);

-- ============================================================
-- SUGGESTION_VOTES — korvaa vanhan Suggestions.VoterUserIDs-pilkkulistan
-- omalla taululla; estää tuplaäänet UNIQUE-rajoitteella sen sijaan että
-- sovelluskoodi tarkistaisi listan sisällön joka kerta.
-- ============================================================
create table public.suggestion_votes (
  suggestion_id uuid not null references public.suggestions(id) on delete cascade,
  member_id uuid not null references public.team_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (suggestion_id, member_id)
);
comment on table public.suggestion_votes is 'Yksi rivi per ääni. Vastaa vanhaa Suggestions.VoterUserIDs-pilkkulistaa mutta relaationaalisena.';

-- ============================================================
-- AUDIT_LOG — vastaa "AuditLog"-sheettiä
-- Lisätty team_id: vanha getAuditLog() palautti KOKO globaalin lokin
-- kenelle tahansa jonkin joukkueen TeamAdminille (tietovuoto). Uudessa
-- versiossa TeamAdmin näkee vain oman joukkueensa rivit (team_id-suodatus
-- alla olevassa RLS-politiikassa); vain GlobalAdmin näkee myös
-- joukkueettomat rivit (esim. REGISTER, SET_GLOBAL_ADMIN).
-- ============================================================
create table public.audit_log (
  id bigint generated always as identity primary key,
  team_id uuid references public.teams(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);
comment on table public.audit_log is 'Toimintoloki. team_id NULL = joukkueeton toiminto (esim. rekisteröityminen, global-admin-oikeuden muutos).';

create index audit_log_team_id_idx on public.audit_log(team_id);
create index audit_log_created_at_idx on public.audit_log(created_at desc);

-- ============================================================
-- APUFUNKTIOT ROOLITARKISTUKSIIN (käytetään RLS-politiikoissa,
-- ja myöhemmin myös RPC-funktioissa) — vastaavat Code.gs:n
-- _isGlobalAdmin / _hasTeamRole / _getTeamMember -apufunktioita.
-- security definer + kiinnitetty search_path: RLS ei estä näiden
-- omaa sisäistä lukua, ja ne ovat turvallisia kutsua mistä tahansa.
-- ============================================================
create or replace function public.is_global_admin(p_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = p_user and global_role = 'admin'
  );
$$;

create or replace function public.team_role(p_user uuid, p_team uuid)
returns text
language sql stable security definer set search_path = public as $$
  select role from public.team_members
  where team_id = p_team and user_id = p_user and status = 'active'
  limit 1;
$$;

create or replace function public.is_team_member(p_user uuid, p_team uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_global_admin(p_user) or exists (
    select 1 from public.team_members
    where team_id = p_team and user_id = p_user and status = 'active'
  );
$$;

create or replace function public.has_team_role(p_user uuid, p_team uuid, variadic p_roles text[])
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_global_admin(p_user) or public.team_role(p_user, p_team) = any(p_roles);
$$;

grant execute on function public.is_global_admin(uuid) to authenticated;
grant execute on function public.team_role(uuid, uuid) to authenticated;
grant execute on function public.is_team_member(uuid, uuid) to authenticated;
grant execute on function public.has_team_role(uuid, uuid, text[]) to authenticated;

-- ============================================================
-- checkUserExists-vastine: kirjautumisnäyttö tarvitsee tiedon onko
-- tunnus jo olemassa ENNEN kirjautumista (näyttääkseen PIN-vahvistuksen
-- uudelle käyttäjälle) — tämä pitää olla kutsuttavissa myös anon-roolilla.
-- ============================================================
create or replace function public.username_exists(p_username text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where lower(username) = lower(p_username)
  );
$$;

grant execute on function public.username_exists(text) to anon, authenticated;

-- ============================================================
-- Profiilin automaattinen luonti Auth-rekisteröinnin yhteydessä.
-- Käyttäjänimi luetaan signUp-kutsun options.data.username-kentästä.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- Vain SELECT-politiikat toistaiseksi. INSERT/UPDATE/DELETE tehdään
-- myöhemmin rakennettavien SECURITY DEFINER -funktioiden kautta, jotka
-- ohittavat RLS:n ja tekevät Code.gs:ää vastaavat oikeustarkistukset
-- itse ennen kirjoitusta.
-- ============================================================
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.fee_types enable row level security;
alter table public.fees enable row level security;
alter table public.suggestions enable row level security;
alter table public.suggestion_votes enable row level security;
alter table public.audit_log enable row level security;

-- PROFILES: näet vain oman profiilisi, tai kaikki jos olet GlobalAdmin
-- (globaali ylläpito -käyttäjälistaa varten).
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_global_admin(auth.uid()));

-- TEAMS: aktiiviset joukkueet näkyvät kaikille kirjautuneille (jotta niihin
-- voi liittyä), oman joukkueen näkee aina jäsenyyden kautta.
create policy teams_select on public.teams
  for select using (is_active or public.is_team_member(auth.uid(), id));

-- TEAM_MEMBERS: vain joukkueen jäsenet (tai GlobalAdmin) näkevät rosterin.
create policy team_members_select on public.team_members
  for select using (public.is_team_member(auth.uid(), team_id));

-- FEE_TYPES: vain joukkueen jäsenet.
create policy fee_types_select on public.fee_types
  for select using (public.is_team_member(auth.uid(), team_id));

-- FEES: vain joukkueen jäsenet (vanha getAllTeamFees salli minkä tahansa
-- aktiivisen jäsenen lukea kaikki joukkueen sakot).
create policy fees_select on public.fees
  for select using (public.is_team_member(auth.uid(), team_id));

-- SUGGESTIONS: vain joukkueen jäsenet.
create policy suggestions_select on public.suggestions
  for select using (public.is_team_member(auth.uid(), team_id));

-- SUGGESTION_VOTES: näkyvyys seuraa ehdotuksen omaa näkyvyyttä.
create policy suggestion_votes_select on public.suggestion_votes
  for select using (
    exists (
      select 1 from public.suggestions s
      where s.id = suggestion_id and public.is_team_member(auth.uid(), s.team_id)
    )
  );

-- AUDIT_LOG: GlobalAdmin näkee kaiken; joukkueen TeamAdmin näkee vain oman
-- joukkueensa rivit (vrt. yllä oleva kommentti tietovuodon korjauksesta).
create policy audit_log_select on public.audit_log
  for select using (
    public.is_global_admin(auth.uid())
    or (team_id is not null and public.has_team_role(auth.uid(), team_id, 'teamadmin'))
  );
