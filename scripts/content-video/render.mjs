// RENDER A FILM FROM THE VIDEO STUDIO TO MP4 (08.11.2026) - on a machine with Chromium and ffmpeg (the hub's servers
// cannot: AWS Fargate has neither, nor a GPU). The approach of the team's own films (black-friday-2026/video
// scripts/render.mjs): load a page that mounts the film, move it to each frame, screenshot it, pipe the frames to
// ffmpeg (libx264). No third-party video framework.
//
//   node scripts/content-video/render.mjs <spec.json> <out.mp4> [options]
//
//   <spec.json>      the file the studio's "Export for rendering" saves
//   --format=9:16    render the same story in another format; --format=all renders 16:9, 9:16 and 1:1 (-16x9.mp4 ...)
//   --scale=0.5      size (0.5 of 1920x1080 = 960x540, a quick check); default 1
//   --frames=0-89    only these frames (a sample)
//   --stills=0,60,240  PNG stills of these frames instead of a film (<out>-f0060.png ...)
//   --crf=16 --preset=medium   x264 quality / speed (smaller crf = better, bigger file)
//   --concurrency=1  browser tabs drawing frames at once (keep it low on a shared laptop)
//   --url=http://localhost:3000/projects/12/pieces/34/render   draw on the hub's render page instead of the
//                    built-in harness (the hub running on this machine, e.g. `npm run sandbox`)
//   --work=<dir>     where the harness is built (default: <out's folder>/.video-build)
//
// It needs, on this machine:
//   Chromium   CHROME=<chrome.exe or headless shell>, else the newest Playwright headless shell (npx playwright install chromium-headless-shell)
//   ffmpeg     FFMPEG=<ffmpeg.exe> with libx264 (ffmpeg-static has it), else `ffmpeg` on the PATH
//   esbuild    to build the harness: from node_modules, or ESBUILD=<path of an esbuild package folder>
//   playwright-core (the hub's own devDependency)
// It runs below normal priority (and so do the browser and ffmpeg it starts), so the machine stays usable.

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PUBLIC = path.join(ROOT, "public");
const FORMATS = ["16:9", "9:16", "1:1"];

const [specPath, out, ...flags] = process.argv.slice(2);
if (!specPath || !out) {
  console.error("usage: node scripts/content-video/render.mjs <spec.json> <out.mp4> [--format=9:16|all] [--scale=0.5] [--frames=a-b] [--stills=0,60] [--crf=16] [--preset=medium] [--concurrency=1] [--url=<hub render page>]");
  process.exit(1);
}
const opt = Object.fromEntries(flags.map((f) => { const [k, ...v] = f.replace(/^--/, "").split("="); return [k, v.join("=") || "1"]; }));
try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* not allowed: carry on */ }

// ───────────────────────── the spec ─────────────────────────
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
if (spec?.kind !== "apsohub-video" || !spec.doc) throw new Error(`${specPath} is not a video spec from the studio's "Export for rendering".`);

// ───────────────────────── the tools ─────────────────────────
function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const dir = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "ms-playwright");
  const shells = fs.existsSync(dir) ? fs.readdirSync(dir).filter((d) => d.startsWith("chromium_headless_shell-")).sort() : [];
  for (const d of shells.reverse()) {
    for (const sub of ["chrome-headless-shell-win64/chrome-headless-shell.exe", "chrome-linux/headless_shell", "chrome-headless-shell-linux64/chrome-headless-shell", "chrome-mac/headless_shell"]) {
      const exe = path.join(dir, d, sub);
      if (fs.existsSync(exe)) return exe;
    }
  }
  throw new Error("No Chromium found: set CHROME=<path>, or run `npx playwright install chromium-headless-shell`.");
}
function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  const probe = spawnSync("ffmpeg", ["-hide_banner", "-encoders"], { encoding: "utf8" });
  if (probe.status === 0 && /libx264/.test(probe.stdout)) return "ffmpeg";
  throw new Error("No ffmpeg with libx264 found: set FFMPEG=<path to ffmpeg.exe> (ffmpeg-static has it).");
}
async function loadEsbuild() {
  try { return await import("esbuild"); } catch { /* not in this project */ }
  if (process.env.ESBUILD) return import(pathToFileURL(path.join(process.env.ESBUILD, "lib", "main.js")).href);
  throw new Error("esbuild not found: set ESBUILD=<path of an esbuild package folder> (e.g. another project's node_modules/esbuild).");
}

// ───────────────────────── the page ─────────────────────────
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

async function buildHarness(work) {
  const esbuild = await loadEsbuild();
  fs.mkdirSync(work, { recursive: true });
  await esbuild.build({
    entryPoints: [path.join(ROOT, "scripts", "content-video", "harness.tsx")],
    outfile: path.join(work, "harness.js"),
    bundle: true, format: "iife", jsx: "automatic", target: "chrome120", logLevel: "warning",
    define: { "process.env.NODE_ENV": '"production"' },
    nodePaths: [path.join(ROOT, "node_modules")],
  });
  fs.writeFileSync(path.join(work, "index.html"),
    `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;padding:0;overflow:hidden;background:#F4F6F8}</style></head>` +
    `<body><div id="stage"></div><script src="/__video/harness.js"></script></body></html>`);
}

