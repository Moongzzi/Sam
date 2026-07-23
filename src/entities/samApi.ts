import { mockSnapshot } from "../data/mockData";
import { isMockDataEnabled, isSupabaseConfigured, supabase } from "../lib/supabase";
import type { SamSnapshot, Store, Team, TeamRoutePlan, Theme, ThemeRun } from "./types";

const LOCAL_SNAPSHOT_KEY = "sam_operator_snapshot_v1";

const mapSnapshot = (rows: {
  event: unknown;
  stores: unknown[];
  themes: unknown[];
  teams: unknown[];
  themeRuns: unknown[];
  routePlans: unknown[];
}): SamSnapshot => rows as SamSnapshot;

const isLocalId = (id: string) => id.startsWith("local-");

const mapStore = (store: {
  id: string;
  name: string;
  address: string | null;
  display_order: number;
}): Store => ({
  id: store.id,
  name: store.name,
  address: store.address ?? undefined,
  displayOrder: store.display_order,
});

const mapTheme = (theme: {
  id: string;
  store_id: string;
  name: string;
  play_time_minutes: number;
  cleanup_time_minutes: number;
  difficulty: number;
  is_active: boolean;
  display_order: number;
}): Theme => ({
  id: theme.id,
  storeId: theme.store_id,
  name: theme.name,
  playTimeMinutes: theme.play_time_minutes,
  cleanupTimeMinutes: theme.cleanup_time_minutes,
  difficulty: theme.difficulty,
  isActive: theme.is_active,
  displayOrder: theme.display_order,
});

const mapTeam = (team: {
  id: string;
  event_id: string;
  name: string;
  participant_code: string | null;
  color: string;
  current_status: Team["currentStatus"];
  assigned_theme_ids: string[] | null;
}, fallbackThemeIds: string[] = []): Team => ({
  id: team.id,
  eventId: team.event_id,
  name: team.name,
  participantCode: team.participant_code ?? undefined,
  color: team.color,
  currentStatus: team.current_status,
  assignedThemeIds: team.assigned_theme_ids ?? fallbackThemeIds,
});

const mapThemeRun = (run: {
  id: string;
  event_id: string;
  team_id: string;
  theme_id: string;
  status: ThemeRun["status"];
  entered_at: string | null;
  exited_at: string | null;
  expected_exited_at: string | null;
  memo: string | null;
}): ThemeRun => ({
  id: run.id,
  eventId: run.event_id,
  teamId: run.team_id,
  themeId: run.theme_id,
  status: run.status,
  enteredAt: run.entered_at ?? undefined,
  exitedAt: run.exited_at ?? undefined,
  expectedExitedAt: run.expected_exited_at ?? undefined,
  memo: run.memo ?? undefined,
});

const mapRoutePlan = (plan: {
  id: string;
  event_id: string;
  team_id: string;
  theme_id: string;
  route_order: number;
  status: TeamRoutePlan["status"];
  planned_entered_at: string | null;
  planned_exited_at: string | null;
}): TeamRoutePlan => ({
  id: plan.id,
  eventId: plan.event_id,
  teamId: plan.team_id,
  themeId: plan.theme_id,
  routeOrder: plan.route_order,
  status: plan.status,
  plannedEnteredAt: plan.planned_entered_at ?? undefined,
  plannedExitedAt: plan.planned_exited_at ?? undefined,
});

export async function getSamSnapshot(): Promise<SamSnapshot> {
  if (!isSupabaseConfigured || !supabase) {
    if (!isMockDataEnabled) {
      throw new Error("Supabase 환경변수가 설정되지 않아 운영 데이터를 불러올 수 없습니다. VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 확인해주세요.");
    }
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    const stored = window.localStorage.getItem(LOCAL_SNAPSHOT_KEY);
    if (!stored) return mockSnapshot;
    try {
      return JSON.parse(stored) as SamSnapshot;
    } catch {
      window.localStorage.removeItem(LOCAL_SNAPSHOT_KEY);
      return mockSnapshot;
    }
  }

  const { data: event, error: eventError } = await supabase
    .from("sam_events")
    .select("id,name,event_date,status")
    .eq("status", "active")
    .order("event_date", { ascending: false })
    .limit(1)
    .single();

  if (eventError) throw eventError;

  const eventId = event.id;
  const [stores, themes, teams, themeRuns, routePlans] = await Promise.all([
    supabase.from("stores").select("id,name,address,display_order").order("display_order"),
    supabase.from("themes").select("id,store_id,name,play_time_minutes,cleanup_time_minutes,difficulty,is_active,display_order").eq("is_active", true).order("display_order"),
    supabase.from("teams").select("id,event_id,name,participant_code,color,current_status,assigned_theme_ids").eq("event_id", eventId).order("name"),
    supabase.from("theme_runs").select("id,event_id,team_id,theme_id,status,entered_at,exited_at,expected_exited_at,memo").eq("event_id", eventId),
    supabase.from("team_route_plans").select("id,event_id,team_id,theme_id,route_order,status,planned_entered_at,planned_exited_at").eq("event_id", eventId).order("route_order"),
  ]);

  for (const response of [stores, themes, teams, themeRuns, routePlans]) {
    if (response.error) throw response.error;
  }

  return mapSnapshot({
    event: {
      id: event.id,
      name: event.name,
      eventDate: event.event_date,
      status: event.status,
    },
    stores: stores.data!.map(mapStore),
    themes: themes.data!.map(mapTheme),
    teams: teams.data!.map((team) => mapTeam(team, themes.data!.map((theme) => theme.id))),
    themeRuns: themeRuns.data!.map(mapThemeRun),
    routePlans: routePlans.data!.map(mapRoutePlan),
  });
}

