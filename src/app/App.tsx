import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, CheckCircle2, Clock, DoorOpen, Flag, KeyRound, MapPinned, RefreshCw, UsersRound } from "lucide-react";
import { getSamSnapshot, updateThemeRun } from "../entities/samApi";
import type { SamSnapshot, Team, ThemeRun, ThemeRunStatus } from "../entities/types";
import { getAllRecommendations, getRecommendedNextTheme, getTeamCurrentRun, getThemeAvailability } from "../features/recommendations";

type View = "home" | "operator-code" | "operator" | "participant";

const OPERATOR_CODE = "0724";

export function App() {
  const [view, setView] = useState<View>("home");
  const [isOperatorVerified, setIsOperatorVerified] = useState(() => sessionStorage.getItem("sam_operator_verified") === "true");

  const goOperator = () => {
    setView(isOperatorVerified ? "operator" : "operator-code");
  };

  return (
    <>
      {view === "home" && <HomePage onOperator={goOperator} onParticipant={() => setView("participant")} />}
      {view === "operator-code" && (
        <OperatorCodePage
          onBack={() => setView("home")}
          onSuccess={() => {
            sessionStorage.setItem("sam_operator_verified", "true");
            setIsOperatorVerified(true);
            setView("operator");
          }}
        />
      )}
      {view === "operator" && <DashboardFrame mode="operator" onBack={() => setView("home")} />}
      {view === "participant" && <DashboardFrame mode="participant" onBack={() => setView("home")} />}
    </>
  );
}

function HomePage({ onOperator, onParticipant }: { onOperator: () => void; onParticipant: () => void }) {
  return (
    <main className="home">
      <section className="home__hero">
        <p className="eyebrow">Escape rotation control</p>
        <h1>샘 운영 시스템</h1>
        <p className="home__copy">3개 매장의 테마를 A-I팀이 빠르게 순환하도록 현황과 다음 이동을 관리합니다.</p>
      </section>

      <section className="menu-grid" aria-label="메인 메뉴">
        <button className="menu-card menu-card--operator" type="button" onClick={onOperator}>
          <span className="menu-card__icon"><KeyRound size={26} /></span>
          <span>
            <strong>샘 운영자 메뉴</strong>
            <small>추천 배정, 입장/퇴장 기록 수정</small>
          </span>
        </button>
        <button className="menu-card" type="button" onClick={onParticipant}>
          <span className="menu-card__icon"><UsersRound size={26} /></span>
          <span>
            <strong>샘 참가자 메뉴</strong>
            <small>우리 팀 다음 테마와 전체 현황 확인</small>
          </span>
        </button>
      </section>
    </main>
  );
}

function OperatorCodePage({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (code !== OPERATOR_CODE) {
      setError("입장 코드가 올바르지 않습니다.");
      return;
    }
    onSuccess();
  };

  return (
    <main className="page page--narrow">
      <Header title="운영자 입장" onBack={onBack} />
      <form className="code-panel" onSubmit={submit}>
        <label htmlFor="operator-code">4자리 입장 코드</label>
        <input
          id="operator-code"
          value={code}
          onChange={(event) => {
            setCode(event.target.value.replace(/\D/g, "").slice(0, 4));
            setError("");
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="0724"
        />
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" type="submit">입장</button>
      </form>
    </main>
  );
}

function DashboardFrame({ mode, onBack }: { mode: "operator" | "participant"; onBack: () => void }) {
  const [snapshot, setSnapshot] = useState<SamSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      setSnapshot(await getSamSnapshot());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page">
      <Header
        title={mode === "operator" ? "운영자 대시보드" : "참가자 현황판"}
        onBack={onBack}
        action={<button className="icon-button" type="button" onClick={load} aria-label="새로고침"><RefreshCw size={18} /></button>}
      />

      {loading && <StateMessage title="불러오는 중" body="샘 진행 현황을 확인하고 있습니다." />}
      {error && <StateMessage title="오류" body={error} />}
      {!loading && !error && snapshot && (
        mode === "operator"
          ? <OperatorDashboard snapshot={snapshot} setSnapshot={setSnapshot} />
          : <ParticipantDashboard snapshot={snapshot} />
      )}
    </main>
  );
}

function Header({ title, onBack, action }: { title: string; onBack: () => void; action?: React.ReactNode }) {
  return (
    <header className="app-header">
      <button className="icon-button" type="button" onClick={onBack} aria-label="뒤로가기"><ArrowLeft size={20} /></button>
      <h1>{title}</h1>
      <div className="header-action">{action}</div>
    </header>
  );
}

function ParticipantDashboard({ snapshot }: { snapshot: SamSnapshot }) {
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const selectedTeam = snapshot.teams.find((team) => team.id === selectedTeamId) ?? null;
  const recommendation = selectedTeam ? getRecommendedNextTheme(selectedTeam, snapshot) : null;

  return (
    <div className="stack">
      <GanttProgressChart snapshot={snapshot} />

      <section className="panel">
        <label className="select-label" htmlFor="team-select">내 팀 선택</label>
        <select id="team-select" value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)}>
          <option value="">팀을 선택하세요</option>
          {snapshot.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
      </section>

      {selectedTeam && recommendation && <NextThemeCard recommendation={recommendation} />}
      {selectedTeam && <TeamProgressChart snapshot={snapshot} team={selectedTeam} />}
      {selectedTeam && <TeamThemeRecords snapshot={snapshot} team={selectedTeam} />}
      <CurrentStatusBoard snapshot={snapshot} />
    </div>
  );
}

