import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { CheckIn, StudySession } from "./types";

const suggestedLocations = ["Central Library", "University Library", "City Reading Room", "Home study"];
const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes || 1}m`;
};

export default function Dashboard({ session }: { session: Session }) {
  const user = session.user;
  const displayName = String(user.user_metadata?.display_name || "Flo");
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [location, setLocation] = useState(suggestedLocations[0]);
  const [subject, setSubject] = useState("General study");
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    const latest = checkInResult.data?.[0] as CheckIn | undefined;
    if (latest) setLocation(latest.location);
  }

  useEffect(() => { void loadData(); }, []);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const todayKey = new Date().toDateString();
  const todaySeconds = useMemo(() => sessions.filter((item) => new Date(item.started_at).toDateString() === todayKey).reduce((sum, item) => sum + item.duration_seconds, 0), [sessions, todayKey]);
  const weekSessions = useMemo(() => sessions.filter((item) => new Date(item.started_at).getTime() >= Date.now() - 7 * 86400000), [sessions]);
  const weekSeconds = weekSessions.reduce((sum, item) => sum + item.duration_seconds, 0);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;

  async function checkIn() {
    if (!supabase || !location.trim()) return;
    setBusy(true); setError("");
    const { error: issue } = await supabase.from("library_check_ins").insert({ user_id: user.id, location: location.trim() });
    if (issue) setError(issue.message); else await loadData();
    setBusy(false);
  }

  async function toggleTimer() {
    if (!running) { setSeconds(0); setRunning(true); return; }
    setRunning(false);
    if (!supabase || seconds < 1) return;
    setBusy(true); setError("");
    const endedAt = new Date();
    const { error: issue } = await supabase.from("study_sessions").insert({
      user_id: user.id,
      location: location.trim() || "Independent study",
      subject: subject.trim() || "General study",
      started_at: new Date(endedAt.getTime() - seconds * 1000).toISOString(),
      ended_at: endedAt.toISOString(),
      duration_seconds: seconds,
    });
    if (issue) setError(issue.message); else { setSeconds(0); await loadData(); }
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
            <div className="card-heading"><span><i className={`status-dot ${running ? "live" : ""}`} />{running ? "SESSION IN PROGRESS" : "READY TO FOCUS"}</span><b>◷</b></div>
            <div className="timer-display">{timerText}</div>
            <div className="timer-fields">
              <label>STUDYING AT<input list="locations" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100} placeholder="Library, café, campus, or address" /></label>
              <label>FOCUS<input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={80} /></label>
            </div>
            <datalist id="locations">{suggestedLocations.map((item) => <option key={item} value={item} />)}</datalist>
            <a className="maps-link" href={mapsUrl} target="_blank" rel="noreferrer">⌖ View this place in Google Maps ↗</a>
            <button className={`button timer-button ${running ? "stop" : ""}`} onClick={toggleTimer} disabled={busy}>{busy ? "Saving…" : running ? "Finish & save session" : "Start focus session"}</button>
          </article>

          <article className="checkin-card">
            <span className="location-symbol">⌖</span><p className="eyebrow">TODAY'S LIBRARY</p>
            <h2>{checkedInToday ? latestCheckIn.location : "Where are you studying?"}</h2>
            <p>{checkedInToday ? `Checked in at ${new Date(latestCheckIn.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Type a place and mark today's visit."}</p>
            <input list="locations" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100} placeholder="Type a place or address" />
            <a className="maps-link light" href={mapsUrl} target="_blank" rel="noreferrer">Open in Google Maps ↗</a>
            <button className="button light wide" onClick={checkIn} disabled={busy}>Check in here</button>
          </article>

          <article className="stat-card"><div><p className="eyebrow">TODAY</p><strong>{formatDuration(todaySeconds)}</strong><span>focused time</span></div><div className="mini-ring" style={{ "--progress": `${Math.min(100, todaySeconds / 108)}%` } as React.CSSProperties}><span>{Math.min(100, Math.round(todaySeconds / 108))}%</span></div></article>
          <article className="stat-card"><div><p className="eyebrow">LAST 7 DAYS</p><strong>{formatDuration(weekSeconds)}</strong><span>{weekSessions.length} study sessions</span></div><span className="trend">↗</span></article>
        </section>

        <section className="history-section" id="history">
          <div className="section-title"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Your study history</h2></div><span>{sessions.length} saved sessions</span></div>
          <div className="history-list">
            {sessions.length === 0 ? <div className="empty-state"><span>◷</span><div><b>Your first session starts here</b><p>Run the timer and your focused time will appear here.</p></div></div> : sessions.slice(0, 10).map((item) => (
              <article key={item.id}><span className="history-icon">◷</span><div className="history-main"><b>{item.subject}</b><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`} target="_blank" rel="noreferrer">⌖ {item.location} ↗</a></div><div className="history-date">{new Date(item.started_at).toLocaleDateString([], { month: "short", day: "numeric" })}<small>{new Date(item.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div><strong>{formatDuration(item.duration_seconds)}</strong></article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
