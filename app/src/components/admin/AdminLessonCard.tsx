import type { ReactNode } from "react";
import Link from "next/link";
import { publicThumbnailUrl } from "@/lib/media-urls";
import { deleteLesson } from "@/app/admin/actions";

const TASK_LABELS: Record<string, string> = {
  text: "Text (AI)",
  image: "Foto (AI)",
  pdf: "PDF (AI)",
  self_check: "Bez AI",
};

export function AdminLessonCard({
  lesson,
  dragHandle,
}: {
  lesson: {
    id: string;
    day_number: number;
    title: string;
    is_free: boolean;
    task_type: string;
    hls_ready: boolean;
    thumbnail_ready: boolean;
    sectionTitle: string | null;
  };
  dragHandle?: ReactNode;
}) {
  const hasThumbnail = lesson.thumbnail_ready;

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="relative aspect-video w-full overflow-hidden">
        <Link href={`/admin/lessons/${lesson.id}`} className="absolute inset-0 block">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, rgba(201,161,48,0.10), transparent 55%), linear-gradient(135deg, #221c15 0%, #12100c 100%)",
            }}
          />
          {hasThumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={publicThumbnailUrl(lesson.id)}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted">
              Bez videa
            </div>
          )}
        </Link>
        <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-sm bg-bg/80 px-2 py-1 font-label text-[12px] tracking-wide text-cream">
          Deň {lesson.day_number}
        </span>
        {dragHandle && (
          <span className="absolute right-2.5 top-2.5 rounded-sm bg-bg/80 p-1">{dragHandle}</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3.5 p-6">
        <Link
          href={`/admin/lessons/${lesson.id}`}
          className="font-display text-[16px] font-medium leading-snug text-cream hover:text-gold-bright line-clamp-2"
        >
          {lesson.title}
        </Link>

        <div className="flex flex-wrap gap-2">
          <span className="tag tag-muted">{lesson.sectionTitle ?? "Bez sekcie"}</span>
          <span className="tag tag-muted">{TASK_LABELS[lesson.task_type] ?? lesson.task_type}</span>
          <span className={`tag ${lesson.is_free ? "tag-good" : "tag-bad"}`}>
            {lesson.is_free ? "zadarmo" : "platené"}
          </span>
          {!lesson.hls_ready && <span className="tag tag-muted">video chýba</span>}
        </div>

        <form action={deleteLesson.bind(null, lesson.id)} className="mt-auto pt-1">
          <button type="submit" className="btn btn-danger btn-sm">
            Zmazať
          </button>
        </form>
      </div>
    </div>
  );
}
