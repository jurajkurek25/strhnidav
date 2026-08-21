"use client";

import { useState } from "react";
import { CONSENT_LABEL } from "@/components/ConsentLabel";

export function BuyBlockConsent({ sectionId }: { sectionId: string }) {
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true, sectionId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Platbu sa nepodarilo spustiť.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Niečo sa pokazilo.");
      setLoading(false);
    }
  }

  return (
    <div>
      <label className="mb-6 flex items-start gap-3 text-sm text-muted">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-gold"
        />
        <span>{CONSENT_LABEL}</span>
      </label>
      <button
        onClick={startCheckout}
        disabled={loading || !consent}
        className="btn"
        style={{ width: "100%" }}
      >
        {loading ? "Presmerúvam na platbu…" : "Pokračovať na platbu"}
      </button>
      {error && <p className="mt-3 text-xs text-[#d98d8d]">{error}</p>}
    </div>
  );
}
