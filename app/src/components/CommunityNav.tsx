"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

const links = [
  { href: "/community", label: "Feed" },
  { href: "/community/messages", label: "Správy" },
  { href: "/community/matches", label: "Zhody" },
];

export function CommunityNav({ active }: { active: string }) {
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, []);

  return (
    <nav className="mt-10 mb-16 flex gap-1 overflow-x-auto border-b border-card-line sm:gap-2">
      {links.map((l) => {
        const isActive = active === l.href;
        return (
          <Link
            key={l.href}
            ref={isActive ? activeRef : undefined}
            href={l.href}
            className={`shrink-0 whitespace-nowrap px-3.5 py-3.5 font-label text-[13px] uppercase tracking-wide sm:px-6 ${
              isActive ? "border-b-2 border-gold text-gold-bright" : "text-muted hover:text-cream"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
