import type { SamSnapshot, Team, TeamRecommendation, Theme } from "../entities/types";

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

export function getThemeAvailability(theme: Theme, snapshot: SamSnapshot, now = new Date()): Date {
  const playingRun = snapshot.themeRuns.find(
    (run) => run.themeId === theme.id && run.status === "playing" && run.enteredAt,
  );

  if (!playingRun?.enteredAt) return now;

  return addMinutes(new Date(playingRun.enteredAt), theme.playTimeMinutes + theme.cleanupTimeMinutes);
}

export function getVisitedThemeIds(team: Team, snapshot: SamSnapshot) {
  return new Set(
    snapshot.themeRuns
      .filter((run) => run.teamId === team.id && run.status !== "skipped")
      .map((run) => run.themeId),
  );
}

export function getTeamCurrentRun(team: Team, snapshot: SamSnapshot) {
  return snapshot.themeRuns.find((run) => run.teamId === team.id && run.status === "playing") ?? null;
}

export function getRecommendedNextTheme(team: Team, snapshot: SamSnapshot, now = new Date()): TeamRecommendation {
  const planned = snapshot.routePlans
    .filter((plan) => plan.teamId === team.id && ["confirmed", "recommended", "pending"].includes(plan.status))
    .sort((a, b) => a.routeOrder - b.routeOrder)
    .find((plan) => !getVisitedThemeIds(team, snapshot).has(plan.themeId));

  if (planned) {
    const theme = snapshot.themes.find((item) => item.id === planned.themeId) ?? null;
    const store = snapshot.stores.find((item) => item.id === theme?.storeId) ?? null;
    return {
      team,
      theme,
      store,
      reason: planned.status === "confirmed" ? "운영자 확정 순서" : "사전 추천 순서",
      availableAt: theme ? getThemeAvailability(theme, snapshot, now) : now,
    };
  }

  const visited = getVisitedThemeIds(team, snapshot);
  const candidates = snapshot.themes
    .filter((theme) => theme.isActive && !visited.has(theme.id))
    .map((theme) => ({
      theme,
      availableAt: getThemeAvailability(theme, snapshot, now),
      storeLoad: snapshot.themeRuns.filter((run) => run.status === "playing" && run.themeId === theme.id).length,
    }))
    .sort((a, b) => {
      const timeDiff = a.availableAt.getTime() - b.availableAt.getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.theme.difficulty - b.theme.difficulty;
    });

  const best = candidates[0];
  if (!best) {
    return {
      team,
      theme: null,
      store: null,
      reason: "모든 테마를 완료했거나 활성 테마가 없습니다.",
      availableAt: now,
    };
  }

  return {
    team,
    theme: best.theme,
    store: snapshot.stores.find((store) => store.id === best.theme.storeId) ?? null,
    reason: best.availableAt <= now ? "현재 바로 입장 가능" : "가장 빨리 비는 미방문 테마",
    availableAt: best.availableAt,
  };
}

export function getAllRecommendations(snapshot: SamSnapshot, now = new Date()) {
  return snapshot.teams.map((team) => getRecommendedNextTheme(team, snapshot, now));
}
