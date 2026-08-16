"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type Hls from "hls.js";

const WATCHED_THRESHOLD = 0.95; // count as "watched" once 95% has actually played
const SEEK_FORWARD_TOLERANCE = 2; // seconds of slack before we snap a forward-seek back
const CONTROLS_HIDE_DELAY = 2800; // ms of inactivity before controls fade out while playing
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function formatSpeed(rate: number): string {
  return `${rate % 1 === 0 ? rate : rate.toFixed(2).replace(/0$/, "")}x`;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function PlayGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="fill-current">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function PauseGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="fill-current">
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
    </svg>
  );
}
function VolumeGlyph({ level }: { level: "off" | "low" | "high" }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" className="fill-current">
      <path d="M4 9v6h4l5 5V4L8 9H4z" />
      {level !== "off" && (
        <path
          d="M16.5 12a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12z"
          opacity={level === "high" ? 1 : 0.5}
        />
      )}
      {level === "high" && (
        <path d="M19 12a7 7 0 0 0-4-6.32v1.6A5.5 5.5 0 0 1 17.5 12 5.5 5.5 0 0 1 15 17.72v1.6A7 7 0 0 0 19 12z" />
      )}
      {level === "off" && <path d="M19.5 7.5 18 6l-3 3-3-3-1.5 1.5 3 3-3 3L12 15l3-3 3 3 1.5-1.5-3-3z" />}
    </svg>
  );
}
function FullscreenEnterGlyph() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m11-5v3a2 2 0 0 1-2 2h-3" />
    </svg>
  );
}
function FullscreenExitGlyph() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 3v3a2 2 0 0 1-2 2H4M15 3v3a2 2 0 0 0 2 2h3M9 21v-3a2 2 0 0 0-2-2H4M15 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}
function CastGlyph() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7" />
      <path d="M2 12a6 6 0 0 1 6 6" />
      <path d="M2 16a2 2 0 0 1 2 2" />
      <circle cx="2.5" cy="19.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const furthestRef = useRef(0); // seconds, the deepest point actually played
  const reportedRef = useRef(alreadyWatched);
  const lastSavedPercentRef = useRef(Math.floor(initialPercent));
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [percent, setPercent] = useState(Math.floor(initialPercent));
  const [watched, setWatched] = useState(alreadyWatched);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [castAvailable, setCastAvailable] = useState(false);
  const [casting, setCasting] = useState(false);
  const speedMenuRef = useRef<HTMLDivElement>(null);

  // src points at an encrypted HLS playlist (.m3u8) — segments are AES-128
  // encrypted and served publicly, the decryption key is fetched by the
  // player from the authenticated /api/video-key/[lessonId] endpoint, so
  // credentials (the login cookie) must ride along with that request.
  // Pulled out of the effect so a Cast disconnect (handleCast below) can
  // re-run the exact same setup to resume local in-browser playback.
  const attachLocalSource = useCallback(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    hlsRef.current?.destroy();
    hlsRef.current = null;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari plays HLS natively, including EXT-X-KEY fetches (same-origin
      // request, so the session cookie is sent automatically).
      video.src = src;
    } else {
      import("hls.js").then(({ default: HlsCtor }) => {
        if (!HlsCtor.isSupported() || !videoRef.current) return;
        const hls = new HlsCtor({
          xhrSetup: (xhr) => {
            xhr.withCredentials = true;
          },
        });
        hls.loadSource(src);
        hls.attachMedia(videoRef.current);
        hlsRef.current = hls;
      });
    }
  }, [src]);

  useEffect(() => {
    attachLocalSource();
    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [attachLocalSource]);

  // Chromecast via the browser's built-in Remote Playback API — no Google
  // Cast SDK, no external script. Chrome only offers to cast a source it
  // considers "remote-playback eligible", and a blob:/MediaSource source —
  // which is what the *visible* element above uses for local hls.js
  // playback — never qualifies, no matter how many receivers are on the
  // network. So availability is watched on a second, hidden <video> whose
  // src is always a real network URL, completely decoupled from local
  // playback; only shown once that reports a nearby receiver, and silently
  // stays hidden on browsers without the API at all (Safari/Firefox).
  const castProbeRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const probe = castProbeRef.current;
    if (!probe?.remote?.watchAvailability || !src) return;

    let cancelled = false;
    const remote = probe.remote;

    remote.watchAvailability((available) => {
      if (!cancelled) setCastAvailable(available);
    }).catch(() => {});

    function onConnecting() {
      setCasting(true);
    }
    function onDisconnect() {
      setCasting(false);
      probe!.src = src; // back to the plain (tokenless) URL for continued watching
    }
    remote.addEventListener("connecting", onConnecting);
    remote.addEventListener("connect", onConnecting);
    remote.addEventListener("disconnect", onDisconnect);

    return () => {
      cancelled = true;
      remote.cancelWatchAvailability().catch(() => {});
      remote.removeEventListener("connecting", onConnecting);
      remote.removeEventListener("connect", onConnecting);
      remote.removeEventListener("disconnect", onDisconnect);
    };
  }, [src]);

  async function handleCast() {
    const probe = castProbeRef.current;
    const video = videoRef.current;
    if (!probe) return;
    try {
      const res = await fetch(`/api/cast/${lessonId}`, { method: "POST" });
      if (!res.ok) throw new Error("cast session failed");
      const { url } = (await res.json()) as { url: string };

      probe.src = url; // the tokenized manifest the receiver fetches directly
      video?.pause(); // avoid the same lesson playing out loud locally too
      await probe.remote.prompt();
    } catch {
      // Device picker cancelled, or minting the session failed — reset the
      // probe back to a valid source so availability watching keeps working.
      if (src) probe.src = src;
    }
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (!speedMenuOpen) return;
    function onOutside(e: MouseEvent) {
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) {
        setSpeedMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [speedMenuOpen]);

  useEffect(() => {
    function onFsChange() {
      setFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const wakeControls = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), CONTROLS_HIDE_DELAY);
  }, []);

  useEffect(() => {
    if (playing) wakeControls();
    else {
      setShowControls(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [playing, wakeControls]);

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

    if (!scrubbing) setCurrentTime(video.currentTime);

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

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }

  function seekToFraction(fraction: number) {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const maxAllowedFraction = Math.min(
      1,
      (furthestRef.current + SEEK_FORWARD_TOLERANCE) / video.duration
    );
    const clamped = Math.max(0, Math.min(fraction, maxAllowedFraction));
    video.currentTime = clamped * video.duration;
    setCurrentTime(video.currentTime);
  }

  function fractionFromPointer(clientX: number): number {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  function handleTrackPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setScrubbing(true);
    seekToFraction(fractionFromPointer(e.clientX));
  }
  function handleTrackPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!scrubbing) return;
    setCurrentTime(fractionFromPointer(e.clientX) * (duration || 0));
    seekToFraction(fractionFromPointer(e.clientX));
  }
  function handleTrackPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    setScrubbing(false);
  }

  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      containerRef.current.requestFullscreen?.();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "ArrowLeft") {
      seekToFraction((currentTime - 5) / (duration || 1));
    } else if (e.key === "ArrowRight") {
      seekToFraction((currentTime + 5) / (duration || 1));
    } else if (e.key === "f") {
      toggleFullscreen();
    } else if (e.key === "m") {
      setMuted((m) => !m);
    }
  }

  const playedFraction = duration > 0 ? currentTime / duration : 0;
  const watchedFraction = duration > 0 ? Math.min(1, furthestRef.current / duration) : 0;
  const volumeLevel: "off" | "low" | "high" = muted || volume === 0 ? "off" : volume < 0.5 ? "low" : "high";

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label="Video prehrávač"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseMove={wakeControls}
      onMouseLeave={() => playing && setShowControls(false)}
      onClick={togglePlay}
      className="group relative aspect-video w-full select-none overflow-hidden rounded-sm bg-black outline-none"
    >
      <video
        ref={videoRef}
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        playsInline
        onContextMenu={(e) => e.preventDefault()}
        onTimeUpdate={handleTimeUpdate}
        onSeeking={handleSeeking}
        onLoadedMetadata={() => {
          setDuration(videoRef.current?.duration ?? 0);
          setLoading(false);
        }}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
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
        className="h-full w-full"
      />

      {/* Never played, never visible — exists only so the Remote Playback
          API has a real network URL to evaluate for Chromecast
          availability, and to be handed off to when casting starts. See
          the comment on castProbeRef above. */}
      <video ref={castProbeRef} src={src} muted playsInline preload="metadata" tabIndex={-1} aria-hidden className="hidden" />

      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-cream/25 border-t-gold-bright" />
        </div>
      )}

      {!playing && !loading && (
        <button
          type="button"
          aria-label="Prehrať"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gold text-bg shadow-[0_0_30px_rgba(201,161,48,0.45)] transition hover:bg-gold-bright"
        >
          <PlayGlyph size={26} />
        </button>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-3 pt-12 transition-opacity duration-200 ${
          showControls || !playing ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div
          ref={trackRef}
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handleTrackPointerMove}
          onPointerUp={handleTrackPointerUp}
          className="group/track relative flex h-4 cursor-pointer items-center"
        >
          <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className="absolute inset-y-0 left-0 bg-white/25"
              style={{ width: `${watchedFraction * 100}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-gold-bright"
              style={{ width: `${playedFraction * 100}%` }}
            />
          </div>
          <div
            className="absolute h-3 w-3 -translate-x-1/2 rounded-full bg-gold-bright opacity-0 shadow transition-opacity group-hover/track:opacity-100"
            style={{ left: `${playedFraction * 100}%` }}
          />
        </div>

        <div className="mt-1 flex items-center gap-3">
          <button
            type="button"
            aria-label={playing ? "Pozastaviť" : "Prehrať"}
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="text-cream transition hover:text-gold-bright"
          >
            {playing ? <PauseGlyph size={19} /> : <PlayGlyph size={19} />}
          </button>

          <span className="whitespace-nowrap font-label text-[11px] tabular-nums tracking-wide text-cream/80 sm:text-[12px]">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          <div ref={speedMenuRef} className="relative">
            <button
              type="button"
              aria-label="Rýchlosť prehrávania"
              onClick={(e) => {
                e.stopPropagation();
                setSpeedMenuOpen((o) => !o);
              }}
              className={`rounded-sm px-1.5 py-0.5 font-label text-[12px] tabular-nums tracking-wide transition ${
                playbackRate !== 1 ? "text-gold-bright" : "text-cream hover:text-gold-bright"
              }`}
            >
              {formatSpeed(playbackRate)}
            </button>
            {speedMenuOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-20 overflow-hidden rounded-sm border border-card-line bg-bg-alt shadow-lg">
                {SPEED_OPTIONS.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlaybackRate(rate);
                      setSpeedMenuOpen(false);
                    }}
                    className={`block w-full px-3 py-1.5 text-left font-label text-[12px] tracking-wide transition ${
                      rate === playbackRate
                        ? "bg-gold/15 text-gold-bright"
                        : "text-cream hover:bg-card"
                    }`}
                  >
                    {formatSpeed(rate)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={muted ? "Zapnúť zvuk" : "Stlmiť"}
              onClick={(e) => {
                e.stopPropagation();
                setMuted((m) => !m);
              }}
              className="text-cream transition hover:text-gold-bright"
            >
              <VolumeGlyph level={volumeLevel} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                setMuted(v === 0);
              }}
              className="range-gold hidden w-16 sm:block"
              aria-label="Hlasitosť"
            />
          </div>

          {castAvailable && (
            <button
              type="button"
              aria-label={casting ? "Prehráva sa na TV" : "Prehrať na TV (Chromecast)"}
              onClick={(e) => {
                e.stopPropagation();
                handleCast();
              }}
              className={`transition ${casting ? "text-gold-bright" : "text-cream hover:text-gold-bright"}`}
            >
              <CastGlyph />
            </button>
          )}

          <button
            type="button"
            aria-label={fullscreen ? "Ukončiť celú obrazovku" : "Celá obrazovka"}
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            className="text-cream transition hover:text-gold-bright"
          >
            {fullscreen ? <FullscreenExitGlyph /> : <FullscreenEnterGlyph />}
          </button>
        </div>
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        className="pointer-events-none absolute right-3 top-3 rounded-sm bg-black/50 px-2 py-1 font-label text-[11px] tracking-wide text-cream/70"
      >
        {watched ? "Dopozerané ✓" : `${percent}%`}
      </div>
    </div>
  );
}
