"use client";

import { useState } from "react";

export function UnlockButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
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
      <button onClick={startCheckout} disabled={loading} className="btn">
        {loading ? "Presmerúvam na platbu…" : "Zaplatiť cez Stripe"}
      </button>
      {error && <p className="mt-2 text-xs text-[#d98d8d]">{error}</p>}
    </div>
  );
}
