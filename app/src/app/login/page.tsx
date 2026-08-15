"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Deliberately NOT window.location.origin — that reflects whatever
        // URL the browser happens to be on (e.g. a raw IP:port or an SSH
        // tunnel's localhost during testing), which would send Google's
        // OAuth callback to the wrong place. NEXT_PUBLIC_SITE_URL is the
        // one trusted production URL, same as the rest of the app uses.
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div className="card" style={{ padding: "48px", maxWidth: 400, width: "100%" }}>
        <div className="eyebrow" style={{ marginBottom: 22 }}>
          Členská sekcia
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 36,
            lineHeight: 1.08,
            marginBottom: 14,
          }}
        >
          Strhni<span style={{ color: "var(--gold-bright)", fontStyle: "italic", fontWeight: 500 }}>dav.</span>
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.65, marginBottom: 30 }}>
          Prihlás sa cez Google a odomkni prvých 7 lekcií zadarmo.
        </p>

        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="btn"
          style={{ width: "100%" }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
            <path
              fill="#0b0a08"
              d="M44.5 20H24v8.5h11.8C34.7 33.9 30 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.3 0 6.3 1.2 8.6 3.2l6-6C34.9 4.1 29.8 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.1-2.7-.5-4z"
            />
          </svg>
          {loading ? "Presmerúvam…" : "Prihlásiť sa cez Google"}
        </button>

        {error && (
          <p style={{ color: "#d98d8d", fontSize: 13.5, marginTop: 14 }}>{error}</p>
        )}

        <p style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 24, lineHeight: 1.6 }}>
          Prihlásením súhlasíš so spracovaním osobných údajov podľa{" "}
          <a href="https://strhnidav.sk/gdpr" style={{ textDecoration: "underline" }}>
            zásad ochrany osobných údajov
          </a>
          .
        </p>
      </div>
    </main>
  );
}
