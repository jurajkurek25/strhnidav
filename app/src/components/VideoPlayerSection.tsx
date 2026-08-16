"use client";

import { useRouter } from "next/navigation";
import { VideoPlayer } from "@/components/VideoPlayer";

export function VideoPlayerSection({
  lessonId,
  title,
  src,
  initialPercent,
  alreadyWatched,
}: {
  lessonId: string;
  title: string;
  src: string | null;
  initialPercent: number;
  alreadyWatched: boolean;
}) {
  const router = useRouter();

  if (!src) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-sm bg-bg-alt text-sm text-muted">
        Video sa pripravuje.
      </div>
    );
  }

  return (
    <VideoPlayer
      lessonId={lessonId}
      title={title}
      src={src}
      initialPercent={initialPercent}
      alreadyWatched={alreadyWatched}
      onWatched={() => router.refresh()}
    />
  );
}
