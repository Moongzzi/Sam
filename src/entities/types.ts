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
