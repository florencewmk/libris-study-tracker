import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { CheckIn, StudySession } from "./types";

type ActiveTimer = {
  sessionId: string;
  startedAt: number;
  accumulatedSeconds: number;
  segmentStartedAt: number | null;
  location: string;
  subject: string;
};

const activeTimerKey = (userId: string) => `libris-active-timer:${userId}`;
const readActiveTimer = (userId: string): ActiveTimer | null => {
  try {
    const saved = window.localStorage.getItem(activeTimerKey(userId));
    if (!saved) return null;
    const timer = JSON.parse(saved) as Partial<ActiveTimer>;
    if (typeof timer.sessionId !== "string" || typeof timer.startedAt !== "number" || !Number.isFinite(timer.startedAt) || timer.startedAt <= 0 || timer.startedAt > Date.now()) return null;
    return {
      sessionId: timer.sessionId,
      startedAt: timer.startedAt,
      accumulatedSeconds: typeof timer.accumulatedSeconds === "number" && timer.accumulatedSeconds >= 0 ? timer.accumulatedSeconds : 0,
      segmentStartedAt: typeof timer.segmentStartedAt === "number" && timer.segmentStartedAt <= Date.now() ? timer.segmentStartedAt : null,
      location: typeof timer.location === "string" ? timer.location : "",
      subject: typeof timer.subject === "string" ? timer.subject : "",
    };
  } catch {
    return null;
  }
};

const saveActiveTimer = (userId: string, timer: ActiveTimer) => {
  try { window.localStorage.setItem(activeTimerKey(userId), JSON.stringify(timer)); } catch { /* Storage can be unavailable in private browsing. */ }
};

const clearActiveTimer = (userId: string) => {
  try { window.localStorage.removeItem(activeTimerKey(userId)); } catch { /* Storage can be unavailable in private browsing. */ }
};

const elapsedSeconds = (timer: ActiveTimer) => timer.accumulatedSeconds + (timer.segmentStartedAt === null ? 0 : Math.max(0, Math.floor((Date.now() - timer.segmentStartedAt) / 1000)));

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return `${hours}h ${minutes}m`;
  return minutes ? `${minutes}m` : `${seconds}s`;
};

