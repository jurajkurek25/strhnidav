"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CertificateLookupForm() {
  const [value, setValue] = useState("");
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = value.trim();
    if (id) router.push(`/certifikat/${encodeURIComponent(id)}`);
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-3 sm:flex-row">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="napr. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
        className="font-mono !text-[13.5px]"
        autoFocus
      />
      <button type="submit" className="btn shrink-0">
        Overiť
      </button>
    </form>
  );
}
