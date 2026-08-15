"use client";

import { useRouter } from "next/navigation";
import { VideoPlayer } from "@/components/VideoPlayer";

export function VideoPlayerSection({
  lessonId,
  src,
  initialPercent,
  alreadyWatched,
}: {
  lessonId: string;
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
      src={src}
      initialPercent={initialPercent}
      alreadyWatched={alreadyWatched}
      onWatched={() => router.refresh()}
    />
  );
}
