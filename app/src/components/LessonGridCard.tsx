import Link from "next/link";
import { LockIcon } from "@/components/LockIcon";
import { publicThumbnailUrl } from "@/lib/hls";
import type { LessonWithState } from "@/lib/gating";

function formatUnlockDate(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === tomorrow.getTime()) return "zajtra";
  return date.toLocaleDateString("sk-SK", { day: "numeric", month: "numeric" });
}

function PlayIcon() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold shadow-[0_0_26px_rgba(201,161,48,0.4)]">
      <svg width="16" height="16" viewBox="0 0 24 24" className="ml-0.5 fill-bg">
        <path d="M8 5v14l11-7z" />
      </svg>
    </div>
  );
}

export function LessonGridCard({ entry }: { entry: LessonWithState }) {
  const { lesson, state, unlocksAt } = entry;
  const accessible = state === "unlocked" || state === "completed";
  const hasThumbnail = lesson.hls_ready && lesson.thumbnail_ready;

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

  const thumbnail = (
    <div
      className="relative aspect-video w-full overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 30% 30%, rgba(201,161,48,0.10), transparent 55%), linear-gradient(135deg, #221c15 0%, #12100c 100%)",
      }}
    >
      {hasThumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={publicThumbnailUrl(lesson.id)}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover ${accessible ? "" : "opacity-40"}`}
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        {accessible ? <PlayIcon /> : <LockIcon size={22} />}
      </div>
      {!accessible && (
        <span className="absolute bottom-2.5 left-2.5 right-2.5 text-center text-[11px] leading-tight text-cream/80">
          {state === "locked_paywall"
            ? "Odomkni celý kurz"
            : unlocksAt
            ? `Odomkne sa ${formatUnlockDate(unlocksAt)}`
            : "Dokonči predchádzajúcu lekciu"}
        </span>
      )}
    </div>
  );

  const body = (
    <div
      className={`card flex h-full flex-col overflow-hidden transition ${
        accessible ? "hover:border-gold" : "opacity-75"
      }`}
    >
      {thumbnail}
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <div className="flex items-center justify-between">
          <span className="font-label text-[13px] tracking-wide text-muted">
            Deň {lesson.day_number}
          </span>
          {badge}
        </div>
        <p className="font-display text-[17px] font-medium leading-snug text-cream line-clamp-2">
          {lesson.title}
        </p>
      </div>
    </div>
  );

  if (accessible) {
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
