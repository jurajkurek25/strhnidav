"use client";

import { useState } from "react";

interface Suggestion {
  id: string;
  score: number;
  reason: string;
  name: string;
  avatarUrl: string | null;
}

export function MatchFinder() {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function findMatches() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/community/matches", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error === "no-bio" ? "Najprv si doplň bio v profile." : "Nepodarilo sa nájsť zhody.");
      setSuggestions(data.suggestions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Niečo sa pokazilo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {suggestions === null && (
        <button onClick={findMatches} disabled={loading} className="btn">
          {loading ? "Hľadám zhody…" : "Nájsť zhody"}
        </button>
      )}
      {error && <p className="mt-4 text-xs text-[#d98d8d]">{error}</p>}

      {suggestions !== null && suggestions.length === 0 && (
        <p className="mt-4 text-sm text-muted">
          Zatiaľ sa nenašla žiadna zhoda — skús to znova neskôr, keď pribudnú ďalšie profily s bio.
        </p>
      )}

      {suggestions !== null && suggestions.length > 0 && (
        <div className="mt-4 flex flex-col gap-4">
          {suggestions.map((s) => (
            <div key={s.id} className="card flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {s.avatarUrl && <img src={s.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />}
                <div>
                  <p className="font-display text-[15px] font-medium text-cream">
                    {s.name} <span className="text-xs text-gold-bright">{s.score}/10</span>
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{s.reason}</p>
                </div>
              </div>
              <div className="flex shrink-0 gap-3">
                <a href={`/community/profile/${s.id}`} className="btn btn-ghost btn-sm">
                  Profil
                </a>
                <a href={`/community/messages/${s.id}`} className="btn btn-sm">
                  Napísať
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