export function persistLocalSnapshot(snapshot: SamSnapshot) {
  if (!isSupabaseConfigured && isMockDataEnabled) {
    window.localStorage.setItem(LOCAL_SNAPSHOT_KEY, JSON.stringify(snapshot));
  }
}

export async function updateThemeRun(run: ThemeRun): Promise<ThemeRun> {
  if (!isSupabaseConfigured || !supabase) {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    return run;
  }

  const payload = {
    event_id: run.eventId,
    team_id: run.teamId,
    theme_id: run.themeId,
    status: run.status,
    entered_at: run.enteredAt ?? null,
    exited_at: run.exitedAt ?? null,
    expected_exited_at: run.expectedExitedAt ?? null,
    memo: run.memo ?? null,
  };

  const query = isLocalId(run.id)
    ? supabase.from("theme_runs").insert(payload).select("id,event_id,team_id,theme_id,status,entered_at,exited_at,expected_exited_at,memo").single()
    : supabase
      .from("theme_runs")
      .update({
        status: run.status,
        entered_at: run.enteredAt ?? null,
        exited_at: run.exitedAt ?? null,
        expected_exited_at: run.expectedExitedAt ?? null,
        memo: run.memo ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", run.id)
      .select("id,event_id,team_id,theme_id,status,entered_at,exited_at,expected_exited_at,memo")
      .single();

  const { data, error } = await query;

  if (error) throw error;
  return mapThemeRun(data);
}

export async function saveStore(store: Store): Promise<Store> {
  if (!isSupabaseConfigured || !supabase) {
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    return store;
  }

  const payload = {
    name: store.name,
    address: store.address ?? null,
    display_order: store.displayOrder,
  };
  const query = isLocalId(store.id)
    ? supabase.from("stores").insert(payload).select("id,name,address,display_order").single()
    : supabase.from("stores").update(payload).eq("id", store.id).select("id,name,address,display_order").single();
  const { data, error } = await query;

  if (error) throw error;
  return mapStore(data);
}

export async function deleteStore(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase || isLocalId(id)) return;

  const { error } = await supabase.from("stores").delete().eq("id", id);
  if (error) throw error;
}

export async function saveTheme(theme: Theme): Promise<Theme> {
  if (!isSupabaseConfigured || !supabase) {
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    return theme;
  }

  const payload = {
    store_id: theme.storeId,
    name: theme.name,
    play_time_minutes: theme.playTimeMinutes,
    cleanup_time_minutes: theme.cleanupTimeMinutes,
    difficulty: theme.difficulty,
    is_active: theme.isActive,
    display_order: theme.displayOrder,
  };
  const query = isLocalId(theme.id)
    ? supabase.from("themes").insert(payload).select("id,store_id,name,play_time_minutes,cleanup_time_minutes,difficulty,is_active,display_order").single()
    : supabase.from("themes").update(payload).eq("id", theme.id).select("id,store_id,name,play_time_minutes,cleanup_time_minutes,difficulty,is_active,display_order").single();
  const { data, error } = await query;

  if (error) throw error;
  return mapTheme(data);
}

export async function deleteTheme(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase || isLocalId(id)) return;

  const { error } = await supabase.from("themes").delete().eq("id", id);
  if (error) throw error;
}

export async function saveTeam(team: Team): Promise<Team> {
  if (!isSupabaseConfigured || !supabase) {
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    return team;
  }

  const payload = {
    event_id: team.eventId,
    name: team.name,
    participant_code: team.participantCode ?? null,
    color: team.color,
    current_status: team.currentStatus,
    assigned_theme_ids: team.assignedThemeIds,
  };
  const query = isLocalId(team.id)
    ? supabase.from("teams").insert(payload).select("id,event_id,name,participant_code,color,current_status,assigned_theme_ids").single()
    : supabase.from("teams").update(payload).eq("id", team.id).select("id,event_id,name,participant_code,color,current_status,assigned_theme_ids").single();
  const { data, error } = await query;

  if (error) throw error;
  return mapTeam(data);
}

export async function deleteTeam(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase || isLocalId(id)) return;

  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) throw error;
}

export async function replaceTeamRoutePlan(plan: TeamRoutePlan): Promise<TeamRoutePlan> {
  if (!isSupabaseConfigured || !supabase) {
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    return plan;
  }

  const { error: deleteError } = await supabase
    .from("team_route_plans")
    .delete()
    .eq("event_id", plan.eventId)
    .eq("team_id", plan.teamId)
    .neq("status", "completed");

  if (deleteError) throw deleteError;

  const { data, error } = await supabase
    .from("team_route_plans")
    .insert({
      event_id: plan.eventId,
      team_id: plan.teamId,
      theme_id: plan.themeId,
      route_order: plan.routeOrder,
      status: plan.status,
      planned_entered_at: plan.plannedEnteredAt ?? null,
      planned_exited_at: plan.plannedExitedAt ?? null,
    })
    .select("id,event_id,team_id,theme_id,route_order,status,planned_entered_at,planned_exited_at")
    .single();

  if (error) throw error;
  return mapRoutePlan(data);
}

export async function updateRoutePlan(plan: TeamRoutePlan): Promise<TeamRoutePlan> {
  if (!isSupabaseConfigured || !supabase) {
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    return plan;
  }

  const { data, error } = await supabase
    .from("team_route_plans")
    .update({
      status: plan.status,
      theme_id: plan.themeId,
      route_order: plan.routeOrder,
      planned_entered_at: plan.plannedEnteredAt ?? null,
      planned_exited_at: plan.plannedExitedAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", plan.id)
    .select("id,event_id,team_id,theme_id,route_order,status,planned_entered_at,planned_exited_at")
    .single();

  if (error) throw error;
  return mapRoutePlan(data);
}
