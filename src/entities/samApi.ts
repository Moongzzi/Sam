import { mockSnapshot } from "../data/mockData";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { SamSnapshot, ThemeRun } from "./types";

const mapSnapshot = (rows: {
  event: unknown;
  stores: unknown[];
  themes: unknown[];
  teams: unknown[];
  themeRuns: unknown[];
  routePlans: unknown[];
}): SamSnapshot => rows as SamSnapshot;

export async function getSamSnapshot(): Promise<SamSnapshot> {
  if (!isSupabaseConfigured || !supabase) {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    return mockSnapshot;
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
    supabase.from("teams").select("id,event_id,name,participant_code,color,current_status").eq("event_id", eventId).order("name"),
    supabase.from("theme_runs").select("id,event_id,team_id,theme_id,status,entered_at,exited_at,memo").eq("event_id", eventId),
    supabase.from("team_route_plans").select("id,event_id,team_id,theme_id,route_order,status").eq("event_id", eventId).order("route_order"),
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
    stores: stores.data!.map((store) => ({
      id: store.id,
      name: store.name,
      address: store.address,
      displayOrder: store.display_order,
    })),
    themes: themes.data!.map((theme) => ({
      id: theme.id,
      storeId: theme.store_id,
      name: theme.name,
      playTimeMinutes: theme.play_time_minutes,
      cleanupTimeMinutes: theme.cleanup_time_minutes,
      difficulty: theme.difficulty,
      isActive: theme.is_active,
      displayOrder: theme.display_order,
    })),
    teams: teams.data!.map((team) => ({
      id: team.id,
      eventId: team.event_id,
      name: team.name,
      participantCode: team.participant_code,
      color: team.color,
      currentStatus: team.current_status,
    })),
    themeRuns: themeRuns.data!.map((run) => ({
      id: run.id,
      eventId: run.event_id,
      teamId: run.team_id,
      themeId: run.theme_id,
      status: run.status,
      enteredAt: run.entered_at,
      exitedAt: run.exited_at,
      memo: run.memo,
    })),
    routePlans: routePlans.data!.map((plan) => ({
      id: plan.id,
      eventId: plan.event_id,
      teamId: plan.team_id,
      themeId: plan.theme_id,
      routeOrder: plan.route_order,
      status: plan.status,
    })),
  });
}

export async function updateThemeRun(run: ThemeRun): Promise<ThemeRun> {
  if (!isSupabaseConfigured || !supabase) {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    return run;
  }

  const { error } = await supabase
    .from("theme_runs")
    .update({
      status: run.status,
      entered_at: run.enteredAt ?? null,
      exited_at: run.exitedAt ?? null,
      memo: run.memo ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", run.id);

  if (error) throw error;
  return run;
}
