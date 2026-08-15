"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type Hls from "hls.js";

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

  // src points at an encrypted HLS playlist (.m3u8) — segments are AES-128
  // encrypted and served publicly, the decryption key is fetched by the
  // player from the authenticated /api/video-key/[lessonId] endpoint, so
  // credentials (the login cookie) must ride along with that request.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls: Hls | null = null;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari plays HLS natively, including EXT-X-KEY fetches (same-origin
      // request, so the session cookie is sent automatically).
      video.src = src;
    } else {
      import("hls.js").then(({ default: HlsCtor }) => {
        if (!HlsCtor.isSupported() || !videoRef.current) return;
        hls = new HlsCtor({
          xhrSetup: (xhr) => {
            xhr.withCredentials = true;
          },
        });
        hls.loadSource(src);
        hls.attachMedia(videoRef.current);
      });
    }

    return () => {
      hls?.destroy();
    };
  }, [src]);

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
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-card-line">
        <div
          className="h-full bg-gold transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2.5 text-xs text-muted">
        {watched ? "Video dopozerané ✓" : `Odsledované ${percent}%`}
      </p>
    </div>
  );
}
