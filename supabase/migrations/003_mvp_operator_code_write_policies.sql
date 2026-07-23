-- MVP policy for the current 0724 operator-code flow.
-- The database cannot verify the UI-only code, so these write policies are intended
-- only until Supabase Auth/operator roles are introduced.

drop policy if exists "mvp anon write stores" on public.stores;
create policy "mvp anon write stores" on public.stores
for all to anon, authenticated
using (true)
with check (true);

drop policy if exists "mvp anon write themes" on public.themes;
create policy "mvp anon write themes" on public.themes
for all to anon, authenticated
using (true)
with check (true);

drop policy if exists "mvp anon write teams" on public.teams;
create policy "mvp anon write teams" on public.teams
for all to anon, authenticated
using (true)
with check (true);

drop policy if exists "mvp anon write theme runs" on public.theme_runs;
create policy "mvp anon write theme runs" on public.theme_runs
for all to anon, authenticated
using (true)
with check (true);

drop policy if exists "mvp anon write route plans" on public.team_route_plans;
create policy "mvp anon write route plans" on public.team_route_plans
for all to anon, authenticated
using (true)
with check (true);
