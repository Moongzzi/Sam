import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, ChevronRight, Clock, DoorOpen, Flag, MapPinned, Maximize2, Minimize2, Plus, RefreshCw, Save, Settings, ShieldCheck, Undo2, UsersRound, X } from "lucide-react";
import {
  deleteStore,
  deleteTeam,
  deleteTheme,
  getSamSnapshot,
  persistLocalSnapshot,
  replaceTeamRoutePlan,
  saveStore,
  saveTeam,
  saveTheme,
  updateRoutePlan,
  updateThemeRun,
} from "../entities/samApi";
import type { PredictedThemeRun, SamSnapshot, ScheduleConflict, Store, Team, TeamRoutePlan, Theme, ThemeRun, ThemeRunStatus } from "../entities/types";
import { getAllRecommendations, getPredictedSchedule, getRecommendedNextTheme, getScheduleConflicts, getTeamCurrentRun, getThemeAvailability } from "../features/recommendations";

type View = "home" | "operator-code" | "operator" | "participant";
type ParticipantTab = "progress" | "team" | "records" | "status";
type OperatorTab = "summary" | "schedule" | "control" | "status" | "settings";
type TimelineAxis = "theme" | "team";

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
    <main className="home-shell">
      <header className="brand-header">
        <a className="brand" href="#" aria-label="샘 홈">
          <span className="brand__mark">S</span>
          <span><strong>샘</strong><small>SAM ROTATION</small></span>
        </a>
        <span className="brand-header__date"><CalendarDays size={15} /> 2026. 07. 24</span>
      </header>

      <div className="home">
        <section className="home__hero">
          <div className="home__hero-icon"><Activity size={26} /></div>
          <div>
            <p className="eyebrow">LIVE OPERATION</p>
            <h1>샘 로테이션</h1>
            <p className="home__copy">3개 매장, 9개 테마의 실시간 진행 현황</p>
          </div>
          <span className="live-badge"><i /> 운영 중</span>
        </section>

        <section className="menu-section" aria-labelledby="menu-title">
          <div className="section-title menu-section__title">
            <h2 id="menu-title">서비스 바로가기</h2>
            <span>역할을 선택해 주세요</span>
          </div>
          <div className="menu-grid">
            <button className="menu-card menu-card--operator" type="button" onClick={onOperator}>
              <span className="menu-card__icon"><ShieldCheck size={22} /></span>
              <span className="menu-card__content">
                <strong>운영자 메뉴</strong>
                <small>팀 배정과 입장·퇴장 기록을 관리합니다</small>
              </span>
              <ChevronRight className="menu-card__chevron" size={20} />
            </button>
            <button className="menu-card" type="button" onClick={onParticipant}>
              <span className="menu-card__icon"><UsersRound size={22} /></span>
              <span className="menu-card__content">
                <strong>참가자 메뉴</strong>
                <small>우리 팀의 다음 테마와 현황을 확인합니다</small>
              </span>
              <ChevronRight className="menu-card__chevron" size={20} />
            </button>
          </div>
        </section>

        <footer className="home-footer">
          <span><i className="status-dot free" /> 시스템 정상 운영 중</span>
          <span>마지막 동기화 방금 전</span>
        </footer>
      </div>
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

  useEffect(() => {
    if (snapshot) persistLocalSnapshot(snapshot);
  }, [snapshot]);

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
      <div className="app-header__title">
        <span className="app-header__mark">S</span>
        <h1>{title}</h1>
      </div>
      <div className="header-action">{action}</div>
    </header>
  );
}

function ParticipantDashboard({ snapshot }: { snapshot: SamSnapshot }) {
  const [activeTab, setActiveTab] = useState<ParticipantTab>("progress");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const selectedTeam = snapshot.teams.find((team) => team.id === selectedTeamId) ?? null;
  const recommendation = selectedTeam ? getRecommendedNextTheme(selectedTeam, snapshot) : null;

  return (
    <>
      <DashboardTabs
        activeTab={activeTab}
        onChange={(tab) => setActiveTab(tab as ParticipantTab)}
        tabs={[
          { id: "progress", label: "전체 진행" },
          { id: "team", label: "내 팀" },
          { id: "records", label: "기록" },
          { id: "status", label: "테마" },
        ]}
      />
      <div className="stack dashboard-content">
        {activeTab === "progress" && <GanttProgressChart snapshot={snapshot} />}
        {(activeTab === "team" || activeTab === "records") && (
          <TeamSelector
            teams={snapshot.teams}
            value={selectedTeamId}
            onChange={setSelectedTeamId}
          />
        )}
        {activeTab === "team" && selectedTeam && recommendation && <NextThemeCard recommendation={recommendation} />}
        {activeTab === "team" && selectedTeam && <TeamProgressChart snapshot={snapshot} team={selectedTeam} />}
        {activeTab === "records" && selectedTeam && <TeamThemeRecords snapshot={snapshot} team={selectedTeam} />}
        {(activeTab === "team" || activeTab === "records") && !selectedTeam && (
          <StateMessage title="팀을 선택해 주세요" body="상단 선택 메뉴에서 참가 팀을 선택할 수 있습니다." />
        )}
        {activeTab === "status" && <CurrentStatusBoard snapshot={snapshot} />}
      </div>
    </>
  );
}

