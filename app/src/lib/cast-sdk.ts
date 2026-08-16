"use client";

// Thin wrapper around Google's Cast Sender SDK. This is the one external
// script this app loads — there's no way around it, since it's Chrome's
// only mechanism for opening the Chromecast device picker at all. No
// developer registration or paid Cast Application ID is needed: this uses
// Google's own public "Default Media Receiver"
// (chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID), which already supports
// AES-128 encrypted HLS the same way our pipeline produces it — nothing
// custom to host or maintain on Google's side.
//
// Loaded lazily (only once a VideoPlayer actually mounts), not on every
// page.

export type CastState = "NO_DEVICES_AVAILABLE" | "NOT_CONNECTED" | "CONNECTING" | "CONNECTED";

declare global {
  interface Window {
    __onGCastApiAvailable?: (available: boolean) => void;
    cast?: {
      framework: {
        CastContext: {
          getInstance(): CastContextInstance;
        };
        CastContextEventType: {
          CAST_STATE_CHANGED: string;
          SESSION_STATE_CHANGED: string;
        };
      };
    };
    chrome?: {
      cast: {
        AutoJoinPolicy: { ORIGIN_SCOPED: string };
        media: {
          DEFAULT_MEDIA_RECEIVER_APP_ID: string;
          MediaInfo: new (contentUrl: string, contentType: string) => MediaInfoInstance;
          GenericMediaMetadata: new () => { title?: string };
          StreamType: { BUFFERED: string };
          LoadRequest: new (mediaInfo: MediaInfoInstance) => unknown;
        };
      };
    };
  }
}

interface MediaInfoInstance {
  streamType?: string;
  metadata?: { title?: string };
}

interface CastSession {
  loadMedia(request: unknown): Promise<void>;
}

interface CastContextInstance {
  setOptions(options: { receiverApplicationId: string; autoJoinPolicy: string }): void;
  getCastState(): CastState | null;
  getCurrentSession(): CastSession | null;
  requestSession(): Promise<void>;
  endCurrentSession(stopCasting: boolean): void;
  addEventListener(type: string, listener: (event: { castState?: CastState; sessionState?: string }) => void): void;
  removeEventListener(type: string, listener: (event: { castState?: CastState; sessionState?: string }) => void): void;
}

let sdkPromise: Promise<void> | null = null;
let initialized = false;

function loadScript(): Promise<void> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("no window"));
      return;
    }
    if (window.cast?.framework) {
      resolve();
      return;
    }
    window.__onGCastApiAvailable = (available) => {
      if (available) resolve();
      else reject(new Error("Cast API unavailable"));
    };
    const script = document.createElement("script");
    script.src = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
    script.async = true;
    script.onerror = () => reject(new Error("failed to load Cast SDK"));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export async function initCast(): Promise<void> {
  await loadScript();
  if (initialized) return;
  initialized = true;
  const context = window.cast!.framework.CastContext.getInstance();
  context.setOptions({
    receiverApplicationId: window.chrome!.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
    autoJoinPolicy: window.chrome!.cast.AutoJoinPolicy.ORIGIN_SCOPED,
  });
}

export function getCastState(): CastState {
  return window.cast?.framework.CastContext.getInstance().getCastState() ?? "NO_DEVICES_AVAILABLE";
}

export function onCastStateChanged(cb: (state: CastState) => void): () => void {
  const context = window.cast!.framework.CastContext.getInstance();
  const type = window.cast!.framework.CastContextEventType.CAST_STATE_CHANGED;
  const listener = (event: { castState?: CastState }) => {
    if (event.castState) cb(event.castState);
  };
  context.addEventListener(type, listener);
  return () => context.removeEventListener(type, listener);
}

export function onSessionStateChanged(cb: (state: string) => void): () => void {
  const context = window.cast!.framework.CastContext.getInstance();
  const type = window.cast!.framework.CastContextEventType.SESSION_STATE_CHANGED;
  const listener = (event: { sessionState?: string }) => {
    if (event.sessionState) cb(event.sessionState);
  };
  context.addEventListener(type, listener);
  return () => context.removeEventListener(type, listener);
}

export async function castMedia(url: string, title: string): Promise<void> {
  const context = window.cast!.framework.CastContext.getInstance();
  let session = context.getCurrentSession();
  if (!session) {
    await context.requestSession();
    session = context.getCurrentSession();
  }
  if (!session) throw new Error("no cast session after requestSession()");

  const mediaInfo = new window.chrome!.cast.media.MediaInfo(url, "application/x-mpegurl");
  mediaInfo.streamType = window.chrome!.cast.media.StreamType.BUFFERED;
  mediaInfo.metadata = new window.chrome!.cast.media.GenericMediaMetadata();
  mediaInfo.metadata.title = title;

  const request = new window.chrome!.cast.media.LoadRequest(mediaInfo);
  await session.loadMedia(request);
}

export function endCastSession(): void {
  window.cast?.framework.CastContext.getInstance().endCurrentSession(true);
}
