import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Auth from "./Auth";
import Dashboard from "./Dashboard";
import InstallButton from "./InstallButton";
import { isConfigured, supabase } from "./supabase";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState("");

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    let active = true;
    let readyForAuthEvents = false;
    async function openSession() {
      if (!supabase) return;
      const { data: stored } = await supabase.auth.getSession();
      if (!stored.session) {
        readyForAuthEvents = true;
        if (active) setLoading(false);
        return;
      }

      const { error: verificationError } = await supabase.auth.getUser();
      if (!verificationError) {
        readyForAuthEvents = true;
        if (active) { setSession(stored.session); setLoading(false); }
        return;
      }

      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshed.session) {
        const { error: refreshedVerificationError } = await supabase.auth.getUser();
        if (!refreshedVerificationError) {
          readyForAuthEvents = true;
          if (active) { setSession(refreshed.session); setLoading(false); }
          return;
        }
      }

      await supabase.auth.signOut({ scope: "local" });
      readyForAuthEvents = true;
      if (active) {
        setSession(null);
        setAuthMessage(/issued at future/i.test(verificationError.message)
          ? "Your saved login could not be verified because this device's clock is out of sync. Set date and time to automatic, then log in again."
          : "Your saved login could not be verified. Please log in again.");
        setLoading(false);
      }
    }

    void openSession();
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active && readyForAuthEvents) setSession(nextSession);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  if (!isConfigured) {
    return (
      <main className="setup-shell">
        <section className="setup-card">
          <span className="brand-mark large">L</span>
          <p className="eyebrow">ONE-TIME SETUP</p>
          <h1>Connect Libris to your database</h1>
          <p>This open-source copy is ready. Add your Supabase URL and publishable key to <code>.env.local</code>, run the included SQL setup, then restart the app.</p>
          <p className="muted">The README contains the exact steps. No ChatGPT account is involved.</p>
        </section>
      </main>
    );
  }

  if (loading) return <main className="loading-shell"><span className="brand-mark large">L</span><p>Opening your study space…</p></main>;

  return <>{session ? <Dashboard session={session} /> : <Auth initialMessage={authMessage} />}<InstallButton /></>;
}
