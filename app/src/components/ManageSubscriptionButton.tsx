"use client";

import { useState } from "react";

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "unknown");
      window.location.href = data.url;
    } catch {
      setLoading(false);
    }
  }

  return (
    <button onClick={openPortal} disabled={loading} className="btn btn-ghost btn-sm">
      {loading ? "Otváram…" : "Spravovať predplatné"}
    </button>
  );
}
