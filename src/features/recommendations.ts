import type { PredictedThemeRun, SamSnapshot, ScheduleConflict, Team, TeamRecommendation, Theme } from "../entities/types";

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

export function getTeamAssignedThemes(team: Team, snapshot: SamSnapshot) {
  const assignedIds = new Set(team.assignedThemeIds);
  return snapshot.themes.filter((theme) => theme.isActive && assignedIds.has(theme.id));
}

export function getThemeAvailability(theme: Theme, snapshot: SamSnapshot, now = new Date()): Date {
  const playingRun = snapshot.themeRuns.find(
    (run) => run.themeId === theme.id && run.status === "playing" && run.enteredAt,
  );

  if (!playingRun?.enteredAt) return now;

  const expectedExit = playingRun.expectedExitedAt
    ? new Date(playingRun.expectedExitedAt)
    : addMinutes(new Date(playingRun.enteredAt), theme.playTimeMinutes);
  return addMinutes(expectedExit, theme.cleanupTimeMinutes);
}

export function getVisitedThemeIds(team: Team, snapshot: SamSnapshot) {
  return new Set(
    snapshot.themeRuns
      .filter((run) => run.teamId === team.id && ["playing", "completed"].includes(run.status))
      .map((run) => run.themeId),
  );
}

export function getTeamCurrentRun(team: Team, snapshot: SamSnapshot) {
  return snapshot.themeRuns.find((run) => run.teamId === team.id && run.status === "playing") ?? null;
}

