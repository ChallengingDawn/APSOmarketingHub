// THE FILM'S CLOCK (08.11.2026): 30 frames a second, 120 beats a minute - a beat is 15 frames, a bar (four beats) is
// 60 frames, two seconds. Every scene starts on a bar line, so every cut lands on the music (the team's rule, as in the
// Black Friday, compatibility and APSOhub films). Pure - tests/studio-video.test.ts.

export const FPS = 30;
export const BPM = 120;

/** Frames in one beat at `bpm` (15 at 120). */
export const beatFrames = (bpm = BPM) => (FPS * 60) / bpm;
/** Frames in one bar of four beats (60 at 120). */
export const barFrames = (bpm = BPM) => 4 * beatFrames(bpm);

export const BEAT = beatFrames(BPM);
export const BAR = barFrames(BPM);

/** "0:04.12" - minutes, seconds and the frame inside the second. */
export function timecode(frame: number, fps = FPS): string {
  const f = Math.max(0, Math.round(frame));
  const s = Math.floor(f / fps);
  const ff = f % fps;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}.${String(ff).padStart(2, "0")}`;
}

/** Seconds, one decimal where it has one: 18, 17.5. */
export const seconds = (frames: number, fps = FPS) => Math.round((frames / fps) * 10) / 10;

/**
 * A beat's punch: 1 on the beat, falling off over `decay` frames, from `from` on (0 before). For things that answer
 * the music - a button that pulses, a camera that kicks.
 */
export function beatPulse(f: number, from = 0, decay = 5, every = BEAT): number {
  if (f < from) return 0;
  const since = (f - from) % every;
  return Math.exp(-since / decay) * Math.min(1, (since + 1) / 2);
}

/** Which beat (0, 1, 2 ...) a local frame is in. */
export const beatOf = (f: number, every = BEAT) => Math.floor(Math.max(0, f) / every);
