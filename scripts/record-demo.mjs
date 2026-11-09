// Records the product tour from the static demo build: the agent triaging the workspace and
// pulling with approval, the Knowledge labels and search, the workspace graph, and the agent
// answering what a change would affect. The demo is a fictional workspace, so everything
// captured here is safe to publish.
//
//   npm run record:demo   (builds the demo first)
//
// Writes the README video and GIF, the landing page video and poster, and still screenshots.
// The GIF is cut from the video with the ffmpeg build Playwright installs.
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import gifenc from "gifenc";
import { PNG } from "pngjs";

// gifenc ships CommonJS; its named exports come off the default export.
const { GIFEncoder, applyPalette, quantize } = gifenc;
const root = fileURLToPath(new URL("../", import.meta.url));
const port = process.env.DEMO_RECORD_PORT || "5479";
const base = `http://127.0.0.1:${port}/repo-control/#/demo`;
const out = {
  video: path.join(root, "docs/repo-control-demo.webm"),
  gif: path.join(root, "docs/repo-control-demo.gif"),
  marketingVideo: path.join(root, "apps/web/public/marketing/repo-control-demo.webm"),
  poster: path.join(root, "apps/web/public/marketing/repo-control-demo-poster.png"),
  screenshots: path.join(root, "docs/screenshots")
};
const VIDEO = { width: 1440, height: 900 };
const GIF = { width: 800, height: 500, fps: 6, colors: 96 };

const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "apps/web", "--mode", "demo", "--host", "127.0.0.1", "--port", port, "--strictPort"], { cwd: root, stdio: "pipe" });

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(base)).ok) return;
    } catch {
      /* starting */
    }
    await delay(100);
  }
  throw new Error("The demo preview did not start. Run npm run build:demo first.");
}

/** The tour. `shot` is called at the moments worth a still image. */
async function tour(page, shot) {
  await page.goto(base);
  await page.getByRole("heading", { name: "What should we do in your workspace?" }).waitFor();
  // Start from a clean screen: the demo and first-run banners are for visitors, not the tour.
  for (const name of [/^Close$/i, /^Dismiss$/i]) {
    for (const button of await page.getByRole("button", { name }).all()) await button.click().catch(() => {});
  }
  await delay(1600);
  await shot("agent-home");

  await page.getByRole("button", { name: /What needs me today\?/ }).click();
  const approve = page.getByRole("button", { name: "Approve", exact: true });
  await approve.waitFor({ timeout: 30_000 });
  await delay(1800);
  await shot("agent-approval");
  await approve.click();
  await page.getByText(/^Done in /).waitFor({ timeout: 30_000 });
  await delay(2200);
  await shot("agent-conversation");

  await page.locator('[data-dashboard-section="knowledge"]').first().click();
  await page.getByRole("heading", { name: "Labels" }).waitFor();
  await delay(1200);
  await page.getByRole("button", { name: /^react · \d+$/ }).click();
  await delay(1400);
  await page.getByRole("textbox", { name: "Search the workspace" }).pressSequentially("invoices", { delay: 90 });
  await page.getByRole("list", { name: "Repositories matching invoices" }).waitFor();
  await delay(1800);
  await shot("knowledge");

  await page.locator('[data-dashboard-section="graph"]').first().click();
  await page.getByRole("img", { name: /^Graph of \d+ repositories/ }).waitFor();
  await delay(2200);
  await page.getByRole("textbox", { name: "Find a repository" }).pressSequentially("shared", { delay: 90 });
  await page.getByRole("option", { name: "shared-utils" }).click();
  await page.getByRole("complementary", { name: "Relations of shared-utils" }).waitFor();
  await delay(2200);
  await shot("graph");

  await page.getByRole("button", { name: "Ask the agent" }).click();
  await page.getByText(/^Done in /).nth(1).waitFor({ timeout: 30_000 });
  await delay(2600);
  await shot("agent-impact");
}

async function newPage(browser, viewport, recordVideo) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: "dark", ...(recordVideo ? { recordVideo: { dir: recordVideo, size: viewport } } : {}) });
  await context.addInitScript(() => {
    localStorage.setItem("repo-control-color-palette", "black");
    localStorage.setItem("repo-control-language", "en");
  });
  return { context, page: await context.newPage() };
}

