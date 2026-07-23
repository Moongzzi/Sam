alter table public.teams
add column if not exists assigned_theme_ids uuid[] not null default '{}';

alter table public.theme_runs
add column if not exists expected_exited_at timestamptz;

alter table public.team_route_plans
add column if not exists planned_entered_at timestamptz,
add column if not exists planned_exited_at timestamptz;

update public.teams
set assigned_theme_ids = array(select id from public.themes where is_active)
where cardinality(assigned_theme_ids) = 0;

create index if not exists idx_teams_assigned_theme_ids
on public.teams using gin (assigned_theme_ids);

comment on column public.teams.assigned_theme_ids is
'Themes this team is scheduled to participate in. Empty means no assigned themes.';

comment on column public.theme_runs.expected_exited_at is
'Operator-adjusted expected exit time for an active run; actual exit remains in exited_at.';

comment on column public.team_route_plans.planned_entered_at is
'Fixed entry time captured when an operator confirms a predicted assignment.';

comment on column public.team_route_plans.planned_exited_at is
'Fixed exit time captured when an operator confirms a predicted assignment.';
