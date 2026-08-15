import Link from "next/link";
import { LockIcon } from "@/components/LockIcon";
import type { LessonWithState } from "@/lib/gating";

function formatUnlockDate(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === tomorrow.getTime()) return "zajtra";
  return date.toLocaleDateString("sk-SK", { day: "numeric", month: "numeric" });
}

export function LessonGridCard({ entry }: { entry: LessonWithState }) {
  const { lesson, state, unlocksAt } = entry;

  const badge =
    state === "completed" ? (
      <span className="tag tag-good">Hotovo</span>
    ) : state === "unlocked" ? (
      <span className="tag tag-good">K dispozícii</span>
    ) : state === "locked_paywall" ? (
      <span className="tag tag-bad">Zamknuté</span>
    ) : (
      <span className="tag tag-muted">Zamknuté</span>
    );

  const body = (
    <div
      className={`card flex h-full flex-col gap-3 p-5 transition ${
        state === "unlocked" || state === "completed"
          ? "hover:border-gold"
          : "opacity-70"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-label text-[13px] tracking-wide text-muted">
          Deň {lesson.day_number}
        </span>
        {badge}
      </div>

      {state === "unlocked" || state === "completed" ? (
        <p className="font-display text-[16px] font-medium leading-snug text-cream line-clamp-3">
          {lesson.title}
        </p>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-3 text-center">
          <LockIcon size={22} />
          <span className="text-xs text-muted">
            {state === "locked_paywall"
              ? "Odomkni celý kurz"
              : unlocksAt
              ? `Odomkne sa ${formatUnlockDate(unlocksAt)}`
              : "Dokonči predchádzajúcu lekciu"}
          </span>
        </div>
      )}
    </div>
  );

  if (state === "unlocked" || state === "completed") {
    return (
      <Link href={`/lesson/${lesson.day_number}`} className="block h-full">
        {body}
      </Link>
    );
  }

  if (state === "locked_paywall") {
    return (
      <Link href="/dashboard/unlock" className="block h-full">
        {body}
      </Link>
    );
  }

  return <div className="h-full cursor-not-allowed">{body}</div>;
}
