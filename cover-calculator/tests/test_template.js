// Downloads the template from the real page in a real browser and checks the picture.
// Needs Playwright with Chromium. Run: node cover-calculator/tests/test_template.js
// Pass means the last line says FAIL=0. Run with --selftest to prove the checks can fail.
"use strict";
const path = require("path");
const zlib = require("zlib");
const fs = require("fs");
const os = require("os");
const math = require(path.join(__dirname, "..", "cover-math.js"));
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { console.log("FAIL Playwright is not installed, so the template was not checked"); console.log("PASS=0 FAIL=1"); process.exit(1); }

const CASES = [
  { trim: "6 x 9", paper: "white", pages: 300 },
  { trim: "5 x 8", paper: "cream", pages: 40 },
  { trim: "8.5 x 11", paper: "premium", pages: 590 },
];

// Our PNG writer uses one plain filter per row, so reading it back is simple.
function readPng(buf) {
  const W = buf.readUInt32BE(16), H = buf.readUInt32BE(20);
  let o = 8, idat = [], dpi = null;
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString("ascii", o + 4, o + 8), data = buf.subarray(o + 8, o + 8 + len);
    if (type === "IDAT") idat.push(data);
    if (type === "pHYs" && data[8] === 1) dpi = data.readUInt32BE(0) * 0.0254;
    o += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = (x, y) => { const i = y * (W * 3 + 1) + 1 + x * 3; return [raw[i], raw[i + 1], raw[i + 2]]; };
  return { W, H, dpi, px };
}

function judge(img, r) {
  const out = [];
  const ok = (name, cond) => out.push([name, !!cond]);
  const P = (inches) => Math.round(inches * 300);
  const B = 0.125, W = r.trimWidth, S = r.spineWidth, midY = P(r.fullHeight * 0.66);
  const is = (c, want) => Math.abs(c[0] - want[0]) < 40 && Math.abs(c[1] - want[1]) < 40 && Math.abs(c[2] - want[2]) < 40;
  const near = (x0, y, want, span) => { for (let x = x0 - span; x <= x0 + span; x++) if (x >= 0 && x < img.W && is(img.px(x, y), want)) return true; return false; };
  ok("picture is " + r.pixelWidth + " x " + r.pixelHeight + " pixels", img.W === r.pixelWidth && img.H === r.pixelHeight);
  ok("picture is stamped 300 DPI", Math.abs(img.dpi - 300) < 0.5);
  ok("pink bleed band at the left edge", is(img.px(P(B / 2), midY), [246, 185, 180]));
  ok("pink bleed band at the top edge", is(img.px(P(r.fullWidth / 2 - 2), P(B / 2)), [246, 185, 180]));
  ok("black trim line on the left", near(P(B), midY, [0, 0, 0], 3));
  ok("blue fold line at the left of the spine", near(P(B + W), P(r.fullHeight * 0.5) + 10, [43, 93, 168], 3) || near(P(B + W), P(r.fullHeight * 0.5) + 30, [43, 93, 168], 3));
  ok("blue fold line at the right of the spine", near(P(B + W + S), P(r.fullHeight * 0.5) + 10, [43, 93, 168], 3) || near(P(B + W + S), P(r.fullHeight * 0.5) + 30, [43, 93, 168], 3));
  ok("yellow barcode box 0.25 inch from the spine and the bottom", is(img.px(P(B + W - 0.25 - 0.05), P(B + r.trimHeight - 0.25 - 0.05)), [255, 228, 92]) && !is(img.px(P(B + W - 0.25 + 0.05), P(B + r.trimHeight - 0.25 - 0.05)), [255, 228, 92]));
  ok("front cover is white inside the safe zone", is(img.px(P(B + W + S + W / 2), P(r.fullHeight * 0.75)), [255, 255, 255]));
  return out;
}

(async () => {
  const self = process.argv.includes("--selftest");
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const ctx = await browser.newContext({ acceptDownloads: true });
  const pg = await ctx.newPage();
  await pg.goto("file://" + path.join(__dirname, "..", "index.html"));
  let pass = 0, fail = 0;
  for (const c of CASES) {
    await pg.selectOption("#trim", c.trim);
    await pg.check('input[name=paper][value="' + c.paper + '"]');
    await pg.fill("#pages", String(c.pages));
    await pg.selectOption("#bleed", "yes");
    const dl = pg.waitForEvent("download", { timeout: 60000 });
    await pg.click("#dl");
    const file = path.join(os.tmpdir(), "tpl-" + Date.now() + ".png");
    await (await dl).saveAs(file);
    let img = readPng(fs.readFileSync(file)); fs.unlinkSync(file);
    // Selftest: swap in a broken picture (flat grey, one pixel too wide, no 300 DPI stamp). Every check must fail.
    if (self) img = { W: img.W + 1, H: img.H, dpi: 72, px: () => [128, 128, 128] };
    const r = math.coverSize(Object.assign({ bleed: true }, c));
    const name = c.trim + " in, " + c.pages + " pages, " + c.paper;
    for (const [what, good] of judge(img, r)) {
      if (self ? !good : good) { pass++; console.log("PASS " + (self ? "selftest caught a wrong picture: " : "") + name + ": " + what); }
      else { fail++; console.log("FAIL " + (self ? "selftest missed a wrong picture: " : "") + name + ": " + what); }
    }
  }
  await browser.close();
  console.log("PASS=" + pass + " FAIL=" + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL " + e.message); console.log("PASS=0 FAIL=1"); process.exit(1); });
