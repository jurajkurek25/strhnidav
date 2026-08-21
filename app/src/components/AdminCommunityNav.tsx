import Link from "next/link";

const links = [
  { href: "/admin/community/reports", label: "Nahlásenia" },
  { href: "/admin/community/members", label: "Členovia" },
];

export function AdminCommunityNav({ active }: { active: string }) {
  return (
    <nav className="mb-10 flex gap-2">
      {links.map((l) => {
        const isActive = active === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-sm px-3.5 py-2 text-xs uppercase tracking-wide ${
              isActive ? "bg-gold text-bg" : "text-muted hover:text-cream"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
