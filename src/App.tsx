import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Auth from "./Auth";
import Dashboard from "./Dashboard";
import InstallButton from "./InstallButton";
import { isConfigured, supabase } from "./supabase";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
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

  return <>{session ? <Dashboard session={session} /> : <Auth />}<InstallButton /></>;
}
