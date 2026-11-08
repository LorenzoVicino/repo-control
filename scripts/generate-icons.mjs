#!/usr/bin/env node
// Regenerates every app icon from one definition: the SVG sources in apps/web/public/icon,
// the PNG sizes, the maskable and Apple touch icons, favicon.ico and the Open Graph card.
// PNGs are rasterized by Playwright's Chromium, which renders the glass blur and glow
// filters exactly as a browser shows the SVG. Run with `npm run icons`.
//
// The monochrome mark (repo-control-mark.svg, safari-pinned-tab.svg) keeps the same
// geometry and is not generated here.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "apps", "web", "public");
const iconDir = path.join(publicDir, "icon");

const CENTER = { x: 256, y: 251 };
const NODE_ANGLES = [-90, 30, 150];
const RING_GAP_DEGREES = 17.1;

// Optical sizes of the same mark. Smaller renders get thicker strokes and bigger nodes;
// micro drops the ring, which merges into the nodes below 32 px.
const GEOMETRY = {
  full: { radius: 150, ring: 22, spoke: 18, node: 31, hub: 46 },
  medium: { radius: 140, ring: 28, spoke: 24, node: 36, hub: 48 },
  micro: { radius: 136, ring: 0, spoke: 42, node: 58, hub: 56 }
};

function pointAt(radius, degrees) {
  const angle = (degrees * Math.PI) / 180;
  return [CENTER.x + radius * Math.cos(angle), CENTER.y + radius * Math.sin(angle)];
}

const fmt = ([x, y]) => `${+x.toFixed(1)} ${+y.toFixed(1)}`;

