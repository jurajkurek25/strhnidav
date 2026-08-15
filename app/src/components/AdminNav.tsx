import Link from "next/link";

const links = [
  { href: "/admin", label: "Prehľad" },
  { href: "/admin/lessons", label: "Lekcie" },
  { href: "/admin/sections", label: "Sekcie" },
  { href: "/admin/users", label: "Členovia" },
];

export function AdminNav({ active }: { active: string }) {
  return (
    <nav className="mt-10 mb-16 flex gap-2 border-b border-card-line">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`px-6 py-3.5 font-label text-[13px] uppercase tracking-wide ${
            active === l.href
              ? "border-b-2 border-gold text-gold-bright"
              : "text-muted hover:text-cream"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
