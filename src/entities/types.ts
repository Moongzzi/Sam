export type Store = {
  id: string;
  name: string;
  address?: string;
  displayOrder: number;
};

export type Theme = {
  id: string;
  storeId: string;
  name: string;
  playTimeMinutes: number;
  cleanupTimeMinutes: number;
  difficulty: number;
  isActive: boolean;
  displayOrder: number;
};

export type SamEvent = {
  id: string;
  name: string;
  eventDate: string;
  status: "draft" | "active" | "completed";
};

export type Team = {
  id: string;
  eventId: string;
  name: string;
  participantCode?: string;
  color: string;
  currentStatus: "waiting" | "playing" | "finished";
  assignedThemeIds: string[];
};

export type ThemeRunStatus = "planned" | "playing" | "completed" | "skipped";

export type ThemeRun = {
  id: string;
  eventId: string;
  teamId: string;
  themeId: string;
  status: ThemeRunStatus;
  enteredAt?: string;
  exitedAt?: string;
  expectedExitedAt?: string;
  memo?: string;
};

export type RoutePlanStatus = "pending" | "recommended" | "confirmed" | "completed";

export type TeamRoutePlan = {
  id: string;
  eventId: string;
  teamId: string;
  themeId: string;
  routeOrder: number;
  status: RoutePlanStatus;
  plannedEnteredAt?: string;
  plannedExitedAt?: string;
};

export type SamSnapshot = {
  event: SamEvent;
  stores: Store[];
  themes: Theme[];
  teams: Team[];
  themeRuns: ThemeRun[];
  routePlans: TeamRoutePlan[];
};

export type TeamRecommendation = {
  team: Team;
  theme: Theme | null;
  store: Store | null;
  reason: string;
  availableAt: Date;
};

export type PredictedThemeRun = {
  id: string;
  teamId: string;
  themeId: string;
  enteredAt: Date;
  exitedAt: Date;
  availableAt: Date;
  routeOrder: number;
  reason: string;
  isConfirmed: boolean;
};

export type ScheduleConflict = {
  predictionId: string;
  reason: string;
  conflictingLabel: string;
};