function OperatorDashboard({ snapshot, setSnapshot }: { snapshot: SamSnapshot; setSnapshot: (snapshot: SamSnapshot) => void }) {
  const recommendations = useMemo(() => getAllRecommendations(snapshot), [snapshot]);

  const patchRun = async (run: ThemeRun) => {
    const updated = await updateThemeRun(run);
    setSnapshot({
      ...snapshot,
      themeRuns: snapshot.themeRuns.map((item) => item.id === updated.id ? updated : item),
      teams: snapshot.teams.map((team) => {
        if (team.id !== updated.teamId) return team;
        return { ...team, currentStatus: updated.status === "playing" ? "playing" : "waiting" };
      }),
    });
  };

  const enterTeam = async (team: Team) => {
    const recommendation = getRecommendedNextTheme(team, snapshot);
    if (!recommendation.theme) return;
    const existing = snapshot.themeRuns.find((run) => run.teamId === team.id && run.themeId === recommendation.theme?.id && run.status === "planned");
    const run: ThemeRun = existing ?? {
      id: `local-${Date.now()}`,
      eventId: snapshot.event.id,
      teamId: team.id,
      themeId: recommendation.theme.id,
      status: "playing",
      enteredAt: new Date().toISOString(),
    };

    const updated = { ...run, status: "playing" as ThemeRunStatus, enteredAt: new Date().toISOString(), exitedAt: undefined };
    await updateThemeRun(updated);
    setSnapshot({
      ...snapshot,
      themeRuns: existing
        ? snapshot.themeRuns.map((item) => item.id === existing.id ? updated : item)
        : [...snapshot.themeRuns, updated],
      teams: snapshot.teams.map((item) => item.id === team.id ? { ...item, currentStatus: "playing" } : item),
    });
  };

  const exitTeam = async (run: ThemeRun) => {
    await patchRun({ ...run, status: "completed", exitedAt: new Date().toISOString() });
  };

  return (
    <div className="stack">
      <section className="metric-grid">
        <Metric icon={<UsersRound size={18} />} label="등록 팀" value={`${snapshot.teams.length}팀`} />
        <Metric icon={<DoorOpen size={18} />} label="진행 중" value={`${snapshot.themeRuns.filter((run) => run.status === "playing").length}팀`} />
        <Metric icon={<MapPinned size={18} />} label="활성 테마" value={`${snapshot.themes.length}개`} />
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>다음 입장 추천</h2>
          <span>자동 최적화 초안</span>
        </div>
        <div className="recommendation-list">
          {recommendations.map((item) => {
            const currentRun = getTeamCurrentRun(item.team, snapshot);
            return (
              <article className="recommendation-row" key={item.team.id}>
                <div>
                  <strong style={{ color: item.team.color }}>{item.team.name}</strong>
                  <p>{item.theme ? `${item.store?.name} · ${item.theme.name}` : item.reason}</p>
                  <small>{item.reason} · {formatTime(item.availableAt)}</small>
                </div>
                {currentRun ? (
                  <button className="success-button" type="button" onClick={() => exitTeam(currentRun)}>
                    <CheckCircle2 size={17} /> 퇴장
                  </button>
                ) : (
                  <button className="primary-button compact" type="button" onClick={() => enterTeam(item.team)} disabled={!item.theme}>
                    <DoorOpen size={17} /> 입장
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <CurrentStatusBoard snapshot={snapshot} operator />
    </div>
  );
}

function NextThemeCard({ recommendation }: { recommendation: ReturnType<typeof getRecommendedNextTheme> }) {
  return (
    <section className="next-card">
      <p className="eyebrow">다음 입장</p>
      <h2>{recommendation.theme?.name ?? "대기 중"}</h2>
      <p>{recommendation.store?.name ?? recommendation.reason}</p>
      <div className="next-card__meta">
        <span><Clock size={16} /> {formatTime(recommendation.availableAt)}</span>
        <span>{recommendation.reason}</span>
      </div>
    </section>
  );
}

function CurrentStatusBoard({ snapshot, operator = false }: { snapshot: SamSnapshot; operator?: boolean }) {
  return (
    <section className="panel">
      <div className="section-title">
        <h2>현재 테마 현황</h2>
        <span>{operator ? "운영자 확인" : "전체 공개"}</span>
      </div>
      <div className="theme-list">
        {snapshot.themes.map((theme) => {
          const store = snapshot.stores.find((item) => item.id === theme.storeId);
          const run = snapshot.themeRuns.find((item) => item.themeId === theme.id && item.status === "playing");
          const team = snapshot.teams.find((item) => item.id === run?.teamId);
          const availableAt = getThemeAvailability(theme, snapshot);
          return (
            <article className="theme-row" key={theme.id}>
              <div className={`status-dot ${run ? "busy" : "free"}`} />
              <div>
                <strong>{theme.name}</strong>
                <p>{store?.name} · 난이도 {theme.difficulty}</p>
              </div>
              <div className="theme-row__right">
                <span>{team ? team.name : "비어 있음"}</span>
                <small>{run ? `${formatTime(availableAt)} 예상` : "즉시 가능"}</small>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TeamThemeRecords({ snapshot, team }: { snapshot: SamSnapshot; team: Team }) {
  return (
    <section className="panel">
      <div className="section-title">
        <h2>내 팀 테마 기록</h2>
        <span>{team.name}</span>
      </div>
      <div className="record-list">
        {snapshot.stores.map((store) => {
          const themes = snapshot.themes.filter((theme) => theme.storeId === store.id);
          return (
            <div className="record-store" key={store.id}>
              <h3>{store.name}</h3>
              {themes.map((theme) => {
                const run = snapshot.themeRuns.find((item) => item.teamId === team.id && item.themeId === theme.id);
                const statusLabel = getRunStatusLabel(run?.status);
                return (
                  <article className="record-row" key={theme.id}>
                    <div className={`record-badge ${run?.status ?? "empty"}`}>
                      <Flag size={14} />
                    </div>
                    <div>
                      <strong>{theme.name}</strong>
                      <p>{statusLabel}</p>
                    </div>
                    <div className="record-row__right">
                      <span>{run?.enteredAt ? formatTime(new Date(run.enteredAt)) : "-"}</span>
                      <small>{formatRunDuration(run)}</small>
                    </div>
                  </article>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GanttProgressChart({ snapshot }: { snapshot: SamSnapshot }) {
  const window = getTimelineWindow(snapshot);
  const ticks = getTimelineTicks(window.start, window.end);

  return (
    <section className="panel gantt-panel">
      <div className="section-title">
        <h2>전체 진행도</h2>
        <span>매장 · 테마별</span>
      </div>

      <div className="gantt-scroll">
        <div className="gantt-grid">
          <div className="gantt-corner">테마</div>
          <div className="gantt-axis">
            {ticks.map((tick) => (
              <span key={tick.toISOString()}>{formatTime(tick)}</span>
            ))}
          </div>

          {snapshot.stores.map((store, storeIndex) => {
            const themes = snapshot.themes.filter((theme) => theme.storeId === store.id);
            return (
              <div className="gantt-group" key={store.id}>
                <div className="gantt-store-label">{store.name}</div>
                <div className={`gantt-store-track tone-${storeIndex % 3}`}>
                  <span>{store.name}</span>
                </div>

                {themes.map((theme) => {
                  const runs = snapshot.themeRuns
                    .filter((run) => run.themeId === theme.id)
                    .sort((a, b) => getRunTime(a) - getRunTime(b));
                  return (
                    <div className="gantt-row" key={theme.id}>
                      <div className="gantt-label">
                        <strong>{theme.name}</strong>
                        <small>{theme.playTimeMinutes}분</small>
                      </div>
                      <div className="gantt-track">
                        {runs.map((run) => {
                          const team = snapshot.teams.find((item) => item.id === run.teamId);
                          const range = getRunRange(run, theme.playTimeMinutes + theme.cleanupTimeMinutes);
                          return (
                            <div
                              className={`gantt-bar ${run.status}`}
                              key={run.id}
                              style={getBarStyle(range.start, range.end, window.start, window.end, team?.color)}
                              title={`${team?.name ?? "팀"} · ${theme.name}`}
                            >
                              <span>{team?.name ?? "팀"}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TeamProgressChart({ snapshot, team }: { snapshot: SamSnapshot; team: Team }) {
  const window = getTimelineWindow(snapshot);
  const ticks = getTimelineTicks(window.start, window.end);

  return (
    <section className="panel gantt-panel">
      <div className="section-title">
        <h2>내 팀 진행도</h2>
        <span>{team.name}</span>
      </div>
      <div className="gantt-scroll">
        <div className="gantt-grid gantt-grid--team">
          <div className="gantt-corner">테마</div>
          <div className="gantt-axis">
            {ticks.map((tick) => (
              <span key={tick.toISOString()}>{formatTime(tick)}</span>
            ))}
          </div>
          {snapshot.themes.map((theme) => {
            const run = snapshot.themeRuns.find((item) => item.teamId === team.id && item.themeId === theme.id);
            return (
              <div className="gantt-row" key={theme.id}>
                <div className="gantt-label">
                  <strong>{theme.name}</strong>
                  <small>{snapshot.stores.find((store) => store.id === theme.storeId)?.name}</small>
                </div>
                <div className="gantt-track">
                  {run ? (
                    <div
                      className={`gantt-bar ${run.status}`}
                      style={getBarStyle(
                        getRunRange(run, theme.playTimeMinutes + theme.cleanupTimeMinutes).start,
                        getRunRange(run, theme.playTimeMinutes + theme.cleanupTimeMinutes).end,
                        window.start,
                        window.end,
                        team.color,
                      )}
                    >
                      <span>{getRunStatusLabel(run.status)}</span>
                    </div>
                  ) : (
                    <span className="gantt-empty">미진행</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="metric">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  );
}

function StateMessage({ title, body }: { title: string; body: string }) {
  return (
    <section className="state">
      <Activity size={24} />
      <h2>{title}</h2>
      <p>{body}</p>
    </section>
  );
}

function getRunTime(run: ThemeRun) {
  return new Date(run.enteredAt ?? run.exitedAt ?? 0).getTime();
}

function getRunRange(run: ThemeRun, fallbackMinutes: number) {
  const start = new Date(run.enteredAt ?? run.exitedAt ?? Date.now());
  const end = run.exitedAt
    ? new Date(run.exitedAt)
    : new Date(start.getTime() + fallbackMinutes * 60_000);

  return { start, end };
}

function getTimelineWindow(snapshot: SamSnapshot) {
  const ranges = snapshot.themeRuns.map((run) => {
    const theme = snapshot.themes.find((item) => item.id === run.themeId);
    return getRunRange(run, (theme?.playTimeMinutes ?? 60) + (theme?.cleanupTimeMinutes ?? 15));
  });
  const now = new Date();
  const starts = ranges.map((range) => range.start.getTime());
  const ends = ranges.map((range) => range.end.getTime());
  const start = new Date(Math.min(...starts, now.getTime()) - 15 * 60_000);
  const end = new Date(Math.max(...ends, now.getTime() + 90 * 60_000) + 15 * 60_000);

  return { start, end };
}

function getTimelineTicks(start: Date, end: Date) {
  const ticks: Date[] = [];
  const tickMinutes = 30;
  const first = new Date(start);
  first.setMinutes(Math.floor(first.getMinutes() / tickMinutes) * tickMinutes, 0, 0);

  for (let time = first.getTime(); time <= end.getTime(); time += tickMinutes * 60_000) {
    ticks.push(new Date(time));
  }

  return ticks;
}

function getBarStyle(runStart: Date, runEnd: Date, windowStart: Date, windowEnd: Date, color?: string) {
  const total = windowEnd.getTime() - windowStart.getTime();
  const left = ((runStart.getTime() - windowStart.getTime()) / total) * 100;
  const width = Math.max(7, ((runEnd.getTime() - runStart.getTime()) / total) * 100);

  return {
    left: `${Math.max(0, left)}%`,
    width: `${Math.min(100 - Math.max(0, left), width)}%`,
    backgroundColor: color,
  };
}

function getRunStatusLabel(status?: ThemeRunStatus) {
  if (status === "playing") return "진행 중";
  if (status === "completed") return "완료";
  if (status === "planned") return "입장 예정";
  if (status === "skipped") return "건너뜀";
  return "미진행";
}

function formatRunDuration(run?: ThemeRun) {
  if (!run?.enteredAt) return "기록 없음";
  if (!run.exitedAt) return getRunStatusLabel(run.status);
  const minutes = Math.max(0, Math.round((new Date(run.exitedAt).getTime() - new Date(run.enteredAt).getTime()) / 60_000));
  return `${minutes}분`;
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
