// A SLOW ANSWER KEPT ALIVE (08.11.2026). The hub sits behind a load balancer that closes a connection after 60 s with no
// byte on it (idle_timeout.timeout_seconds = 60): an AI writing a whole page, a picture being made, a slow source being
// read can take longer, and the browser then gets a bare 504 while the hub is still working. So the answer starts at once
// and a space goes out every 8 s until the JSON follows - JSON.parse reads past the leading spaces, so every caller that
// does `await r.json()` works unchanged. APSOconvert's work route has done this since its slice 1 (`slow()`).
// The status is sent before the work ends, so it is always 200: the body's `ok` / `error` say how it went.

import { answerOf } from "./answer";

export function keepAlive(work: () => Promise<Response>, beatMs = 8000): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const beat = setInterval(() => { try { ctrl.enqueue(enc.encode(" ")); } catch { /* the reader left */ } }, beatMs);
      let text: string;
      try {
        const r = await work();
        text = await r.text();
        // an answer that is not JSON (it should always be) still reaches the browser as JSON - in plain words, never a
        // page of HTML or a bare status (SARCLA 10.11.2026: "The hub answered 200.") - ./answer.ts
        try { JSON.parse(text); } catch { text = JSON.stringify(answerOf(r.status, text)); }
      } catch (e) {
        text = JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      clearInterval(beat);
      try { ctrl.enqueue(enc.encode(text)); ctrl.close(); } catch { /* the reader left - the work is done anyway */ }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
