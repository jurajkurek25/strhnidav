// Applied to the handful of endpoints a Chromecast receiver fetches
// directly (manifest, segments, key) — that receiver runs on Google's own
// receiver-app origin, not ours, so without these headers its fetches are
// silently blocked by CORS: the cast session connects, media "loads" (the
// manifest request itself may still succeed depending on the failure
// point), but playback never actually starts.
export const CAST_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type",
};