function OperatorDashboard({ snapshot, setSnapshot }: { snapshot: SamSnapshot; setSnapshot: (snapshot: SamSnapshot) => void }) {
  const [activeTab, setActiveTab] = useState<OperatorTab>("summary");
  const recommendations = useMemo(() => getAllRecommendations(snapshot), [snapshot]);
  const predictions = useMemo(() => getPredictedSchedule(snapshot), [snapshot]);
  const conflicts = useMemo(() => getScheduleConflicts(snapshot, predictions), [snapshot, predictions]);

  const patchRun = async (run: ThemeRun) => {
    const updated = await updateThemeRun(run);
    const nextStatus = updated.status === "playing" ? "playing" : "waiting";
    const updatedTeam = snapshot.teams.find((team) => team.id === updated.teamId);
    if (updatedTeam && updatedTeam.currentStatus !== nextStatus) {
      await saveTeam({ ...updatedTeam, currentStatus: nextStatus });
    }
    setSnapshot({
      ...snapshot,
      themeRuns: snapshot.themeRuns.map((item) => item.id === updated.id ? updated : item),
      teams: snapshot.teams.map((team) => {
        if (team.id !== updated.teamId) return team;
        return { ...team, currentStatus: nextStatus };
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
    const savedRun = await updateThemeRun(updated);
    await saveTeam({ ...team, currentStatus: "playing" });
    setSnapshot({
      ...snapshot,
      themeRuns: existing
        ? snapshot.themeRuns.map((item) => item.id === existing.id ? savedRun : item)
        : [...snapshot.themeRuns, savedRun],
      teams: snapshot.teams.map((item) => item.id === team.id ? { ...item, currentStatus: "playing" } : item),
    });
  };

  const exitTeam = async (run: ThemeRun) => {
    await patchRun({ ...run, status: "completed", exitedAt: new Date().toISOString() });
  };

  const assignNextTheme = async (teamId: string, themeId: string, fixedTimes?: { enteredAt: Date; exitedAt: Date }) => {
    const remainingPlans = snapshot.routePlans.filter((plan) => !(plan.teamId === teamId && plan.status !== "completed"));
    const nextOrder = Math.max(0, ...snapshot.routePlans.filter((plan) => plan.teamId === teamId).map((plan) => plan.routeOrder)) + 1;
    const plan: TeamRoutePlan = {
      id: `local-plan-${teamId}-${themeId}-${Date.now()}`,
      eventId: snapshot.event.id,
      teamId,
      themeId,
      routeOrder: nextOrder,
      status: "confirmed",
      plannedEnteredAt: fixedTimes?.enteredAt.toISOString(),
      plannedExitedAt: fixedTimes?.exitedAt.toISOString(),
    };
    const savedPlan = await replaceTeamRoutePlan(plan);
    setSnapshot({ ...snapshot, routePlans: [...remainingPlans, savedPlan] });
  };

  const confirmPrediction = async (prediction: PredictedThemeRun) => {
    await assignNextTheme(prediction.teamId, prediction.themeId, { enteredAt: prediction.enteredAt, exitedAt: prediction.exitedAt });
  };

  const updateRunTimes = async (run: ThemeRun, enteredAt: string, expectedExitedAt: string) => {
    await patchRun({
      ...run,
      enteredAt: new Date(enteredAt).toISOString(),
      expectedExitedAt: new Date(expectedExitedAt).toISOString(),
    });
  };

  const cancelEntry = async (run: ThemeRun) => {
    await patchRun({ ...run, status: "planned", enteredAt: undefined, exitedAt: undefined, expectedExitedAt: undefined });
  };

  const cancelExit = async (run: ThemeRun) => {
    await patchRun({ ...run, status: "playing", exitedAt: undefined });
  };

  const setTeamFinished = async (teamId: string, finished: boolean) => {
    const team = snapshot.teams.find((item) => item.id === teamId);
    if (!team) return;
    const updated = await saveTeam({ ...team, currentStatus: finished ? "finished" : "waiting" });
    setSnapshot({
      ...snapshot,
      teams: snapshot.teams.map((team) => team.id === teamId ? updated : team),
    });
  };

  const updateConfirmedSchedule = async (prediction: PredictedThemeRun, enteredAt: string, exitedAt: string) => {
    const currentPlan = snapshot.routePlans.find((plan) =>
      plan.teamId === prediction.teamId && plan.themeId === prediction.themeId && plan.status === "confirmed",
    );
    if (!currentPlan) return;
    const updatedPlan = await updateRoutePlan({
      ...currentPlan,
      plannedEnteredAt: new Date(enteredAt).toISOString(),
      plannedExitedAt: new Date(exitedAt).toISOString(),
    });
    setSnapshot({
      ...snapshot,
      routePlans: snapshot.routePlans.map((plan) =>
        plan.id === updatedPlan.id
          ? updatedPlan
          : plan,
      ),
    });
  };

  return (
    <>
      <DashboardTabs
        activeTab={activeTab}
        onChange={(tab) => setActiveTab(tab as OperatorTab)}
        tabs={[
          { id: "summary", label: "요약" },
          { id: "schedule", label: "시간표" },
          { id: "control", label: "운영" },
          { id: "status", label: "현황" },
          { id: "settings", label: "설정" },
        ]}
      />
      <div className="stack dashboard-content">
        {activeTab === "summary" && (
          <section className="metric-grid">
            <Metric icon={<UsersRound size={18} />} label="등록 팀" value={`${snapshot.teams.length}팀`} />
            <Metric icon={<DoorOpen size={18} />} label="진행 중" value={`${snapshot.themeRuns.filter((run) => run.status === "playing").length}팀`} />
            <Metric icon={<MapPinned size={18} />} label="활성 테마" value={`${snapshot.themes.length}개`} />
          </section>
        )}

        {activeTab === "schedule" && (
          <PredictedScheduleChart
            snapshot={snapshot}
            predictions={predictions}
            conflicts={conflicts}
            onConfirm={confirmPrediction}
            onUpdateConfirmed={updateConfirmedSchedule}
          />
        )}

        {activeTab === "control" && (
          <OperatorControlPanel
            snapshot={snapshot}
            recommendations={recommendations}
            onEnter={enterTeam}
            onExit={exitTeam}
            onAssign={(teamId, themeId) => void assignNextTheme(teamId, themeId)}
            onUpdateTimes={updateRunTimes}
            onCancelEntry={cancelEntry}
            onCancelExit={cancelExit}
            onSetFinished={setTeamFinished}
          />
        )}

        {activeTab === "status" && <CurrentStatusBoard snapshot={snapshot} operator />}
        {activeTab === "settings" && <OperatorSettings snapshot={snapshot} setSnapshot={setSnapshot} />}
      </div>
    </>
  );
}

function DashboardTabs({ activeTab, onChange, tabs }: {
  activeTab: string;
  onChange: (tab: string) => void;
  tabs: Array<{ id: string; label: string }>;
}) {
  return (
    <nav className="dashboard-tabs" aria-label="화면 메뉴">
      {tabs.map((tab) => (
        <button
          className={activeTab === tab.id ? "active" : ""}
          type="button"
          key={tab.id}
          onClick={() => onChange(tab.id)}
          aria-current={activeTab === tab.id ? "page" : undefined}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function TeamSelector({ teams, value, onChange }: { teams: Team[]; value: string; onChange: (teamId: string) => void }) {
  return (
    <section className="panel team-selector">
      <label className="select-label" htmlFor="team-select">내 팀 선택</label>
      <select id="team-select" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">팀을 선택하세요</option>
        {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
      </select>
    </section>
  );
}

function OperatorControlPanel({ snapshot, recommendations, onEnter, onExit, onAssign, onUpdateTimes, onCancelEntry, onCancelExit, onSetFinished }: {
  snapshot: SamSnapshot;
  recommendations: ReturnType<typeof getAllRecommendations>;
  onEnter: (team: Team) => Promise<void>;
  onExit: (run: ThemeRun) => Promise<void>;
  onAssign: (teamId: string, themeId: string) => void;
  onUpdateTimes: (run: ThemeRun, enteredAt: string, expectedExitedAt: string) => Promise<void>;
  onCancelEntry: (run: ThemeRun) => Promise<void>;
  onCancelExit: (run: ThemeRun) => Promise<void>;
  onSetFinished: (teamId: string, finished: boolean) => void;
}) {
  const now = useLiveNow();
  const completedRuns = snapshot.themeRuns.filter((run) => run.status === "completed" && run.exitedAt);

  return (
    <div className="stack">
      <section className="panel">
        <div className="section-title">
          <h2>팀 운영</h2>
          <span>배정 · 입퇴장 · 시간 보정</span>
        </div>
        <div className="operator-team-list">
          {recommendations.map((recommendation) => {
            const currentRun = getTeamCurrentRun(recommendation.team, snapshot);
            return (
              <OperatorTeamControl
                key={recommendation.team.id}
                snapshot={snapshot}
                recommendation={recommendation}
                currentRun={currentRun}
                now={now}
                onEnter={onEnter}
                onExit={onExit}
                onAssign={onAssign}
                onUpdateTimes={onUpdateTimes}
                onCancelEntry={onCancelEntry}
                onSetFinished={onSetFinished}
              />
            );
          })}
        </div>
      </section>

      {completedRuns.length > 0 && (
        <section className="panel">
          <div className="section-title"><h2>최근 퇴장 기록</h2><span>잘못된 퇴장 취소</span></div>
          <div className="undo-list">
            {completedRuns.slice().sort((a, b) => getRunTime(b) - getRunTime(a)).slice(0, 5).map((run) => {
              const team = snapshot.teams.find((item) => item.id === run.teamId);
              const theme = snapshot.themes.find((item) => item.id === run.themeId);
              return (
                <div className="undo-row" key={run.id}>
                  <div><strong>{team?.name} · {theme?.name}</strong><small>{run.exitedAt ? `${formatTime(new Date(run.exitedAt))} 퇴장` : ""}</small></div>
                  <button className="secondary-button" type="button" onClick={() => onCancelExit(run)}><Undo2 size={15} /> 퇴장 취소</button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function OperatorTeamControl({ snapshot, recommendation, currentRun, now, onEnter, onExit, onAssign, onUpdateTimes, onCancelEntry, onSetFinished }: {
  snapshot: SamSnapshot;
  recommendation: ReturnType<typeof getAllRecommendations>[number];
  currentRun: ThemeRun | null;
  now: Date;
  onEnter: (team: Team) => Promise<void>;
  onExit: (run: ThemeRun) => Promise<void>;
  onAssign: (teamId: string, themeId: string) => void;
  onUpdateTimes: (run: ThemeRun, enteredAt: string, expectedExitedAt: string) => Promise<void>;
  onCancelEntry: (run: ThemeRun) => Promise<void>;
  onSetFinished: (teamId: string, finished: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [themeId, setThemeId] = useState(recommendation.theme?.id ?? "");
  const theme = currentRun ? snapshot.themes.find((item) => item.id === currentRun.themeId) : null;
  const expectedExit = currentRun && theme ? getExpectedExit(currentRun, theme) : null;
  const overdue = Boolean(currentRun && expectedExit && now > expectedExit);
  const assignedThemes = snapshot.themes.filter((item) => recommendation.team.assignedThemeIds.includes(item.id));
  const finished = recommendation.team.currentStatus === "finished";

  useEffect(() => {
    setThemeId(recommendation.theme?.id ?? "");
  }, [recommendation.theme?.id]);

  return (
    <article className={`operator-team-row ${overdue ? "overdue" : ""}`}>
      <button className="operator-team-summary" type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span className="team-color" style={{ background: recommendation.team.color }} />
        <span><strong>{recommendation.team.name}</strong><small>{finished ? "팀 운영 종료" : currentRun ? `${theme?.name} 진행 중` : recommendation.theme?.name ?? "일정 완료"}</small></span>
        {overdue && <span className="overdue-badge"><AlertTriangle size={13} /> 초과</span>}
        <ChevronRight className={expanded ? "expanded" : ""} size={18} />
      </button>
      {expanded && (
        <div className="operator-team-detail">
          {finished ? (
            <div className="finished-team-panel">
              <p>이 팀은 추천과 예상 시간표에서 제외됩니다.</p>
              <button className="secondary-button" type="button" onClick={() => onSetFinished(recommendation.team.id, false)}><Undo2 size={15} /> 팀 운영 복원</button>
            </div>
          ) : currentRun && expectedExit ? (
            <>
              <div className="run-time-status">
                <span>입장 {formatTime(new Date(currentRun.enteredAt!))}</span>
                <span className={overdue ? "danger" : ""}>예상 종료 {formatTime(expectedExit)}</span>
              </div>
              <RunTimeEditor run={currentRun} theme={theme!} onSave={onUpdateTimes} />
              <div className="action-row">
                <button className="success-button" type="button" onClick={() => onExit(currentRun)}><CheckCircle2 size={16} /> 퇴장</button>
                <button className="secondary-button danger" type="button" onClick={() => onCancelEntry(currentRun)}><Undo2 size={15} /> 입장 취소</button>
              </div>
            </>
          ) : (
            <>
              <label className="field-label" htmlFor={`next-theme-${recommendation.team.id}`}>다음 테마 직접 지정</label>
              <div className="inline-control">
                <select id={`next-theme-${recommendation.team.id}`} value={themeId} onChange={(event) => setThemeId(event.target.value)}>
                  <option value="">테마 선택</option>
                  {assignedThemes.map((item) => <option value={item.id} key={item.id}>{snapshot.stores.find((store) => store.id === item.storeId)?.name} · {item.name}</option>)}
                </select>
                <button className="secondary-button" type="button" disabled={!themeId} onClick={() => onAssign(recommendation.team.id, themeId)}><Save size={15} /> 확정</button>
              </div>
              <p className="control-note">{recommendation.reason} · {formatTime(recommendation.availableAt)}</p>
              <button className="primary-button full-button" type="button" onClick={() => onEnter(recommendation.team)} disabled={!recommendation.theme}><DoorOpen size={16} /> 추천 테마 입장</button>
              <button className="secondary-button danger full-button" type="button" onClick={() => onSetFinished(recommendation.team.id, true)}><Flag size={15} /> 팀 운영 종료</button>
            </>
          )}
        </div>
      )}
    </article>
  );
}

function RunTimeEditor({ run, theme, onSave }: { run: ThemeRun; theme: Theme; onSave: (run: ThemeRun, enteredAt: string, expectedExitedAt: string) => Promise<void> }) {
  const initialEnteredAt = run.enteredAt ? toDateTimeLocal(new Date(run.enteredAt)) : toDateTimeLocal(new Date());
  const initialExpectedAt = toDateTimeLocal(getExpectedExit(run, theme));
  const [enteredAt, setEnteredAt] = useState(initialEnteredAt);
  const [expectedExitedAt, setExpectedExitedAt] = useState(initialExpectedAt);

  return (
    <div className="time-editor">
      <label>입장 시각<input type="datetime-local" value={enteredAt} onChange={(event) => setEnteredAt(event.target.value)} /></label>
      <label>예상 종료<input type="datetime-local" value={expectedExitedAt} onChange={(event) => setExpectedExitedAt(event.target.value)} /></label>
      <button className="secondary-button" type="button" onClick={() => onSave(run, enteredAt, expectedExitedAt)}><Clock size={15} /> 시간 저장</button>
    </div>
  );
}

type SettingsView = "stores" | "themes" | "teams";

function OperatorSettings({ snapshot, setSnapshot }: { snapshot: SamSnapshot; setSnapshot: (snapshot: SamSnapshot) => void }) {
  const [view, setView] = useState<SettingsView>("stores");

  const updateStore = async (store: Store) => {
    const saved = await saveStore(store);
    setSnapshot({ ...snapshot, stores: snapshot.stores.map((item) => item.id === store.id ? saved : item) });
  };

  const updateTheme = async (theme: Theme) => {
    const saved = await saveTheme(theme);
    setSnapshot({ ...snapshot, themes: snapshot.themes.map((item) => item.id === theme.id ? saved : item) });
  };

  const updateTeam = async (team: Team) => {
    const saved = await saveTeam(team);
    setSnapshot({ ...snapshot, teams: snapshot.teams.map((item) => item.id === team.id ? saved : item) });
  };

  const addStore = async () => {
    const saved = await saveStore({ id: `local-store-${Date.now()}`, name: "새 매장", address: "", displayOrder: snapshot.stores.length + 1 });
    setSnapshot({ ...snapshot, stores: [...snapshot.stores, saved] });
  };

  const addTheme = async () => {
    const store = snapshot.stores[0];
    if (!store) return;
    const saved = await saveTheme({ id: `local-theme-${Date.now()}`, storeId: store.id, name: "새 테마", playTimeMinutes: 60, cleanupTimeMinutes: 15, difficulty: 3, isActive: true, displayOrder: snapshot.themes.length + 1 });
    setSnapshot({
      ...snapshot,
      themes: [...snapshot.themes, saved],
      teams: snapshot.teams.map((team) => ({ ...team, assignedThemeIds: [...team.assignedThemeIds, saved.id] })),
    });
  };

  const addTeam = async () => {
    const saved = await saveTeam({ id: `local-team-${Date.now()}`, eventId: snapshot.event.id, name: "새 팀", color: "#2563eb", currentStatus: "waiting", assignedThemeIds: snapshot.themes.map((theme) => theme.id) });
    setSnapshot({ ...snapshot, teams: [...snapshot.teams, saved] });
  };

  const removeStore = async (id: string) => {
    await deleteStore(id);
    setSnapshot({ ...snapshot, stores: snapshot.stores.filter((store) => store.id !== id), themes: snapshot.themes.filter((theme) => theme.storeId !== id) });
  };

  const removeTheme = async (id: string) => {
    await deleteTheme(id);
    setSnapshot({
      ...snapshot,
      themes: snapshot.themes.filter((theme) => theme.id !== id),
      teams: snapshot.teams.map((team) => ({ ...team, assignedThemeIds: team.assignedThemeIds.filter((themeId) => themeId !== id) })),
    });
  };

  const removeTeam = async (id: string) => {
    await deleteTeam(id);
    setSnapshot({ ...snapshot, teams: snapshot.teams.filter((team) => team.id !== id), themeRuns: snapshot.themeRuns.filter((run) => run.teamId !== id), routePlans: snapshot.routePlans.filter((plan) => plan.teamId !== id) });
  };

  return (
    <section className="panel settings-panel">
      <div className="section-title"><h2>운영 설정</h2><span>현재 세션에 즉시 반영</span></div>
      <div className="settings-tabs" role="group" aria-label="설정 항목">
        <button className={view === "stores" ? "active" : ""} onClick={() => setView("stores")} type="button">매장</button>
        <button className={view === "themes" ? "active" : ""} onClick={() => setView("themes")} type="button">테마</button>
        <button className={view === "teams" ? "active" : ""} onClick={() => setView("teams")} type="button">팀</button>
      </div>

      {view === "stores" && <SettingsStores snapshot={snapshot} onUpdate={updateStore} onAdd={addStore} onDelete={removeStore} />}
      {view === "themes" && <SettingsThemes snapshot={snapshot} onUpdate={updateTheme} onAdd={addTheme} onDelete={removeTheme} />}
      {view === "teams" && <SettingsTeams snapshot={snapshot} onUpdate={updateTeam} onAdd={addTeam} onDelete={removeTeam} />}
    </section>
  );
}

function SettingsStores({ snapshot, onUpdate, onAdd, onDelete }: { snapshot: SamSnapshot; onUpdate: (store: Store) => void; onAdd: () => void; onDelete: (id: string) => void }) {
  return <div className="settings-list">{snapshot.stores.map((store) => <div className="settings-row" key={store.id}><div className="settings-fields"><label>매장명<input value={store.name} onChange={(event) => onUpdate({ ...store, name: event.target.value })} /></label><label>지역<input value={store.address ?? ""} onChange={(event) => onUpdate({ ...store, address: event.target.value })} /></label></div><button className="icon-button danger" type="button" onClick={() => onDelete(store.id)} aria-label={`${store.name} 삭제`}><X size={16} /></button></div>)}<button className="add-button" type="button" onClick={onAdd}><Plus size={16} /> 매장 추가</button></div>;
}

function SettingsThemes({ snapshot, onUpdate, onAdd, onDelete }: { snapshot: SamSnapshot; onUpdate: (theme: Theme) => void; onAdd: () => void; onDelete: (id: string) => void }) {
  return <div className="settings-list">{snapshot.themes.map((theme) => <div className="settings-row settings-row--theme" key={theme.id}><div className="settings-fields"><label>테마명<input value={theme.name} onChange={(event) => onUpdate({ ...theme, name: event.target.value })} /></label><label>매장<select value={theme.storeId} onChange={(event) => onUpdate({ ...theme, storeId: event.target.value })}>{snapshot.stores.map((store) => <option value={store.id} key={store.id}>{store.name}</option>)}</select></label><label>진행(분)<input type="number" min="1" value={theme.playTimeMinutes} onChange={(event) => onUpdate({ ...theme, playTimeMinutes: Number(event.target.value) })} /></label><label>정리(분)<input type="number" min="0" value={theme.cleanupTimeMinutes} onChange={(event) => onUpdate({ ...theme, cleanupTimeMinutes: Number(event.target.value) })} /></label></div><button className="icon-button danger" type="button" onClick={() => onDelete(theme.id)} aria-label={`${theme.name} 삭제`}><X size={16} /></button></div>)}<button className="add-button" type="button" onClick={onAdd}><Plus size={16} /> 테마 추가</button></div>;
}

function SettingsTeams({ snapshot, onUpdate, onAdd, onDelete }: { snapshot: SamSnapshot; onUpdate: (team: Team) => void; onAdd: () => void; onDelete: (id: string) => void }) {
  return <div className="settings-list">{snapshot.teams.map((team) => <details className="team-settings" key={team.id}><summary><span className="team-color" style={{ background: team.color }} /><strong>{team.name}</strong><small>{team.assignedThemeIds.length}개 테마</small><ChevronRight size={17} /></summary><div className="team-settings__body"><div className="settings-fields"><label>팀 이름<input value={team.name} onChange={(event) => onUpdate({ ...team, name: event.target.value })} /></label><label>팀 색상<input type="color" value={team.color} onChange={(event) => onUpdate({ ...team, color: event.target.value })} /></label></div><fieldset><legend>참여 테마</legend>{snapshot.stores.map((store) => <div className="theme-check-group" key={store.id}><strong>{store.name}</strong>{snapshot.themes.filter((theme) => theme.storeId === store.id).map((theme) => { const checked = team.assignedThemeIds.includes(theme.id); return <label key={theme.id}><input type="checkbox" checked={checked} onChange={(event) => onUpdate({ ...team, assignedThemeIds: event.target.checked ? [...new Set([...team.assignedThemeIds, theme.id])] : team.assignedThemeIds.filter((id) => id !== theme.id) })} />{theme.name}</label>; })}</div>)}</fieldset><button className="secondary-button danger" type="button" onClick={() => onDelete(team.id)}><X size={15} /> 팀 삭제</button></div></details>)}<button className="add-button" type="button" onClick={onAdd}><Plus size={16} /> 팀 추가</button></div>;
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
  const [axis, setAxis] = useState<TimelineAxis>("theme");
  const now = useLiveNow();
  const window = getTimelineWindow(snapshot, now);
  const ticks = getTimelineTicks(window.start, window.end);
  const nowLeft = getNowPosition(now, window.start, window.end);
  const scrollRef = useTimelineNowScroll(nowLeft, axis);

  return (
    <section className="panel gantt-panel">
      <div className="section-title">
        <h2>전체 진행도</h2>
        <span>{axis === "theme" ? "매장 · 테마 기준" : "팀 · 방문 테마 기준"}</span>
      </div>

      <TimelineAxisToggle value={axis} onChange={setAxis} />

      <div className="gantt-scroll" ref={scrollRef}>
        <div
          className={`gantt-grid gantt-grid--live ${axis === "team" ? "gantt-grid--team-axis" : ""}`}
          style={{ "--now-left": `${nowLeft}%` } as React.CSSProperties}
        >
          <div className="gantt-corner">{axis === "theme" ? "테마" : "팀"}</div>
          <div className="gantt-axis" style={{ "--tick-count": ticks.length } as React.CSSProperties}>
            {ticks.map((tick) => (
              <span key={tick.toISOString()}>{formatTime(tick)}</span>
            ))}
          </div>

          {axis === "theme" && snapshot.stores.map((store, storeIndex) => {
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
                              style={getLiveBarStyle(run, range.start, range.end, window.start, window.end, now, team?.color)}
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
          {axis === "team" && snapshot.teams.map((team) => {
            const runs = snapshot.themeRuns
              .filter((run) => run.teamId === team.id && run.enteredAt && run.status !== "skipped")
              .sort((first, second) => getRunTime(first) - getRunTime(second));
            return (
              <div className="gantt-row" key={team.id}>
                <div className="gantt-label gantt-team-label">
                  <strong style={{ color: team.color }}>{team.name}</strong>
                  <small>{runs.length}개 테마</small>
                </div>
                <div className="gantt-track">
                  {runs.map((run) => {
                    const theme = snapshot.themes.find((item) => item.id === run.themeId);
                    if (!theme) return null;
                    const range = getRunRange(run, theme.playTimeMinutes + theme.cleanupTimeMinutes);
                    return (
                      <div
                        className={`gantt-bar ${run.status}`}
                        key={run.id}
                        style={getLiveBarStyle(run, range.start, range.end, window.start, window.end, now, team.color)}
                        title={`${team.name} · ${theme.name}`}
                      >
                        <span>{theme.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TimelineAxisToggle({ value, onChange }: { value: TimelineAxis; onChange: (axis: TimelineAxis) => void }) {
  return (
    <div className="timeline-axis-toggle" role="group" aria-label="시간표 보기 기준">
      <button className={value === "theme" ? "active" : ""} type="button" onClick={() => onChange("theme")}>테마별</button>
      <button className={value === "team" ? "active" : ""} type="button" onClick={() => onChange("team")}>팀별</button>
    </div>
  );
}

type ScheduleSelection = {
  id: string;
  teamName: string;
  themeName: string;
  enteredAt: Date;
  exitedAt: Date;
  kind: "actual" | "predicted" | "confirmed";
};

function PredictedScheduleChart({ snapshot, predictions, conflicts, onConfirm, onUpdateConfirmed }: {
  snapshot: SamSnapshot;
  predictions: PredictedThemeRun[];
  conflicts: ScheduleConflict[];
  onConfirm: (prediction: PredictedThemeRun) => void;
  onUpdateConfirmed: (prediction: PredictedThemeRun, enteredAt: string, exitedAt: string) => void;
}) {
  const [selection, setSelection] = useState<ScheduleSelection | null>(null);
  const [axis, setAxis] = useState<TimelineAxis>("theme");
  const [fullscreen, setFullscreen] = useState(false);
  const [forceLandscape, setForceLandscape] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const now = useLiveNow();
  const window = getPredictedTimelineWindow(snapshot, predictions, now);
  const ticks = getTimelineTicks(window.start, window.end);
  const timelineWidth = Math.max(700, ticks.length * 72);
  const nowLeft = getNowPosition(now, window.start, window.end);
  const scrollRef = useTimelineNowScroll(nowLeft, axis);
  const selectedPrediction = selection ? predictions.find((item) => item.id === selection.id) ?? null : null;
  const selectedConflicts = selection ? conflicts.filter((conflict) => conflict.predictionId === selection.id) : [];

  useEffect(() => {
    const updateLandscapeFallback = () => setForceLandscape(Boolean(document.fullscreenElement) && globalThis.innerWidth < globalThis.innerHeight);
    const onFullscreenChange = () => {
      setFullscreen(Boolean(document.fullscreenElement));
      updateLandscapeFallback();
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    globalThis.addEventListener("resize", updateLandscapeFallback);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      globalThis.removeEventListener("resize", updateLandscapeFallback);
    };
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen();
    try {
      await (screen.orientation as ScreenOrientation & { lock?: (orientation: string) => Promise<void> }).lock?.("landscape");
    } catch {
      // Fullscreen still works when a browser does not permit orientation locking.
    }
  };

  const selectRun = (run: ThemeRun, themeName: string) => {
    const team = snapshot.teams.find((item) => item.id === run.teamId);
    const theme = snapshot.themes.find((item) => item.id === run.themeId);
    if (!run.enteredAt || !team || !theme) return;
    const enteredAt = new Date(run.enteredAt);
    setSelection({
      id: run.id,
      teamName: team.name,
      themeName,
      enteredAt,
      exitedAt: run.exitedAt ? new Date(run.exitedAt) : new Date(enteredAt.getTime() + theme.playTimeMinutes * 60_000),
      kind: "actual",
    });
  };

  const selectPrediction = (prediction: PredictedThemeRun, themeName: string) => {
    const team = snapshot.teams.find((item) => item.id === prediction.teamId);
    if (!team) return;
    setSelection({
      id: prediction.id,
      teamName: team.name,
      themeName,
      enteredAt: prediction.enteredAt,
      exitedAt: prediction.exitedAt,
      kind: prediction.isConfirmed ? "confirmed" : "predicted",
    });
  };

  return (
    <section className={`panel gantt-panel forecast-panel ${fullscreen ? "forecast-panel--fullscreen" : ""} ${forceLandscape ? "forecast-panel--rotated" : ""}`} ref={panelRef}>
      <div className="section-title">
        <h2>예상 시간표</h2>
        <div className="forecast-actions">
          {conflicts.length > 0 && <span className="conflict-count"><AlertTriangle size={13} /> 충돌 {new Set(conflicts.map((item) => item.predictionId)).size}</span>}
          <button className="icon-button" type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "전체화면 종료" : "가로 전체화면"} title={fullscreen ? "전체화면 종료" : "가로 전체화면"}>
            {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </div>
      <p className="forecast-subtitle">{axis === "theme" ? "테마 기준 자동 계산" : "팀 기준 자동 계산"}</p>
      <TimelineAxisToggle value={axis} onChange={setAxis} />
      <div className="schedule-legend" aria-label="시간표 범례">
        <span><i className="legend-swatch actual" /> 실제 진행</span>
        <span><i className="legend-swatch predicted" /> 예상 일정</span>
        <span><i className="legend-swatch confirmed" /> 확정 일정</span>
        <span><i className="legend-line" /> 현재 시각</span>
      </div>
      {selection && (
        <div className="schedule-detail" aria-live="polite">
          <span className={`schedule-detail__type ${selection.kind}`}>
            {selection.kind === "actual" ? "실제" : selection.kind === "confirmed" ? "확정" : "예상"}
          </span>
          <strong>{selection.teamName} · {selection.themeName}</strong>
          <span>{formatTime(selection.enteredAt)} 입장</span>
          <span>{formatTime(selection.exitedAt)} 종료</span>
          {selection.kind === "predicted" && (
            <button
              className="confirm-schedule-button"
              type="button"
              onClick={() => {
                const prediction = predictions.find((item) => item.id === selection.id);
                if (prediction) onConfirm(prediction);
              }}
            >
              <CheckCircle2 size={14} /> 일정 확정
            </button>
          )}
        </div>
      )}
      {selectedPrediction?.isConfirmed && selectedConflicts.length > 0 && (
        <ConflictEditor
          prediction={selectedPrediction}
          conflicts={selectedConflicts}
          onSave={(enteredAt, exitedAt) => onUpdateConfirmed(selectedPrediction, enteredAt, exitedAt)}
        />
      )}
      <p className="schedule-hint">막대를 누르면 입장·종료 시각을 확인할 수 있습니다.</p>

      <div className="gantt-scroll" ref={scrollRef}>
        <div
          className={`gantt-grid gantt-grid--forecast ${axis === "team" ? "gantt-grid--team-axis" : ""}`}
          style={{
            "--timeline-width": `${timelineWidth}px`,
            "--now-left": `${Math.max(0, Math.min(100, nowLeft))}%`,
          } as React.CSSProperties}
        >
          <div className="gantt-corner">{axis === "theme" ? "테마" : "팀"}</div>
          <div className="gantt-axis" style={{ "--tick-count": ticks.length } as React.CSSProperties}>
            {ticks.map((tick) => <span key={tick.toISOString()}>{formatTime(tick)}</span>)}
          </div>

          {axis === "theme" && snapshot.stores.map((store, storeIndex) => (
            <div className="gantt-group" key={store.id}>
              <div className="gantt-store-label">{store.name}</div>
              <div className={`gantt-store-track tone-${storeIndex % 3}`}><span>{store.name}</span></div>
              {snapshot.themes.filter((theme) => theme.storeId === store.id).map((theme) => {
                const actualRuns = snapshot.themeRuns.filter((run) =>
                  run.themeId === theme.id && ["playing", "completed"].includes(run.status) && run.enteredAt,
                );
                const predictedRuns = predictions.filter((run) => run.themeId === theme.id);
                return (
                  <div className="gantt-row" key={theme.id}>
                    <div className="gantt-label">
                      <strong>{theme.name}</strong>
                      <small>{theme.playTimeMinutes}분 · 정리 {theme.cleanupTimeMinutes}분</small>
                    </div>
                    <div className="gantt-track forecast-track">
                      {actualRuns.map((run) => {
                        const team = snapshot.teams.find((item) => item.id === run.teamId);
                        const range = getRunRange(run, theme.playTimeMinutes);
                        return (
                          <button
                            className={`gantt-bar gantt-bar--actual ${run.status} ${selection?.id === run.id ? "selected" : ""}`}
                            type="button"
                            key={run.id}
                            style={getLiveForecastBarStyle(run, range.start, range.end, window.start, window.end, now, team?.color)}
                            onClick={() => selectRun(run, theme.name)}
                            aria-label={`${team?.name ?? "팀"} ${theme.name} 실제 진행`}
                          >
                            <span>{team?.name ?? "팀"}</span>
                          </button>
                        );
                      })}
                      {predictedRuns.map((run) => {
                        const team = snapshot.teams.find((item) => item.id === run.teamId);
                        return (
                          <button
                            className={`gantt-bar gantt-bar--predicted ${run.isConfirmed ? "confirmed" : ""} ${conflicts.some((item) => item.predictionId === run.id) ? "conflict" : ""} ${selection?.id === run.id ? "selected" : ""}`}
                            type="button"
                            key={run.id}
                            style={getForecastBarStyle(run.enteredAt, run.exitedAt, window.start, window.end, team?.color)}
                            onClick={() => selectPrediction(run, theme.name)}
                            aria-label={`${team?.name ?? "팀"} ${theme.name} 예상 ${formatTime(run.enteredAt)} 입장 ${formatTime(run.exitedAt)} 종료`}
                          >
                            <span>{team?.name ?? "팀"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {axis === "team" && snapshot.teams.map((team) => {
            const actualRuns = snapshot.themeRuns.filter((run) =>
              run.teamId === team.id && ["playing", "completed"].includes(run.status) && run.enteredAt,
            );
            const predictedRuns = predictions.filter((run) => run.teamId === team.id);
            return (
              <div className="gantt-row" key={team.id}>
                <div className="gantt-label gantt-team-label">
                  <strong style={{ color: team.color }}>{team.name}</strong>
                  <small>실제 {actualRuns.length} · 예상 {predictedRuns.length}</small>
                </div>
                <div className="gantt-track forecast-track">
                  {actualRuns.map((run) => {
                    const theme = snapshot.themes.find((item) => item.id === run.themeId);
                    if (!theme) return null;
                    const range = getRunRange(run, theme.playTimeMinutes);
                    return (
                      <button
                        className={`gantt-bar gantt-bar--actual ${run.status} ${selection?.id === run.id ? "selected" : ""}`}
                        type="button"
                        key={run.id}
                        style={getLiveForecastBarStyle(run, range.start, range.end, window.start, window.end, now, team.color)}
                        onClick={() => selectRun(run, theme.name)}
                        aria-label={`${team.name} ${theme.name} 실제 진행`}
                      >
                        <span>{theme.name}</span>
                      </button>
                    );
                  })}
                  {predictedRuns.map((run) => {
                    const theme = snapshot.themes.find((item) => item.id === run.themeId);
                    if (!theme) return null;
                    return (
                      <button
                        className={`gantt-bar gantt-bar--predicted ${run.isConfirmed ? "confirmed" : ""} ${conflicts.some((item) => item.predictionId === run.id) ? "conflict" : ""} ${selection?.id === run.id ? "selected" : ""}`}
                        type="button"
                        key={run.id}
                        style={getForecastBarStyle(run.enteredAt, run.exitedAt, window.start, window.end, team.color)}
                        onClick={() => selectPrediction(run, theme.name)}
                        aria-label={`${team.name} ${theme.name} 예상 ${formatTime(run.enteredAt)} 입장 ${formatTime(run.exitedAt)} 종료`}
                      >
                        <span>{theme.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ConflictEditor({ prediction, conflicts, onSave }: { prediction: PredictedThemeRun; conflicts: ScheduleConflict[]; onSave: (enteredAt: string, exitedAt: string) => void }) {
  const [enteredAt, setEnteredAt] = useState(toDateTimeLocal(prediction.enteredAt));
  const [exitedAt, setExitedAt] = useState(toDateTimeLocal(prediction.exitedAt));

  useEffect(() => {
    setEnteredAt(toDateTimeLocal(prediction.enteredAt));
    setExitedAt(toDateTimeLocal(prediction.exitedAt));
  }, [prediction.id, prediction.enteredAt, prediction.exitedAt]);

  return (
    <div className="conflict-editor" role="alert">
      <div className="conflict-editor__head"><AlertTriangle size={17} /><strong>확정 일정 충돌</strong></div>
      {conflicts.map((conflict, index) => <p key={`${conflict.conflictingLabel}-${index}`}>{conflict.reason} <span>{conflict.conflictingLabel}</span></p>)}
      <div className="conflict-time-fields">
        <label>입장 시각<input type="datetime-local" value={enteredAt} onChange={(event) => setEnteredAt(event.target.value)} /></label>
        <label>종료 시각<input type="datetime-local" value={exitedAt} onChange={(event) => setExitedAt(event.target.value)} /></label>
      </div>
      <button className="conflict-save-button" type="button" disabled={!enteredAt || !exitedAt || new Date(exitedAt) <= new Date(enteredAt)} onClick={() => onSave(enteredAt, exitedAt)}><Save size={15} /> 관리자 확인 후 시간 수정</button>
    </div>
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
          <div className="gantt-axis" style={{ "--tick-count": ticks.length } as React.CSSProperties}>
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

function useLiveNow(intervalMs = 1_000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}

function useTimelineNowScroll(nowLeft: number, axis: TimelineAxis) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const timeline = scroll?.querySelector<HTMLElement>(".gantt-axis");
    if (!scroll || !timeline) return;
    const markerPosition = timeline.offsetLeft + timeline.clientWidth * (nowLeft / 100);
    scroll.scrollLeft = Math.max(0, markerPosition - scroll.clientWidth * 0.62);
  }, [axis]);

  return scrollRef;
}

function getRunRange(run: ThemeRun, fallbackMinutes: number) {
  const start = new Date(run.enteredAt ?? run.exitedAt ?? Date.now());
  const end = run.exitedAt
    ? new Date(run.exitedAt)
    : run.expectedExitedAt
      ? new Date(run.expectedExitedAt)
      : new Date(start.getTime() + fallbackMinutes * 60_000);

  return { start, end };
}

function getExpectedExit(run: ThemeRun, theme: Theme) {
  if (run.expectedExitedAt) return new Date(run.expectedExitedAt);
  const enteredAt = new Date(run.enteredAt ?? Date.now());
  return new Date(enteredAt.getTime() + theme.playTimeMinutes * 60_000);
}

function toDateTimeLocal(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function getTimelineWindow(snapshot: SamSnapshot, now = new Date()) {
  const ranges = snapshot.themeRuns.map((run) => {
    const theme = snapshot.themes.find((item) => item.id === run.themeId);
    return getRunRange(run, (theme?.playTimeMinutes ?? 60) + (theme?.cleanupTimeMinutes ?? 15));
  });
  const starts = ranges.map((range) => range.start.getTime());
  const ends = ranges.map((range) => range.end.getTime());
  const start = new Date(Math.min(...starts, now.getTime()) - 15 * 60_000);
  const end = new Date(Math.max(...ends, now.getTime() + 90 * 60_000) + 15 * 60_000);

  return { start, end };
}

function getPredictedTimelineWindow(snapshot: SamSnapshot, predictions: PredictedThemeRun[], now = new Date()) {
  const actualRanges = snapshot.themeRuns
    .filter((run) => ["playing", "completed"].includes(run.status) && run.enteredAt)
    .map((run) => {
      const theme = snapshot.themes.find((item) => item.id === run.themeId);
      return getRunRange(run, theme?.playTimeMinutes ?? 60);
    });
  const starts = [
    ...actualRanges.map((range) => range.start.getTime()),
    ...predictions.map((run) => run.enteredAt.getTime()),
    now.getTime(),
  ];
  const ends = [
    ...actualRanges.map((range) => range.end.getTime()),
    ...predictions.map((run) => run.exitedAt.getTime()),
    now.getTime() + 90 * 60_000,
  ];

  return {
    start: new Date(Math.min(...starts) - 15 * 60_000),
    end: new Date(Math.max(...ends) + 15 * 60_000),
  };
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

function getNowPosition(now: Date, windowStart: Date, windowEnd: Date) {
  const total = windowEnd.getTime() - windowStart.getTime();
  return Math.max(0, Math.min(100, ((now.getTime() - windowStart.getTime()) / total) * 100));
}

function getProgressPercent(start: Date, end: Date, now: Date) {
  const duration = end.getTime() - start.getTime();
  if (duration <= 0) return 100;
  return Math.max(0, Math.min(100, ((now.getTime() - start.getTime()) / duration) * 100));
}

function getLiveBarStyle(
  run: ThemeRun,
  runStart: Date,
  runEnd: Date,
  windowStart: Date,
  windowEnd: Date,
  now: Date,
  color?: string,
) {
  return {
    ...getBarStyle(runStart, runEnd, windowStart, windowEnd, color),
    "--team-color": color,
    "--progress": `${run.status === "playing" ? getProgressPercent(runStart, runEnd, now) : 100}%`,
  } as React.CSSProperties;
}

function getForecastBarStyle(runStart: Date, runEnd: Date, windowStart: Date, windowEnd: Date, color?: string) {
  const total = windowEnd.getTime() - windowStart.getTime();
  const left = Math.max(0, ((runStart.getTime() - windowStart.getTime()) / total) * 100);
  const width = ((runEnd.getTime() - runStart.getTime()) / total) * 100;

  return {
    left: `${left}%`,
    width: `${Math.min(100 - left, width)}%`,
    backgroundColor: color,
  };
}

function getLiveForecastBarStyle(
  run: ThemeRun,
  runStart: Date,
  runEnd: Date,
  windowStart: Date,
  windowEnd: Date,
  now: Date,
  color?: string,
) {
  return {
    ...getForecastBarStyle(runStart, runEnd, windowStart, windowEnd, color),
    "--team-color": color,
    "--progress": `${run.status === "playing" ? getProgressPercent(runStart, runEnd, now) : 100}%`,
  } as React.CSSProperties;
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