async function recordVideo(browser) {
  const directory = await fs.mkdtemp(path.join(root, ".repo-control/record-"));
  await fs.mkdir(out.screenshots, { recursive: true });
  const { context, page } = await newPage(browser, VIDEO, directory);
  await tour(page, async (name) => {
    await page.screenshot({ path: path.join(out.screenshots, `${name}.png`) });
    if (name === "agent-home") await page.screenshot({ path: out.poster });
  });
  const video = page.video();
  await context.close();
  const recorded = await video.path();
  await fs.copyFile(recorded, out.video);
  await fs.copyFile(recorded, out.marketingVideo);
  await fs.rm(directory, { recursive: true, force: true });
}

/** Playwright's own ffmpeg build: it decodes the VP8 video and writes PNG frames. */
async function findFfmpeg() {
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), process.platform === "darwin" ? "Library/Caches/ms-playwright" : process.platform === "win32" ? "AppData/Local/ms-playwright" : ".cache/ms-playwright");
  const binary = process.platform === "darwin" ? "ffmpeg-mac" : process.platform === "win32" ? "ffmpeg-win64.exe" : "ffmpeg-linux";
  for (const entry of (await fs.readdir(cache).catch(() => [])).filter((name) => name.startsWith("ffmpeg-")).sort().reverse()) {
    const candidate = path.join(cache, entry, binary);
    if (await fs.access(candidate).then(() => true, () => false)) return candidate;
  }
  throw new Error("Playwright's ffmpeg was not found. Run npx playwright install ffmpeg.");
}

// The GIF is cut from the recorded video at a steady frame rate, scaled down and quantised to
// one shared palette, which keeps it small and free of colour flicker between frames.
async function makeGif() {
  const directory = await fs.mkdtemp(path.join(root, ".repo-control/frames-"));
  try {
    const ffmpeg = await findFfmpeg();
    await new Promise((resolve, reject) => {
      const child = spawn(ffmpeg, ["-loglevel", "error", "-i", out.video, "-r", String(GIF.fps), "-vf", `scale=${GIF.width}:${GIF.height}`, path.join(directory, "frame-%04d.png")]);
      let stderr = "";
      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${stderr}`))));
    });
    const files = (await fs.readdir(directory)).filter((file) => file.endsWith(".png")).sort();
    const frames = await Promise.all(files.map(async (file) => PNG.sync.read(await fs.readFile(path.join(directory, file))).data));

    // One pixel in sixteen from every sixth frame is plenty to learn the palette.
    const pixels = [];
    frames.forEach((frame, index) => {
      if (index % 6 !== 0) return;
      for (let offset = 0; offset < frame.length; offset += 64) pixels.push(frame[offset], frame[offset + 1], frame[offset + 2], frame[offset + 3]);
    });
    // The last palette entry is reserved for "unchanged": each frame after the first only
    // carries the pixels that differ from what is already on screen, the classic GIF
    // optimisation that turns a mostly static recording into long, cheap runs.
    const palette = quantize(Uint8Array.from(pixels), GIF.colors - 1);
    const unchanged = palette.length;
    palette.push([0, 0, 0]);

    const step = Math.round(1000 / GIF.fps);
    const screen = applyPalette(frames[0], palette.slice(0, unchanged));
    const encoded = [{ indexed: Uint8Array.from(screen), delay: step }];
    for (const frame of frames.slice(1)) {
      const indexed = applyPalette(frame, palette.slice(0, unchanged));
      const delta = new Uint8Array(indexed.length);
      let changed = 0;
      for (let pixel = 0; pixel < indexed.length; pixel++) {
        if (indexed[pixel] === screen[pixel]) delta[pixel] = unchanged;
        else {
          delta[pixel] = indexed[pixel];
          screen[pixel] = indexed[pixel];
          changed += 1;
        }
      }
      // A pause in the tour costs nothing: it extends the previous frame.
      if (changed === 0) encoded[encoded.length - 1].delay += step;
      else encoded.push({ indexed: delta, delay: step });
    }
    const gif = GIFEncoder();
    encoded.forEach((frame, index) =>
      gif.writeFrame(frame.indexed, GIF.width, GIF.height, index === 0 ? { palette, delay: frame.delay } : { delay: frame.delay, transparent: true, transparentIndex: unchanged, dispose: 1 })
    );
    gif.finish();
    await fs.writeFile(out.gif, gif.bytes());
    return encoded.length;
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

try {
  await waitForServer();
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  try {
    await recordVideo(browser);
    const frameCount = await makeGif();
    const sizes = await Promise.all([out.video, out.gif].map(async (file) => `${path.relative(root, file)} ${((await fs.stat(file)).size / 1048576).toFixed(1)} MB`));
    console.log(`Recorded the tour: ${sizes.join(", ")}, ${frameCount} distinct GIF frames, screenshots in ${path.relative(root, out.screenshots)}.`);
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}
