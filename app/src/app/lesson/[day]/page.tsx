import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLessonStatesForUser, statesByDayNumber } from "@/lib/course";
import { signedDownloadUrl } from "@/lib/media";
import { publicHlsPlaylistUrl } from "@/lib/media-urls";
import { Header } from "@/components/Header";
import { LessonNav } from "@/components/LessonNav";
import { LockedLessonView } from "@/components/LockedLessonView";
import { VideoPlayerSection } from "@/components/VideoPlayerSection";
import { ActionStepsChecklist } from "@/components/ActionStepsChecklist";
import { TaskSubmissionSection } from "@/components/TaskSubmissionSection";
import { CommentsSection } from "@/components/CommentsSection";
import { DownloadList } from "@/components/DownloadList";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ day: string }>;
}) {
  const { day } = await params;
  const dayNumber = Number(day);
  if (!Number.isInteger(dayNumber)) notFound();

  const profile = await requireProfile();
  const supabase = await createClient();

  const states = await getLessonStatesForUser(supabase, profile.id, profile.has_full_access);
  const byDay = statesByDayNumber(states);
  const entry = byDay.get(dayNumber);
  if (!entry) notFound();

  const prev = byDay.get(dayNumber - 1) ?? null;
  const next = byDay.get(dayNumber + 1) ?? null;
  const accessible = entry.state === "unlocked" || entry.state === "completed";

  const header = (
    <Header
      name={profile.full_name}
      avatarUrl={profile.avatar_url}
      isAdmin={profile.is_admin}
      hasFullAccess={profile.has_full_access}
    />
  );

  if (!accessible) {
    return (
      <>
        {header}
        <main className="wrap py-16">
          <LockedLessonView state={entry.state} unlocksAt={entry.unlocksAt} dayNumber={dayNumber} />
          <div className="mt-8">
            <LessonNav prev={prev} next={next} />
          </div>
        </main>
      </>
    );
  }

  const { lesson, progress } = entry;

  const [{ data: documents }, { data: audio }, { data: steps }, { data: stepCompletions }, { data: submissions }, { data: rawComments }] =
    await Promise.all([
      supabase.from("lesson_documents").select("*").eq("lesson_id", lesson.id).order("order_index"),
      supabase.from("lesson_audio").select("*").eq("lesson_id", lesson.id).order("order_index"),
      supabase.from("action_steps").select("*").eq("lesson_id", lesson.id).order("order_index"),
      supabase
        .from("user_action_step_completions")
        .select("action_step_id")
        .eq("user_id", profile.id),
      supabase
        .from("task_submissions")
        .select("*")
        .eq("user_id", profile.id)
        .eq("lesson_id", lesson.id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("comments")
        .select("id, body, created_at, user_id")
        .eq("lesson_id", lesson.id)
        .order("created_at", { ascending: true }),
    ]);

  // profiles' only SELECT policy is "own row" (see supabase/migrations/0001),
  // so author names/avatars for OTHER members come from the public view
  // instead of embedding profiles directly — see 0005_public_member_profiles.sql.
  const commentAuthorIds = [...new Set((rawComments ?? []).map((c) => c.user_id))];
  const { data: commentAuthors } =
    commentAuthorIds.length > 0
      ? await supabase
          .from("public_member_profiles")
          .select("id, full_name, avatar_url")
          .in("id", commentAuthorIds)
      : { data: [] };
  const authorById = new Map((commentAuthors ?? []).map((a) => [a.id, a]));

  const videoSrc = lesson.hls_ready ? publicHlsPlaylistUrl(lesson.id) : null;

  const [documentLinks, audioLinks] = await Promise.all([
    Promise.all(
      (documents ?? []).map(async (d) => ({
        title: d.title,
        url: (await signedDownloadUrl("lesson-documents", d.file_path, d.title)) ?? "#",
      }))
    ),
    Promise.all(
      (audio ?? []).map(async (a) => ({
        title: a.title,
        url: (await signedDownloadUrl("lesson-audio", a.file_path, a.title)) ?? "#",
      }))
    ),
  ]);

  const stepIds = new Set((stepCompletions ?? []).map((c) => c.action_step_id));
  const latestSubmission = submissions?.[0] ?? null;

  const comments = (rawComments ?? []).map((c) => {
    const author = authorById.get(c.user_id);
    return {
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      author_name: author?.full_name ?? null,
      author_avatar: author?.avatar_url ?? null,
      is_own: c.user_id === profile.id,
    };
  });

  return (
    <>
      {header}
      <main className="wrap py-16">
        <div className="mb-8 flex items-center justify-between">
          <div className="eyebrow">Deň {lesson.day_number} / {states.length}</div>
          {entry.state === "completed" && <span className="tag tag-good">Hotovo</span>}
        </div>

        <h1 className="font-display text-[clamp(26px,3.4vw,38px)] font-semibold max-w-[24ch]">
          {lesson.title}
        </h1>
        {lesson.description && (
          <p className="mt-6 max-w-[64ch] text-[15px] leading-relaxed text-muted">
            {lesson.description}
          </p>
        )}

        <div className="mt-12 grid gap-16 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-16">
            <VideoPlayerSection
              lessonId={lesson.id}
              src={videoSrc}
              initialPercent={progress?.video_watched_percent ?? 0}
              alreadyWatched={Boolean(progress?.video_completed_at)}
            />

            <section>
              <h2 className="font-display text-lg font-medium mb-7">Úloha dňa</h2>
              <TaskSubmissionSection
                lessonId={lesson.id}
                taskType={lesson.task_type}
                taskPrompt={lesson.task_prompt}
                initialSubmission={
                  latestSubmission
                    ? { status: latestSubmission.status, ai_feedback: latestSubmission.ai_feedback }
                    : null
                }
              />
            </section>

            <section>
              <h2 className="font-display text-lg font-medium mb-7">Diskusia</h2>
              <CommentsSection lessonId={lesson.id} initialComments={comments} />
            </section>
          </div>

          <aside className="flex flex-col gap-11">
            {steps && steps.length > 0 && (
              <div>
                <h3 className="font-label text-[13px] uppercase tracking-wide text-muted mb-5">
                  Akčné kroky
                </h3>
                <ActionStepsChecklist
                  steps={steps.map((s) => ({ id: s.id, body: s.body }))}
                  initialCompletedIds={[...stepIds]}
                />
              </div>
            )}

            <div>
              <h3 className="font-label text-[13px] uppercase tracking-wide text-muted mb-5">
                Dokumenty
              </h3>
              <DownloadList items={documentLinks} />
            </div>

            <div>
              <h3 className="font-label text-[13px] uppercase tracking-wide text-muted mb-5">
                Audio
              </h3>
              <DownloadList items={audioLinks} />
            </div>
          </aside>
        </div>

        <div className="mt-20">
          <LessonNav prev={prev} next={next} />
        </div>
      </main>
    </>
  );
}