/** Serves the harness at /__video/ and the hub's public/video at /video/, on 127.0.0.1 only. */
function serve(work) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, "http://local").pathname);
    const [base, rel] = url.startsWith("/__video/") ? [work, url.slice(9)] : url.startsWith("/video/") ? [path.join(PUBLIC, "video"), url.slice(7)] : [null, ""];
    const file = base ? path.resolve(base, rel) : "";
    if (!base || !file.startsWith(path.resolve(base) + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/__video/index.html` })));
}

async function openPage(browser, url, filmSpec, scale) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.addInitScript(([s, k]) => { window.__VIDEO_SPEC__ = s; window.__VIDEO_SCALE__ = k; }, [filmSpec, scale]);
  await page.goto(url);
  await page.waitForFunction(() => !!window.engine, null, { timeout: 60_000 });
  const info = await page.evaluate(() => window.engine.comp);
  await page.setViewportSize({ width: info.width, height: info.height });
  await page.evaluate(() => window.engine.ready());
  const frame = async (n) => {
    await page.evaluate((f) => window.engine.seek(f), n);
    const png = await page.screenshot({ type: "png", animations: "allow", caret: "initial", clip: { x: 0, y: 0, width: info.width, height: info.height } });
    if (errors.length) throw new Error(`Frame ${n}: ${errors.join("\n")}`);
    return png;
  };
  return { page, info, frame, close: () => ctx.close() };
}

// ───────────────────────── one film ─────────────────────────
async function renderOne(browser, url, format, target, ffmpeg) {
  const filmSpec = { ...spec, doc: { ...spec.doc, format } };
  const scale = Number(opt.scale ?? 1);
  const conc = Math.max(1, Math.min(4, Number(opt.concurrency ?? 1)));
  const pages = await Promise.all(Array.from({ length: conc }, () => openPage(browser, url, filmSpec, scale)));
  const info = pages[0].info;
  const [a, b] = (opt.frames ?? `0-${info.durationInFrames - 1}`).split("-").map(Number);
  const last = Math.min(b, info.durationInFrames - 1);
  console.log(`${path.basename(target)}: ${format} ${info.width}x${info.height}, frames ${a}-${last} of ${info.durationInFrames} @ ${info.fps} fps`);

  if (opt.stills) {
    const at = String(opt.stills).split(",").map(Number).filter((n) => Number.isFinite(n));
    for (const n of at) {
      const png = await pages[0].frame(Math.min(n, info.durationInFrames - 1));
      const file = target.replace(/\.mp4$/i, "") + `-f${String(n).padStart(4, "0")}.png`;
      fs.writeFileSync(file, png);
      console.log(`  ${file}`);
    }
    await Promise.all(pages.map((p) => p.close()));
    return;
  }

  const part = target.replace(/\.mp4$/i, "") + ".part.mp4";
  const ff = spawn(ffmpeg, [
    "-y", "-v", "error", "-f", "image2pipe", "-framerate", String(info.fps), "-c:v", "png", "-i", "-",
    "-c:v", "libx264", "-preset", opt.preset ?? "medium", "-crf", String(opt.crf ?? 16), "-pix_fmt", "yuv420p", "-profile:v", "high",
    "-movflags", "+faststart", part,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const encoded = new Promise((res, rej) => ff.on("close", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited with ${code}`)))));
  encoded.catch(() => undefined);
  try {
    const slots = new Map();
    const slot = (f) => { if (!slots.has(f)) { const s = {}; s.p = new Promise((res, rej) => Object.assign(s, { res, rej })); s.p.catch(() => undefined); slots.set(f, s); } return slots.get(f); };
    let next = a;
    let written = a;
    const waiters = [];
    const worker = async (pg) => {
      while (next <= last) {
        const f = next++;
        while (f - written > conc * 3) await new Promise((r) => waiters.push(r));
        try { slot(f).res(await pg.frame(f)); } catch (e) { slot(f).rej(e); throw e; }
      }
    };
    const t0 = Date.now();
    const writer = async () => {
      for (let f = a; f <= last; f++) {
        const png = await slot(f).p;
        slots.delete(f);
        if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
        written = f + 1;
        waiters.splice(0).forEach((r) => r());
        const n = f - a + 1;
        if (n % 60 === 0 || f === last) console.log(`  ${n}/${last - a + 1} frames, ${Math.round((((Date.now() - t0) / n) * (last - f)) / 1000)} s left`);
      }
      ff.stdin.end();
    };
    await Promise.all([writer(), ...pages.map(worker)]);
    await encoded;
    fs.renameSync(part, target);
    console.log(`Done ${target} (${(fs.statSync(target).size / 1e6).toFixed(1)} MB) in ${Math.round((Date.now() - t0) / 1000)} s`);
  } catch (e) {
    ff.kill();
    throw e;
  } finally {
    await Promise.all(pages.map((p) => p.close()));
  }
}

// ───────────────────────── go ─────────────────────────
const { chromium } = await import("playwright-core");
const ffmpeg = opt.stills ? null : findFfmpeg();
const outAbs = path.resolve(out);
fs.mkdirSync(path.dirname(outAbs), { recursive: true });
let server = null;
let url = opt.url;
if (!url) {
  const work = path.resolve(opt.work ?? path.join(path.dirname(outAbs), ".video-build"));
  await buildHarness(work);
  const s = await serve(work);
  server = s.server;
  url = s.url;
}
const browser = await chromium.launch({
  executablePath: findChrome(),
  args: ["--force-color-profile=srgb", "--hide-scrollbars", "--mute-audio", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--font-render-hinting=none"],
});
try {
  const which = opt.format === "all" ? FORMATS : [FORMATS.includes(opt.format) ? opt.format : spec.doc.format ?? "16:9"];
  for (const f of which) {
    const target = which.length > 1 ? outAbs.replace(/\.mp4$/i, "") + `-${f.replace(":", "x")}.mp4` : outAbs;
    await renderOne(browser, url, f, target, ffmpeg);
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await browser.close();
  server?.close();
}