export default function Dashboard({ session }: { session: Session }) {
  const user = session.user;
  const displayName = String(user.user_metadata?.display_name || "Student");
  const [initialTimer] = useState(() => readActiveTimer(user.id));
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [location, setLocation] = useState(initialTimer?.location || "");
  const [subject, setSubject] = useState(initialTimer?.subject || "");
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(initialTimer);
  const [seconds, setSeconds] = useState(() => initialTimer ? elapsedSeconds(initialTimer) : 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = activeTimer?.segmentStartedAt != null;
  const paused = Boolean(activeTimer && !running);

  async function loadData() {
    if (!supabase) return;
    const [sessionResult, checkInResult] = await Promise.all([
      supabase.from("study_sessions").select("*").order("started_at", { ascending: false }).limit(50),
      supabase.from("library_check_ins").select("*").order("checked_in_at", { ascending: false }).limit(30),
    ]);
    const issue = sessionResult.error || checkInResult.error;
    if (issue) setError(issue.message);
    setSessions((sessionResult.data || []) as StudySession[]);
    setCheckIns((checkInResult.data || []) as CheckIn[]);
  }

  useEffect(() => { void loadData(); }, []);
  useEffect(() => {
    if (!activeTimer) return;
    const updateElapsedTime = () => setSeconds(elapsedSeconds(activeTimer));
    updateElapsedTime();
    const timer = window.setInterval(updateElapsedTime, 1000);
    return () => window.clearInterval(timer);
  }, [activeTimer]);
  useEffect(() => {
    if (!activeTimer) return;
    const updatedTimer = { ...activeTimer, location, subject };
    saveActiveTimer(user.id, updatedTimer);
  }, [activeTimer, location, subject, user.id]);
  useEffect(() => {
    if (!activeTimer || !running) return;
    const sync = () => { void syncSession(activeTimer, elapsedSeconds(activeTimer)); };
    const syncTimer = window.setInterval(sync, 5000);
    const saveWhenHidden = () => { if (document.visibilityState === "hidden") sync(); };
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => {
      window.clearInterval(syncTimer);
      document.removeEventListener("visibilitychange", saveWhenHidden);
    };
  }, [activeTimer, running, location, subject]);
  useEffect(() => {
    if (!activeTimer || !running) return;
    const pauseWhenLeaving = () => {
      const duration = elapsedSeconds(activeTimer);
      const pausedTimer = { ...activeTimer, accumulatedSeconds: duration, segmentStartedAt: null, location, subject };
      saveActiveTimer(user.id, pausedTimer);
      setActiveTimer(pausedTimer);
      setSeconds(duration);
      void syncSession(pausedTimer, duration);
    };
    window.addEventListener("pagehide", pauseWhenLeaving);
    return () => window.removeEventListener("pagehide", pauseWhenLeaving);
  }, [activeTimer, running, location, subject, user.id]);
  useEffect(() => {
    if (initialTimer?.segmentStartedAt === null) void syncSession(initialTimer, initialTimer.accumulatedSeconds);
  }, []);

  const todayKey = new Date().toDateString();
  const displayedSessions = useMemo(() => sessions.map((item) => item.id === activeTimer?.sessionId ? { ...item, duration_seconds: seconds, location: location.trim() || "Independent study", subject: subject.trim() || "General study" } : item), [sessions, activeTimer?.sessionId, seconds, location, subject]);
  const todaySeconds = useMemo(() => displayedSessions.filter((item) => new Date(item.started_at).toDateString() === todayKey).reduce((sum, item) => sum + item.duration_seconds, 0), [displayedSessions, todayKey]);
  const weekSessions = useMemo(() => displayedSessions.filter((item) => new Date(item.started_at).getTime() >= Date.now() - 7 * 86400000), [displayedSessions]);
  const weekSeconds = weekSessions.reduce((sum, item) => sum + item.duration_seconds, 0);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;

  async function checkIn() {
    if (!supabase || !location.trim()) return;
    setBusy(true); setError("");
    const { error: issue } = await supabase.from("library_check_ins").insert({ user_id: user.id, location: location.trim() });
    if (issue) setError(issue.message); else await loadData();
    setBusy(false);
  }

  async function syncSession(timer: ActiveTimer, duration: number) {
    if (!supabase) return false;
    const endedAt = new Date();
    const savedLocation = location.trim() || "Independent study";
    const savedSubject = subject.trim() || "General study";
    const { error: issue } = await supabase.from("study_sessions").update({
      location: savedLocation,
      subject: savedSubject,
      ended_at: endedAt.toISOString(),
      duration_seconds: Math.max(1, duration),
    }).eq("id", timer.sessionId);
    if (issue) { setError(issue.message); return false; }
    setSessions((items) => items.map((item) => item.id === timer.sessionId ? { ...item, location: savedLocation, subject: savedSubject, ended_at: endedAt.toISOString(), duration_seconds: Math.max(1, duration) } : item));
    return true;
  }

  async function startTimer() {
    if (running || !supabase) return;
    if (activeTimer) {
      const resumedTimer = { ...activeTimer, segmentStartedAt: Date.now(), location, subject };
      setActiveTimer(resumedTimer);
      saveActiveTimer(user.id, resumedTimer);
      return;
    }
    setBusy(true); setError("");
    const startedAt = Date.now();
    const savedLocation = location.trim() || "Independent study";
    const savedSubject = subject.trim() || "General study";
    const { data, error: issue } = await supabase.from("study_sessions").insert({
      user_id: user.id,
      location: savedLocation,
      subject: savedSubject,
      started_at: new Date(startedAt).toISOString(),
      ended_at: new Date(startedAt).toISOString(),
      duration_seconds: 1,
    }).select().single();
    if (issue) setError(issue.message);
    else if (data) {
      const timer: ActiveTimer = { sessionId: data.id, startedAt, accumulatedSeconds: 0, segmentStartedAt: startedAt, location, subject };
      setActiveTimer(timer);
      setSeconds(0);
      saveActiveTimer(user.id, timer);
      setSessions((items) => [data as StudySession, ...items.filter((item) => item.id !== data.id)]);
    }
    setBusy(false);
  }

  async function pauseTimer() {
    if (!activeTimer || !running) return;
    const duration = elapsedSeconds(activeTimer);
    const pausedTimer = { ...activeTimer, accumulatedSeconds: duration, segmentStartedAt: null, location, subject };
    setActiveTimer(pausedTimer);
    setSeconds(duration);
    saveActiveTimer(user.id, pausedTimer);
    setBusy(true); setError("");
    await syncSession(pausedTimer, duration);
    setBusy(false);
  }

  async function stopTimer() {
    if (!activeTimer) return;
    const duration = elapsedSeconds(activeTimer);
    setBusy(true); setError("");
    const saved = await syncSession(activeTimer, duration);
    if (saved) {
      setActiveTimer(null);
      setSeconds(0);
      setLocation("");
      setSubject("");
      clearActiveTimer(user.id);
    }
    setBusy(false);
  }

  async function deleteSession(sessionId: string) {
    if (!supabase || sessionId === activeTimer?.sessionId) return;
    if (!window.confirm("Delete this study session? This cannot be undone.")) return;
    setBusy(true); setError("");
    const { error: issue } = await supabase.from("study_sessions").delete().eq("id", sessionId);
    if (issue) setError(issue.message);
    else setSessions((items) => items.filter((item) => item.id !== sessionId));
    setBusy(false);
  }

  const timerText = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((value) => String(value).padStart(2, "0")).join(":");
  const latestCheckIn = checkIns[0];
  const checkedInToday = latestCheckIn && new Date(latestCheckIn.checked_in_at).toDateString() === todayKey;

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview"><span className="brand-mark">L</span><span>Libris</span></a>
        <nav className="side-nav"><a className="active" href="#overview">⌂ Overview</a><a href="#timer">◷ Study timer</a><a href="#history">▤ History</a></nav>
        <div className="profile-card"><span className="avatar">{displayName.slice(0, 1).toUpperCase()}</span><div><b>{displayName}</b><small>{user.email}</small></div><button onClick={() => supabase?.auth.signOut()} aria-label="Log out">↗</button></div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-header" id="overview">
          <div><p className="eyebrow">YOUR STUDY SPACE</p><h1>Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {displayName}.</h1><p>Small, focused steps make remarkable progress.</p></div>
          <div className="date-chip">◌ {new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</div>
        </header>

        {error && <div className="error-banner" role="alert">{error}</div>}

        <section className="dashboard-grid">
          <article className="timer-card" id="timer">
            <div className="card-heading"><span><i className={`status-dot ${running ? "live" : paused ? "paused" : ""}`} />{running ? "SESSION IN PROGRESS" : paused ? "SESSION PAUSED" : "READY TO FOCUS"}</span><b>◷</b></div>
            <div className="timer-display">{timerText}</div>
            <div className="timer-fields">
              <label>STUDYING AT<input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100} placeholder="Library, café, campus, or address" autoComplete="off" /></label>
              <label>FOCUS<input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={80} placeholder="Subjects, books, etc." autoComplete="off" /></label>
            </div>
            <a className="maps-link" href={mapsUrl} target="_blank" rel="noreferrer">⌖ View this place in Google Maps ↗</a>
            <div className="timer-actions">
              <button className="button timer-button start" onClick={startTimer} disabled={busy || running}>{paused ? "Resume" : "Start"}</button>
              <button className="button timer-button pause" onClick={pauseTimer} disabled={busy || !running}>Pause</button>
              <button className="button timer-button stop" onClick={stopTimer} disabled={busy || !activeTimer}>{busy ? "Saving…" : "Stop"}</button>
            </div>
          </article>

          <article className="checkin-card">
            <span className="location-symbol">⌖</span><p className="eyebrow">TODAY'S LIBRARY</p>
            <h2>{checkedInToday ? latestCheckIn.location : "Where’s today’s focus spot? 😊"}</h2>
            <p>{checkedInToday ? `Checked in at ${new Date(latestCheckIn.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Type a place and mark today's visit."}</p>
            <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100} placeholder="Type a place or address" autoComplete="off" />
            <a className="maps-link light" href={mapsUrl} target="_blank" rel="noreferrer">Open in Google Maps ↗</a>
            <button className="button light wide" onClick={checkIn} disabled={busy}>Check in here</button>
          </article>

          <article className="stat-card"><div><p className="eyebrow">TODAY</p><strong>{formatDuration(todaySeconds)}</strong><span>focused time</span></div><div className="mini-ring" style={{ "--progress": `${Math.min(100, todaySeconds / 108)}%` } as React.CSSProperties}><span>{Math.min(100, Math.round(todaySeconds / 108))}%</span></div></article>
          <article className="stat-card"><div><p className="eyebrow">LAST 7 DAYS</p><strong>{formatDuration(weekSeconds)}</strong><span>{weekSessions.length} study sessions</span></div><span className="trend">↗</span></article>
        </section>

        <section className="history-section" id="history">
          <div className="section-title"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Your focus history</h2></div><span>{sessions.length} saved sessions</span></div>
          <div className="history-list">
            {displayedSessions.length === 0 ? <div className="empty-state"><span>◷</span><div><b>Your first session starts here</b><p>Run the timer and your focused time will appear here.</p></div></div> : displayedSessions.slice(0, 10).map((item) => (
              <article key={item.id}><span className="history-icon">◷</span><div className="history-main"><b>{item.subject}</b><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`} target="_blank" rel="noreferrer">⌖ {item.location} ↗</a></div><div className="history-date">{new Date(item.started_at).toLocaleDateString([], { month: "short", day: "numeric" })}<small>{new Date(item.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div><strong>{formatDuration(item.duration_seconds)}</strong><button className="delete-session" onClick={() => void deleteSession(item.id)} disabled={busy || item.id === activeTimer?.sessionId} title={item.id === activeTimer?.sessionId ? "Stop this session before deleting it" : "Delete this session"} aria-label={`Delete ${item.subject} session`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg></button></article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
