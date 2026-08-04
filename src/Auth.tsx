import { FormEvent, useState } from "react";
import { supabase } from "./supabase";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("Flo");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");

    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { display_name: name.trim() || "Flo" } } });

    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
    } else if (mode === "signup" && !result.data.session) {
      setMessage("Check your email to confirm your account, then come back and log in.");
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="Libris home"><span className="brand-mark">L</span><span>Libris</span></a>
        <div>
          <p className="eyebrow">YOUR QUIET STUDY COMPANION</p>
          <h1>Make every study day <em>count.</em></h1>
          <p className="auth-copy">Remember where you studied, time each focus session, and watch your consistency grow.</p>
          <div className="feature-row"><span>⌖</span><div><b>Every location</b><small>Libraries, cafés, campus, or home</small></div></div>
          <div className="feature-row"><span>◷</span><div><b>Every focused minute</b><small>A simple timer with a useful history</small></div></div>
        </div>
        <small>Open-source and independent of ChatGPT</small>
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <p className="eyebrow">WELCOME TO LIBRIS</p>
          <h2>{mode === "login" ? "Log in to your study space" : "Create your study space"}</h2>
          <p>Your data is protected by your own account.</p>

          {mode === "signup" && <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={50} required /></label>}
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required /></label>

          {message && <p className="form-message" role="status">{message}</p>}
          <button className="button primary wide" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</button>
          <button className="text-button" type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>
            {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
          </button>
        </form>
      </section>
    </main>
  );
}
