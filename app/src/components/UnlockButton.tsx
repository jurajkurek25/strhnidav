"use client";

import { useState } from "react";

export function UnlockButton() {
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
        body: JSON.stringify({ consent: true }),
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
      <label className="mb-4 flex items-start gap-3 text-sm text-muted">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-gold"
        />
        <span>
          Žiadam o okamžité sprístupnenie zakúpených lekcií po úspešnej platbe a beriem na
          vedomie, že týmto strácam právo na odstúpenie od zmluvy vo vzťahu k lekciám, ktoré si
          pozriem pred uplynutím 14-dňovej lehoty na odstúpenie (čl. 6{" "}
          <a
            href="https://strhnidav.sk/obchodne-podmienky"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-cream"
          >
            Obchodných podmienok
          </a>
          ).
        </span>
      </label>
      <button onClick={startCheckout} disabled={loading || !consent} className="btn">
        {loading ? "Presmerúvam na platbu…" : "Zaplatiť cez Stripe"}
      </button>
      {error && <p className="mt-3 text-xs text-[#d98d8d]">{error}</p>}
    </div>
  );
}
