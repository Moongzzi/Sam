create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.themes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  play_time_minutes int not null default 60,
  cleanup_time_minutes int not null default 15,
  difficulty int not null default 3 check (difficulty between 1 and 5),
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sam_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.sam_events(id) on delete cascade,
  name text not null,
  participant_code text,
  color text not null default '#2563eb',
  current_status text not null default 'waiting' check (current_status in ('waiting', 'playing', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, name)
);

create table if not exists public.theme_runs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.sam_events(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  theme_id uuid not null references public.themes(id) on delete cascade,
  status text not null default 'planned' check (status in ('planned', 'playing', 'completed', 'skipped')),
  entered_at timestamptz,
  exited_at timestamptz,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_route_plans (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.sam_events(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  theme_id uuid not null references public.themes(id) on delete cascade,
  route_order int not null,
  status text not null default 'pending' check (status in ('pending', 'recommended', 'confirmed', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, team_id, route_order)
);

create table if not exists public.operator_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.sam_events(id) on delete set null,
  action text not null,
  target_table text not null,
  target_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_themes_store_id on public.themes(store_id);
create index if not exists idx_teams_event_id on public.teams(event_id);
create index if not exists idx_theme_runs_event_id on public.theme_runs(event_id);
create index if not exists idx_theme_runs_team_id on public.theme_runs(team_id);
create index if not exists idx_theme_runs_theme_id on public.theme_runs(theme_id);
create index if not exists idx_route_plans_event_team on public.team_route_plans(event_id, team_id);

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at before update on public.stores
for each row execute function public.set_updated_at();

drop trigger if exists themes_set_updated_at on public.themes;
create trigger themes_set_updated_at before update on public.themes
for each row execute function public.set_updated_at();

drop trigger if exists sam_events_set_updated_at on public.sam_events;
create trigger sam_events_set_updated_at before update on public.sam_events
for each row execute function public.set_updated_at();

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at before update on public.teams
for each row execute function public.set_updated_at();

drop trigger if exists theme_runs_set_updated_at on public.theme_runs;
create trigger theme_runs_set_updated_at before update on public.theme_runs
for each row execute function public.set_updated_at();

drop trigger if exists route_plans_set_updated_at on public.team_route_plans;
create trigger route_plans_set_updated_at before update on public.team_route_plans
for each row execute function public.set_updated_at();

alter table public.stores enable row level security;
alter table public.themes enable row level security;
alter table public.sam_events enable row level security;
alter table public.teams enable row level security;
alter table public.theme_runs enable row level security;
alter table public.team_route_plans enable row level security;
alter table public.operator_logs enable row level security;

drop policy if exists "public read stores" on public.stores;
create policy "public read stores" on public.stores
for select to anon, authenticated using (true);

drop policy if exists "public read themes" on public.themes;
create policy "public read themes" on public.themes
for select to anon, authenticated using (true);

drop policy if exists "public read sam events" on public.sam_events;
create policy "public read sam events" on public.sam_events
for select to anon, authenticated using (true);

drop policy if exists "public read teams" on public.teams;
create policy "public read teams" on public.teams
for select to anon, authenticated using (true);

drop policy if exists "public read theme runs" on public.theme_runs;
create policy "public read theme runs" on public.theme_runs
for select to anon, authenticated using (true);

drop policy if exists "public read route plans" on public.team_route_plans;
create policy "public read route plans" on public.team_route_plans
for select to anon, authenticated using (true);

-- MVP 단계에서는 운영자 코드가 UI 접근 제어만 담당합니다.
-- 실제 운영 쓰기 권한은 Supabase Auth + operator role 도입 후 아래 정책을 교체하세요.
-- create policy "operators can write theme runs" on public.theme_runs
-- for all to authenticated
-- using (public.is_operator(auth.uid()))
-- with check (public.is_operator(auth.uid()));

with inserted_event as (
  insert into public.sam_events (id, name, event_date, status)
  values ('00000000-0000-0000-0000-000000000724', '샘 3개 매장 로테이션', '2026-07-24', 'active')
  on conflict (id) do update set name = excluded.name, event_date = excluded.event_date, status = excluded.status
  returning id
),
inserted_stores as (
  insert into public.stores (id, name, address, display_order)
  values
    ('10000000-0000-0000-0000-000000000001', '샘 강남점', '강남', 1),
    ('10000000-0000-0000-0000-000000000002', '샘 홍대점', '홍대', 2),
    ('10000000-0000-0000-0000-000000000003', '샘 건대점', '건대', 3)
  on conflict (id) do update set name = excluded.name, address = excluded.address, display_order = excluded.display_order
  returning id
),
inserted_themes as (
  insert into public.themes (id, store_id, name, play_time_minutes, cleanup_time_minutes, difficulty, display_order)
  values
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '잠긴 서재', 60, 15, 3, 1),
    ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '검은 초대장', 70, 15, 4, 2),
    ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '라스트 시그널', 60, 15, 2, 3),
    ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', '루프 17', 60, 15, 4, 1),
    ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', '안개 호텔', 75, 15, 5, 2),
    ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', '달빛 금고', 60, 15, 3, 3),
    ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000003', '붉은 실험실', 70, 15, 5, 1),
    ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000003', '사라진 배우', 60, 15, 2, 2),
    ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000003', '새벽의 문', 60, 15, 3, 3)
  on conflict (id) do update set name = excluded.name, play_time_minutes = excluded.play_time_minutes, cleanup_time_minutes = excluded.cleanup_time_minutes, difficulty = excluded.difficulty
  returning id
)
insert into public.teams (event_id, name, participant_code, color)
select '00000000-0000-0000-0000-000000000724', '팀 ' || letter, letter, color
from (
  values
    ('A', '#2563eb'),
    ('B', '#059669'),
    ('C', '#dc2626'),
    ('D', '#7c3aed'),
    ('E', '#ca8a04'),
    ('F', '#0891b2'),
    ('G', '#db2777'),
    ('H', '#475569'),
    ('I', '#ea580c')
) as source(letter, color)
on conflict (event_id, name) do update set participant_code = excluded.participant_code, color = excluded.color;