function markSvg(geometry) {
  const { radius, ring, spoke, node, hub } = GEOMETRY[geometry];
  const nodes = NODE_ANGLES.map((angle) => pointAt(radius, angle));
  const arcs = ring
    ? NODE_ANGLES.map((angle, index) => {
        const nextAngle = index < NODE_ANGLES.length - 1 ? NODE_ANGLES[index + 1] : NODE_ANGLES[0] + 360;
        const start = pointAt(radius, angle + RING_GAP_DEGREES);
        const end = pointAt(radius, nextAngle - RING_GAP_DEGREES);
        return `      <path d="M${fmt(start)} A${radius} ${radius} 0 0 1 ${fmt(end)}"/>`;
      })
    : [];

  return [
    ring ? `    <g fill="none" stroke="#fff" stroke-opacity="0.92" stroke-width="${ring}" stroke-linecap="round">\n${arcs.join("\n")}\n    </g>` : "",
    `    <g fill="none" stroke="#fff" stroke-opacity="0.72" stroke-width="${spoke}" stroke-linecap="round">`,
    ...nodes.map((point) => `      <path d="M${CENTER.x} ${CENTER.y} L${fmt(point)}"/>`),
    "    </g>",
    `    <g fill="#fff" fill-opacity="0.95">`,
    ...nodes.map(([x, y]) => `      <circle cx="${+x.toFixed(1)}" cy="${+y.toFixed(1)}" r="${node}"/>`),
    "    </g>",
    `    <circle cx="${CENTER.x}" cy="${CENTER.y}" r="${hub}" fill="url(#rc-hub)" filter="url(#rc-glow)"/>`
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * @param {object} options
 * @param {"full" | "medium" | "micro"} options.geometry
 * @param {boolean} [options.square] full-bleed background, for platforms that apply their own mask
 * @param {boolean} [options.plate] the frosted glass plate behind the mark
 * @param {number} [options.markScale] scale of the mark around the centre
 */
export function buildIconSvg({ geometry, square = false, plate = true, markScale = 1 }) {
  const corner = square ? 0 : 112;
  const markTransform = markScale === 1 ? "" : ` transform="translate(256 256) scale(${markScale}) translate(-256 -256)"`;
  const plateSvg = plate
    ? [
        `    <rect x="36" y="36" width="440" height="440" rx="92" fill="#fff" fill-opacity="0.07" stroke="#fff" stroke-opacity="0.28" stroke-width="3"/>`,
        `    <rect x="36" y="36" width="440" height="440" rx="92" fill="url(#rc-sheen)"/>`
      ].join("\n")
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="repo-control">
  <defs>
    <clipPath id="rc-clip"><rect width="512" height="512" rx="${corner}"/></clipPath>
    <filter id="rc-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="46"/></filter>
    <filter id="rc-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <radialGradient id="rc-hub" cx="0.38" cy="0.35" r="0.7"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#b5abfc"/></radialGradient>
    <linearGradient id="rc-sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  <g clip-path="url(#rc-clip)">
    <rect width="512" height="512" fill="#0b0e1e"/>
    <g filter="url(#rc-blur)">
      <circle cx="140" cy="130" r="190" fill="#8b7cff" fill-opacity="0.8"/>
      <circle cx="420" cy="420" r="180" fill="#22d3ee" fill-opacity="0.55"/>
      <circle cx="440" cy="90" r="110" fill="#f472b6" fill-opacity="0.45"/>
    </g>
${plateSvg ? `${plateSvg}\n` : ""}    <g${markTransform}>
${markSvg(geometry)}
    </g>
  </g>
</svg>
`;
}

const SVG_FILES = {
  "repo-control-icon.svg": { geometry: "full" },
  "favicon.svg": { geometry: "full" },
  "repo-control-icon-medium.svg": { geometry: "medium" },
  "repo-control-icon-micro.svg": { geometry: "micro", plate: false }
};

// Each PNG size uses the optical variant drawn for it.
const PNG_SIZES = [
  { file: "favicon-16.png", size: 16, svg: "repo-control-icon-micro.svg" },
  { file: "favicon-24.png", size: 24, svg: "repo-control-icon-micro.svg" },
  { file: "favicon-32.png", size: 32, svg: "repo-control-icon-medium.svg" },
  { file: "favicon-40.png", size: 40, svg: "repo-control-icon-medium.svg" },
  { file: "favicon-48.png", size: 48, svg: "repo-control-icon-medium.svg" },
  { file: "favicon-64.png", size: 64, svg: "repo-control-icon.svg" },
  { file: "favicon-128.png", size: 128, svg: "repo-control-icon.svg" },
  { file: "favicon-180.png", size: 180, svg: "repo-control-icon.svg" },
  { file: "favicon-192.png", size: 192, svg: "repo-control-icon.svg" },
  { file: "favicon-256.png", size: 256, svg: "repo-control-icon.svg" },
  { file: "favicon-512.png", size: 512, svg: "repo-control-icon.svg" },
  { file: "favicon-1024.png", size: 1024, svg: "repo-control-icon.svg" },
  { file: "mstile-150.png", size: 150, svg: "repo-control-icon.svg" }
];

// Platforms that mask the icon themselves get a full-bleed square. The maskable mark stays
// inside the 40% safe-zone radius; iOS rounds the touch icon and keeps the plate.
const SPECIAL_PNGS = [
  { file: "apple-touch-icon.png", size: 180, options: { geometry: "full", square: true } },
  { file: "icon-maskable-192.png", size: 192, options: { geometry: "medium", square: true, plate: false, markScale: 0.86 } },
  { file: "icon-maskable-512.png", size: 512, options: { geometry: "full", square: true, plate: false, markScale: 0.86 } }
];

const ICO_SIZES = [16, 24, 32, 48, 64];

async function renderSvg(page, svg, size) {
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><img src="${dataUrl}" width="${size}" height="${size}" style="display:block"></body></html>`
  );
  await page.waitForFunction(() => document.images[0]?.complete);
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

function buildIco(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, index) => {
    const entry = 6 + 16 * index;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map(({ data }) => data)]);
}

// Inlined as data URLs: a page set from a string cannot load file:// fonts, and a silent
// fallback font would ship in the card.
async function fontUrl(pkg, file) {
  const data = await fs.readFile(path.join(root, "node_modules", "@fontsource", pkg, "files", file));
  return `data:font/woff2;base64,${data.toString("base64")}`;
}

async function renderOpenGraph(page, iconSvg) {
  const icon = `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString("base64")}`;
  const [inter400, inter600, mono500] = await Promise.all([
    fontUrl("inter", "inter-latin-400-normal.woff2"),
    fontUrl("inter", "inter-latin-600-normal.woff2"),
    fontUrl("jetbrains-mono", "jetbrains-mono-latin-500-normal.woff2")
  ]);
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: Inter; font-weight: 400; src: url(${inter400}); }
    @font-face { font-family: Inter; font-weight: 600; src: url(${inter600}); }
    @font-face { font-family: "JetBrains Mono"; font-weight: 500; src: url(${mono500}); }
    body { margin: 0; }
    .card { position: relative; width: 1200px; height: 630px; overflow: hidden; background: #0b0e1e; font-family: Inter, sans-serif; display: flex; align-items: center; gap: 72px; padding: 0 120px; box-sizing: border-box; }
    .card::before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px); background-size: 40px 40px; }
    .glow { position: absolute; border-radius: 50%; filter: blur(90px); }
    .text { position: relative; display: flex; flex-direction: column; gap: 18px; }
    .eyebrow { font-family: "JetBrains Mono", monospace; font-weight: 500; font-size: 18px; letter-spacing: 0.42em; color: #b5abfc; }
    h1 { margin: 0; font-weight: 600; font-size: 84px; letter-spacing: -0.02em; color: #eef1fa; line-height: 1; }
    p { margin: 0; font-size: 28px; line-height: 1.45; color: #a7adc6; max-width: 560px; }
    img { position: relative; width: 250px; height: 250px; flex: none; filter: drop-shadow(0 24px 60px rgba(139,124,255,0.35)); }
  </style></head><body><div class="card">
    <div class="glow" style="left:-80px;top:-120px;width:520px;height:420px;background:rgba(139,124,255,0.45)"></div>
    <div class="glow" style="right:-120px;bottom:-160px;width:560px;height:420px;background:rgba(34,211,238,0.28)"></div>
    <div class="glow" style="right:220px;top:-140px;width:300px;height:260px;background:rgba(244,114,182,0.22)"></div>
    <img src="${icon}" alt="">
    <div class="text">
      <span class="eyebrow">LOCAL-FIRST DEVELOPER TOOL</span>
      <h1>repo-control</h1>
      <p>One command centre for every repository in your workspace.</p>
    </div>
  </div></body></html>`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    if (!document.fonts.check('600 84px Inter') || !document.fonts.check('500 18px "JetBrains Mono"')) {
      throw new Error("Open Graph fonts did not load");
    }
  });
  await page.waitForFunction(() => document.images[0]?.complete);
  return page.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } });
}

async function main() {
  const svgs = {};
  for (const [file, options] of Object.entries(SVG_FILES)) {
    svgs[file] = buildIconSvg(options);
    await fs.writeFile(path.join(iconDir, file), svgs[file]);
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });

    for (const { file, size, svg } of PNG_SIZES) {
      await fs.writeFile(path.join(iconDir, file), await renderSvg(page, svgs[svg], size));
    }
    for (const { file, size, options } of SPECIAL_PNGS) {
      await fs.writeFile(path.join(iconDir, file), await renderSvg(page, buildIconSvg(options), size));
    }
    await fs.writeFile(path.join(publicDir, "repo-control-icon.png"), await renderSvg(page, svgs["repo-control-icon.svg"], 512));

    const icoPngs = [];
    for (const size of ICO_SIZES) {
      const variant = PNG_SIZES.find((entry) => entry.size === size);
      icoPngs.push({ size, data: await renderSvg(page, svgs[variant.svg], size) });
    }
    await fs.writeFile(path.join(publicDir, "favicon.ico"), buildIco(icoPngs));

    await fs.writeFile(path.join(iconDir, "og-image.png"), await renderOpenGraph(page, svgs["repo-control-icon.svg"]));
  } finally {
    await browser.close();
  }

  console.log("Icons regenerated in apps/web/public and apps/web/public/icon.");
}

await main();