export function getRecommendedNextTheme(team: Team, snapshot: SamSnapshot, now = new Date()): TeamRecommendation {
  if (team.currentStatus === "finished") {
    return { team, theme: null, store: null, reason: "운영이 종료된 팀입니다.", availableAt: now };
  }
  const planned = snapshot.routePlans
    .filter((plan) => plan.teamId === team.id && ["confirmed", "recommended", "pending"].includes(plan.status))
    .filter((plan) => getTeamAssignedThemes(team, snapshot).some((theme) => theme.id === plan.themeId))
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
  const candidates = getTeamAssignedThemes(team, snapshot)
    .filter((theme) => !visited.has(theme.id))
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

export function getPredictedSchedule(snapshot: SamSnapshot, now = new Date()): PredictedThemeRun[] {
  const activeThemes = snapshot.themes.filter((theme) => theme.isActive);
  const teamAvailableAt = new Map(snapshot.teams.map((team) => {
    const currentRun = getTeamCurrentRun(team, snapshot);
    const theme = activeThemes.find((item) => item.id === currentRun?.themeId);
    const enteredAt = currentRun?.enteredAt ? new Date(currentRun.enteredAt) : null;
    const expectedExit = currentRun?.expectedExitedAt ? new Date(currentRun.expectedExitedAt) : null;
    return [team.id, expectedExit ?? (enteredAt && theme ? addMinutes(enteredAt, theme.playTimeMinutes) : now)] as const;
  }));
  const themeAvailableAt = new Map(activeThemes.map((theme) => [
    theme.id,
    getThemeAvailability(theme, snapshot, now),
  ]));
  const visitedByTeam = new Map(snapshot.teams.map((team) => [team.id, getVisitedThemeIds(team, snapshot)]));
  const routeOrderByTeam = new Map(snapshot.teams.map((team) => [team.id, 1]));
  const predictions: PredictedThemeRun[] = [];
  const maximumAssignments = snapshot.teams.length * activeThemes.length;

  for (let assignment = 0; assignment < maximumAssignments; assignment += 1) {
    const nextTeam = snapshot.teams
      .filter((team) => team.currentStatus !== "finished")
      .filter((team) => getTeamAssignedThemes(team, snapshot).some((theme) => !visitedByTeam.get(team.id)?.has(theme.id)))
      .sort((first, second) => {
        const timeDifference = (teamAvailableAt.get(first.id)?.getTime() ?? 0) - (teamAvailableAt.get(second.id)?.getTime() ?? 0);
        if (timeDifference !== 0) return timeDifference;
        return snapshot.teams.indexOf(first) - snapshot.teams.indexOf(second);
      })[0];

    if (!nextTeam) break;

    const visited = visitedByTeam.get(nextTeam.id) ?? new Set<string>();
    const assignedThemes = getTeamAssignedThemes(nextTeam, snapshot);
    const plannedPlan = snapshot.routePlans
      .filter((plan) => plan.teamId === nextTeam.id && ["confirmed", "recommended", "pending"].includes(plan.status))
      .sort((first, second) => first.routeOrder - second.routeOrder)
      .find((plan) => assignedThemes.some((theme) => theme.id === plan.themeId) && !visited.has(plan.themeId));
    const plannedTheme = plannedPlan ? assignedThemes.find((theme) => theme.id === plannedPlan.themeId) : undefined;
    const theme = plannedTheme ?? assignedThemes
      .filter((item) => !visited.has(item.id))
      .sort((first, second) => {
        const timeDifference = (themeAvailableAt.get(first.id)?.getTime() ?? 0) - (themeAvailableAt.get(second.id)?.getTime() ?? 0);
        if (timeDifference !== 0) return timeDifference;
        const difficultyDifference = first.difficulty - second.difficulty;
        if (difficultyDifference !== 0) return difficultyDifference;
        return first.displayOrder - second.displayOrder;
      })[0];

    if (!theme) break;

    const fixedEnteredAt = plannedPlan?.status === "confirmed" && plannedPlan.plannedEnteredAt
      ? new Date(plannedPlan.plannedEnteredAt)
      : null;
    const fixedExitedAt = plannedPlan?.status === "confirmed" && plannedPlan.plannedExitedAt
      ? new Date(plannedPlan.plannedExitedAt)
      : null;
    const enteredAt = fixedEnteredAt ?? new Date(Math.max(
      teamAvailableAt.get(nextTeam.id)?.getTime() ?? now.getTime(),
      themeAvailableAt.get(theme.id)?.getTime() ?? now.getTime(),
      now.getTime(),
    ));
    const exitedAt = fixedExitedAt ?? addMinutes(enteredAt, theme.playTimeMinutes);
    const availableAt = addMinutes(exitedAt, theme.cleanupTimeMinutes);
    const routeOrder = routeOrderByTeam.get(nextTeam.id) ?? 1;

    predictions.push({
      id: `predicted-${nextTeam.id}-${theme.id}`,
      teamId: nextTeam.id,
      themeId: theme.id,
      enteredAt,
      exitedAt,
      availableAt,
      routeOrder,
      reason: plannedPlan?.status === "confirmed" ? "운영자 확정 순서" : plannedTheme ? "사전 지정 순서" : "가장 빠른 미방문 테마",
      isConfirmed: plannedPlan?.status === "confirmed",
    });
    visited.add(theme.id);
    visitedByTeam.set(nextTeam.id, visited);
    teamAvailableAt.set(nextTeam.id, exitedAt);
    themeAvailableAt.set(theme.id, availableAt);
    routeOrderByTeam.set(nextTeam.id, routeOrder + 1);
  }

  return predictions;
}

export function getScheduleConflicts(snapshot: SamSnapshot, predictions: PredictedThemeRun[]): ScheduleConflict[] {
  const confirmed = predictions.filter((prediction) => prediction.isConfirmed);
  const conflicts: ScheduleConflict[] = [];

  for (const prediction of confirmed) {
    const theme = snapshot.themes.find((item) => item.id === prediction.themeId);
    const team = snapshot.teams.find((item) => item.id === prediction.teamId);
    if (!theme || !team) continue;

    const candidates = [
      ...snapshot.themeRuns
        .filter((run) => ["playing", "completed"].includes(run.status) && run.enteredAt)
        .map((run) => {
          const runTheme = snapshot.themes.find((item) => item.id === run.themeId);
          const runTeam = snapshot.teams.find((item) => item.id === run.teamId);
          if (!runTheme || !runTeam || !run.enteredAt) return null;
          const enteredAt = new Date(run.enteredAt);
          const exitedAt = run.exitedAt
            ? new Date(run.exitedAt)
            : run.expectedExitedAt
              ? new Date(run.expectedExitedAt)
              : addMinutes(enteredAt, runTheme.playTimeMinutes);
          return { id: run.id, teamId: run.teamId, themeId: run.themeId, enteredAt, exitedAt, label: `${runTeam.name} · ${runTheme.name} 실제 진행` };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
      ...confirmed
        .filter((item) => item.id !== prediction.id)
        .map((item) => {
          const itemTeam = snapshot.teams.find((teamItem) => teamItem.id === item.teamId);
          const itemTheme = snapshot.themes.find((themeItem) => themeItem.id === item.themeId);
          return { id: item.id, teamId: item.teamId, themeId: item.themeId, enteredAt: item.enteredAt, exitedAt: item.exitedAt, label: `${itemTeam?.name} · ${itemTheme?.name} 확정 일정` };
        }),
    ];

    for (const candidate of candidates) {
      const sameTeam = candidate.teamId === prediction.teamId;
      const sameTheme = candidate.themeId === prediction.themeId;
      if (!sameTeam && !sameTheme) continue;
      const cleanupMinutes = sameTheme ? theme.cleanupTimeMinutes : 0;
      const predictionEnd = addMinutes(prediction.exitedAt, cleanupMinutes);
      const candidateEnd = sameTheme ? addMinutes(candidate.exitedAt, cleanupMinutes) : candidate.exitedAt;
      const overlaps = prediction.enteredAt < candidateEnd && candidate.enteredAt < predictionEnd;
      if (!overlaps) continue;
      conflicts.push({
        predictionId: prediction.id,
        reason: sameTeam ? "같은 팀의 일정이 겹칩니다." : "같은 테마의 진행·정리 시간이 겹칩니다.",
        conflictingLabel: candidate.label,
      });
    }
  }

  return conflicts;
}
