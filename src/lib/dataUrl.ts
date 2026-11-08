// A data: address as a file, decoded in place (08.11.2026). fetch("data:…") is refused by the hub's
// Content-Security-Policy (connect-src 'self', next.config.ts) - the export of a social post and the
// "redrawn" picture both went through it and silently did nothing.

/** The bytes of a data: address as a Blob, or null when it is not one. */
export function dataUrlToBlob(url: string): Blob | null {
  const m = /^data:([^;,]*)((?:;[^;,]*)*?)(;base64)?,([\s\S]*)$/.exec(url);
  if (!m) return null;
  const type = m[1] || "text/plain";
  if (!m[3]) return new Blob([decodeURIComponent(m[4])], { type });
  const bin = atob(m[4]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
