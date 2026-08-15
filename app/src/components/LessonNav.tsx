import Link from "next/link";
import { LockIcon } from "@/components/LockIcon";
import type { LessonWithState } from "@/lib/gating";

function NavTile({ entry, direction }: { entry: LessonWithState | null; direction: "prev" | "next" }) {
  const label = direction === "prev" ? "Predchádzajúca lekcia" : "Nasledujúca lekcia";
  const arrow = direction === "prev" ? "←" : "→";

  if (!entry) {
    return <div className="card flex-1 p-5 opacity-40" />;
  }

  const accessible = entry.state === "unlocked" || entry.state === "completed";

  if (accessible) {
    return (
      <Link
        href={`/lesson/${entry.lesson.day_number}`}
        className="card flex flex-1 items-center gap-3.5 p-5 hover:border-gold"
        style={{ flexDirection: direction === "prev" ? "row" : "row-reverse", textAlign: direction === "prev" ? "left" : "right" }}
      >
        <span className="text-gold">{arrow}</span>
        <span className="min-w-0">
          <span className="block text-xs text-muted">{label}</span>
          <span className="mt-1 block truncate text-sm text-cream">
            Deň {entry.lesson.day_number} — {entry.lesson.title}
          </span>
        </span>
      </Link>
    );
  }

  return (
    <div
      className="card flex flex-1 items-center gap-3.5 p-5 opacity-60"
      style={{ flexDirection: direction === "prev" ? "row" : "row-reverse", textAlign: direction === "prev" ? "left" : "right" }}
    >
      <LockIcon size={16} />
      <span className="min-w-0">
        <span className="block text-xs text-muted">{label}</span>
        <span className="mt-1 block text-sm text-muted">
          {entry.state === "locked_paywall" ? "Odomkni celý kurz" : "Splň úlohu tejto lekcie"}
        </span>
      </span>
    </div>
  );
}

export function LessonNav({
  prev,
  next,
}: {
  prev: LessonWithState | null;
  next: LessonWithState | null;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <NavTile entry={prev} direction="prev" />
      <NavTile entry={next} direction="next" />
    </div>
  );
}
