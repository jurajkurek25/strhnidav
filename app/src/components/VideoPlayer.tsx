"use client";

import { useRef, useState, useCallback } from "react";

const WATCHED_THRESHOLD = 0.95; // count as "watched" once 95% has actually played
const SEEK_FORWARD_TOLERANCE = 2; // seconds of slack before we snap a forward-seek back

export function VideoPlayer({
  src,
  lessonId,
  initialPercent,
  alreadyWatched,
  onWatched,
}: {
  src: string;
  lessonId: string;
  initialPercent: number;
  alreadyWatched: boolean;
  onWatched: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const furthestRef = useRef(0); // seconds, the deepest point actually played
  const reportedRef = useRef(alreadyWatched);
  const lastSavedPercentRef = useRef(Math.floor(initialPercent));
  const [percent, setPercent] = useState(Math.floor(initialPercent));
  const [watched, setWatched] = useState(alreadyWatched);

  const saveProgress = useCallback(
    (pct: number, completed: boolean) => {
      fetch("/api/progress/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, percent: pct, completed }),
      }).catch(() => {});
    },
    [lessonId]
  );

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video || !video.duration) return;

    if (video.currentTime > furthestRef.current) {
      furthestRef.current = video.currentTime;
    }

    const pct = Math.min(100, Math.floor((furthestRef.current / video.duration) * 100));
    setPercent(pct);

    if (pct - lastSavedPercentRef.current >= 5 || pct === 100) {
      lastSavedPercentRef.current = pct;
      const nowWatched = pct / 100 >= WATCHED_THRESHOLD;
      saveProgress(pct, nowWatched && !reportedRef.current);
      if (nowWatched && !reportedRef.current) {
        reportedRef.current = true;
        setWatched(true);
        onWatched();
      }
    }
  }

  function handleSeeking() {
    const video = videoRef.current;
    if (!video) return;
    // Skipping ahead of what's actually been watched defeats the point of
    // "watch the full video" — snap back, but allow re-watching earlier parts.
    if (video.currentTime > furthestRef.current + SEEK_FORWARD_TOLERANCE) {
      video.currentTime = furthestRef.current;
    }
  }

  return (
    <div className="relative">
      <video
        ref={videoRef}
        src={src}
        controls
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onTimeUpdate={handleTimeUpdate}
        onSeeking={handleSeeking}
        onEnded={() => {
          furthestRef.current = videoRef.current?.duration ?? furthestRef.current;
          setPercent(100);
          if (!reportedRef.current) {
            reportedRef.current = true;
            setWatched(true);
            saveProgress(100, true);
            onWatched();
          }
        }}
        className="aspect-video w-full rounded-sm bg-bg-alt"
      />
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-card-line">
        <div
          className="h-full bg-gold transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {watched ? "Video dopozerané ✓" : `Odsledované ${percent}%`}
      </p>
    </div>
  );
}
