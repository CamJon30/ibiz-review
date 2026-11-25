"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// Shows a login screen until there is a Supabase session, then renders the app.
export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) setError(err.message);
    setBusy(false);
  };

  if (checking) return <div className="min-h-[60vh]" />;

  if (!session) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <form onSubmit={signIn} className="w-full max-w-xs space-y-3">
          <h1 className="text-lg font-semibold text-white text-center mb-4">12 Week Year Tracker</h1>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Email" autoComplete="username" required
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-500" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password" autoComplete="current-password" required
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-500" />
          <button type="submit" disabled={busy}
            className="w-full py-3 rounded-xl text-sm font-semibold bg-yellow-500 hover:bg-yellow-400 text-black disabled:opacity-50">
            {busy ? "Signing in..." : "Sign in"}
          </button>
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        </form>
      </div>
    );
  }

  return (
    <>
      {children}
      <div className="text-center pt-6 pb-24">
        <button onClick={() => supabase.auth.signOut()}
          className="text-[11px] text-zinc-600 font-mono hover:text-zinc-400 transition-colors">
          Sign out
        </button>
      </div>
    </>
  );
}
