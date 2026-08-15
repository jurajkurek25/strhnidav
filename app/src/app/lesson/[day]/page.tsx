import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  lessonDocuments,
  lessonAudio,
  actionSteps,
  userActionStepCompletions,
  taskSubmissions,
  comments as commentsTable,
  profiles,
} from "@/lib/db/schema";
import { getLessonStatesForUser, statesByDayNumber } from "@/lib/course";
import { privateFileUrl } from "@/lib/media";
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

  const states = await getLessonStatesForUser(profile.id, profile.hasFullAccess);
  const byDay = statesByDayNumber(states);
  const entry = byDay.get(dayNumber);
  if (!entry) notFound();

  const prev = byDay.get(dayNumber - 1) ?? null;
  const next = byDay.get(dayNumber + 1) ?? null;
  const accessible = entry.state === "unlocked" || entry.state === "completed";

  const header = (
    <Header
      name={profile.fullName}
      avatarUrl={profile.avatarUrl}
      isAdmin={profile.isAdmin}
      hasFullAccess={profile.hasFullAccess}
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

  const [documents, audio, steps, stepCompletions, submissions, rawComments] = await Promise.all([
    db.select().from(lessonDocuments).where(eq(lessonDocuments.lessonId, lesson.id)).orderBy(asc(lessonDocuments.orderIndex)),
    db.select().from(lessonAudio).where(eq(lessonAudio.lessonId, lesson.id)).orderBy(asc(lessonAudio.orderIndex)),
    db.select().from(actionSteps).where(eq(actionSteps.lessonId, lesson.id)).orderBy(asc(actionSteps.orderIndex)),
    db
      .select({ actionStepId: userActionStepCompletions.actionStepId })
      .from(userActionStepCompletions)
      .where(eq(userActionStepCompletions.userId, profile.id)),
    db
      .select()
      .from(taskSubmissions)
      .where(and(eq(taskSubmissions.userId, profile.id), eq(taskSubmissions.lessonId, lesson.id)))
      .orderBy(desc(taskSubmissions.createdAt))
      .limit(1),
    db
      .select({
        id: commentsTable.id,
        body: commentsTable.body,
        createdAt: commentsTable.createdAt,
        userId: commentsTable.userId,
      })
      .from(commentsTable)
      .where(eq(commentsTable.lessonId, lesson.id))
      .orderBy(asc(commentsTable.createdAt)),
  ]);

  // Author names/avatars for comments — a plain select restricted to the two
  // public columns (no email, no access-level fields).
  const commentAuthorIds = [...new Set(rawComments.map((c) => c.userId))];
  const commentAuthors =
    commentAuthorIds.length > 0
      ? await db
          .select({ id: profiles.id, fullName: profiles.fullName, avatarUrl: profiles.avatarUrl })
          .from(profiles)
          .where(inArray(profiles.id, commentAuthorIds))
      : [];
  const authorById = new Map(commentAuthors.map((a) => [a.id, a]));

  const videoSrc = lesson.hlsReady ? publicHlsPlaylistUrl(lesson.id) : null;

  const documentLinks = documents.map((d) => ({
    title: d.title,
    url: privateFileUrl("documents", d.filePath, d.title),
  }));
  const audioLinks = audio.map((a) => ({
    title: a.title,
    url: privateFileUrl("audio", a.filePath, a.title),
  }));

  const stepIds = new Set(stepCompletions.map((c) => c.actionStepId));
  const latestSubmission = submissions[0] ?? null;

  const comments = rawComments.map((c) => {
    const author = authorById.get(c.userId);
    return {
      id: c.id,
      body: c.body,
      created_at: c.createdAt.toISOString(),
      author_name: author?.fullName ?? null,
      author_avatar: author?.avatarUrl ?? null,
      is_own: c.userId === profile.id,
    };
  });

  return (
    <>
      {header}
      <main className="wrap py-16">
        <div className="mb-8 flex items-center justify-between">
          <div className="eyebrow">Deň {lesson.dayNumber} / {states.length}</div>
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
              initialPercent={progress?.videoWatchedPercent ?? 0}
              alreadyWatched={Boolean(progress?.videoCompletedAt)}
            />

            <section>
              <h2 className="font-display text-lg font-medium mb-7">Úloha dňa</h2>
              <TaskSubmissionSection
                lessonId={lesson.id}
                taskType={lesson.taskType}
                taskPrompt={lesson.taskPrompt}
                initialSubmission={
                  latestSubmission
                    ? { status: latestSubmission.status, ai_feedback: latestSubmission.aiFeedback }
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
            {steps.length > 0 && (
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
