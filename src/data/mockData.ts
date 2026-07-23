import type { SamSnapshot } from "../entities/types";

const now = new Date();
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
const minutesFromNow = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();

export const mockSnapshot: SamSnapshot = {
  event: {
    id: "event-20260724",
    name: "샘 3개 매장 로테이션",
    eventDate: "2026-07-24",
    status: "active",
  },
  stores: [
    { id: "store-1", name: "샘 강남점", address: "강남", displayOrder: 1 },
    { id: "store-2", name: "샘 홍대점", address: "홍대", displayOrder: 2 },
    { id: "store-3", name: "샘 건대점", address: "건대", displayOrder: 3 },
  ],
  themes: [
    { id: "theme-1", storeId: "store-1", name: "잠긴 서재", playTimeMinutes: 60, cleanupTimeMinutes: 15, difficulty: 3, isActive: true, displayOrder: 1 },
    { id: "theme-2", storeId: "store-1", name: "검은 초대장", playTimeMinutes: 70, cleanupTimeMinutes: 15, difficulty: 4, isActive: true, displayOrder: 2 },
    { id: "theme-3", storeId: "store-1", name: "라스트 시그널", playTimeMinutes: 60, cleanupTimeMinutes: 15, difficulty: 2, isActive: true, displayOrder: 3 },
    { id: "theme-4", storeId: "store-2", name: "루프 17", playTimeMinutes: 60, cleanupTimeMinutes: 15, difficulty: 4, isActive: true, displayOrder: 1 },
    { id: "theme-5", storeId: "store-2", name: "안개 호텔", playTimeMinutes: 75, cleanupTimeMinutes: 15, difficulty: 5, isActive: true, displayOrder: 2 },
    { id: "theme-6", storeId: "store-2", name: "달빛 금고", playTimeMinutes: 60, cleanupTimeMinutes: 15, difficulty: 3, isActive: true, displayOrder: 3 },
    { id: "theme-7", storeId: "store-3", name: "붉은 실험실", playTimeMinutes: 70, cleanupTimeMinutes: 15, difficulty: 5, isActive: true, displayOrder: 1 },
    { id: "theme-8", storeId: "store-3", name: "사라진 배우", playTimeMinutes: 60, cleanupTimeMinutes: 15, difficulty: 2, isActive: true, displayOrder: 2 },
    { id: "theme-9", storeId: "store-3", name: "새벽의 문", playTimeMinutes: 60, cleanupTimeMinutes: 15, difficulty: 3, isActive: true, displayOrder: 3 },
  ],
  teams: Array.from({ length: 9 }, (_, index) => {
    const letter = String.fromCharCode(65 + index);
    return {
      id: `team-${letter}`,
      eventId: "event-20260724",
      name: `팀 ${letter}`,
      participantCode: letter,
      color: ["#2563eb", "#059669", "#dc2626", "#7c3aed", "#ca8a04", "#0891b2", "#db2777", "#475569", "#ea580c"][index],
      currentStatus: index < 5 ? "playing" : "waiting",
      assignedThemeIds: [
        `theme-${(index % 3) + 1}`,
        `theme-${((index + 1) % 3) + 4}`,
        `theme-${((index + 2) % 3) + 7}`,
      ],
    };
  }),
  themeRuns: [
    { id: "run-1", eventId: "event-20260724", teamId: "team-A", themeId: "theme-1", status: "playing", enteredAt: minutesAgo(42) },
    { id: "run-2", eventId: "event-20260724", teamId: "team-B", themeId: "theme-4", status: "playing", enteredAt: minutesAgo(35) },
    { id: "run-3", eventId: "event-20260724", teamId: "team-C", themeId: "theme-7", status: "playing", enteredAt: minutesAgo(28) },
    { id: "run-4", eventId: "event-20260724", teamId: "team-D", themeId: "theme-2", status: "playing", enteredAt: minutesAgo(18) },
    { id: "run-5", eventId: "event-20260724", teamId: "team-E", themeId: "theme-5", status: "playing", enteredAt: minutesAgo(12) },
    { id: "run-6", eventId: "event-20260724", teamId: "team-F", themeId: "theme-8", status: "completed", enteredAt: minutesAgo(95), exitedAt: minutesAgo(29) },
    { id: "run-7", eventId: "event-20260724", teamId: "team-G", themeId: "theme-3", status: "completed", enteredAt: minutesAgo(105), exitedAt: minutesAgo(43) },
    { id: "run-8", eventId: "event-20260724", teamId: "team-H", themeId: "theme-6", status: "completed", enteredAt: minutesAgo(120), exitedAt: minutesAgo(48) },
  ],
  routePlans: [
    { id: "plan-A-2", eventId: "event-20260724", teamId: "team-A", themeId: "theme-4", routeOrder: 2, status: "recommended" },
    { id: "plan-B-2", eventId: "event-20260724", teamId: "team-B", themeId: "theme-7", routeOrder: 2, status: "recommended" },
    { id: "plan-C-2", eventId: "event-20260724", teamId: "team-C", themeId: "theme-1", routeOrder: 2, status: "recommended" },
  ],
};

export const mockFutureExit = minutesFromNow;
