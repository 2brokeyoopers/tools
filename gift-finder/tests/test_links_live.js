// Opens every gift link on the internet and fails on a dead one.
// Run: node gift-finder/tests/test_links_live.js     Pass means the last line says FAIL=0.
// Run with --selftest to point it at deliberately dead pages on this computer. Every one must FAIL.
//
// What counts:
//   DEAD (fails)          the store says 404 or 410, or shows a "page not found" page,
//                         or our own site is missing the section the button points to.
//   LIVE                  the page opened and shows the product (or the section on our site).
//   COULD NOT REACH       the store turned a robot away (403, 429, 5xx, a puzzle page). Not a fail,
//                         because the page may be fine for people. Each one is listed so a person can
//                         open it by hand. Etsy, TeePublic, Redbubble and often Payhip do this.
"use strict";
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { GIFTS } = require("../gifts.js");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const NOT_FOUND = [/page not found/i, /couldn['’]t find that page/i, /looking for something\?/i, /product (is )?no longer available/i, /this (product|item) (is )?(unavailable|not available)/i, /product not found/i, /sorry, this item is unavailable/i];

function get(url) {
  const tmp = path.join(os.tmpdir(), "gift-finder-" + process.pid + ".html");
  const r = spawnSync("curl", ["-sS", "-L", "--noproxy", "127.0.0.1", "-m", "30", "-A", UA, "-H", "Accept-Language: en-US", "-o", tmp, "-w", "%{http_code}", url], { encoding: "utf8" });
  const status = Number((r.stdout || "").trim()) || 0;
  let body = "";
  try { body = fs.readFileSync(tmp, "utf8"); fs.unlinkSync(tmp); } catch (e) { /* no body */ }
  return { status, body };
}

// Decides LIVE, DEAD or COULD NOT REACH from what came back. Kept apart so the selftest can feed it.
function judge(url, res, gift, siteUrl) {
  const { status, body } = res;
  const onSite = url.startsWith(siteUrl);
  if (status === 404 || status === 410) return ["DEAD", "the page answered " + status];
  if (status === 200 && NOT_FOUND.some((r) => r.test(body.slice(0, 200000)))) return ["DEAD", "the page says it cannot be found"];
  if (onSite) {
    if (status !== 200) return ["DEAD", "our own site answered " + status];
    const hash = url.slice(siteUrl.length).replace(/^#/, "");
    if (hash) return new RegExp('id="' + hash + '(-section)?"').test(body) ? ["LIVE", "section " + hash + " is on the site"] : ["DEAD", "section " + hash + " is not on the site"];
    const words = gift.name.replace(/[^A-Za-z ]/g, " ").split(/\s+/).filter((w) => w.length > 3);
    return words.every((w) => body.includes(w)) ? ["LIVE", "the home page shows " + gift.name] : ["DEAD", "the home page no longer shows " + gift.name];
  }
  if (status === 200) {
    const title = (body.match(/<title[^>]*>([^<]*)/i) || [, ""])[1];
    const words = gift.name.replace(/[^A-Za-z ]/g, " ").split(/\s+/).filter((w) => w.length > 3).slice(0, 3);
    if (words.some((w) => title.toLowerCase().includes(w.toLowerCase()))) return ["LIVE", "title: " + title.trim().slice(0, 70)];
    return ["COULD NOT REACH", "a robot check page came back (title: " + title.trim().slice(0, 40) + ")"];
  }
  return ["COULD NOT REACH", "the store answered " + (status || "nothing") + " to a robot"];
}

function run(list, siteUrl) {
  let pass = 0, fail = 0;
  const unreached = [];
  const siteCache = {};
  for (const g of list) {
    let res;
    if (g.url.startsWith(siteUrl)) { const base = g.url.split("#")[0]; res = siteCache[base] || (siteCache[base] = get(base)); }
    else res = get(g.url);
    const [verdict, why] = judge(g.url, res, g, siteUrl);
    if (verdict === "DEAD") { fail++; console.log("FAIL dead link: " + g.name + " " + g.url + " (" + why + ")"); }
    else if (verdict === "LIVE") { pass++; console.log("PASS " + g.name + " (" + why + ")"); }
    else { pass++; unreached.push(g); console.log("PASS, could not reach: " + g.name + " (" + why + ")"); }
  }
  if (unreached.length) {
    console.log("\nA store turned our robot away on " + unreached.length + " link(s). Please open these by hand once:");
    for (const g of unreached) console.log("  " + g.url);
  }
  return { pass, fail };
}

function finish(pass, fail) { console.log("PASS=" + pass + " FAIL=" + fail); process.exit(fail ? 1 : 0); }

// A tiny pretend web holding only broken pages. It runs in its own process, because the
// check waits for each page in turn and would otherwise block the pretend web from answering.
const PAGES = {
  "/gone": [404, "<title>Gone</title>"],
  "/removed": [410, "<title>Removed</title>"],
  "/sorry": [200, "<title>Amazon.com</title><p>Sorry! We couldn't find that page.</p>"],
  "/site/": [200, '<title>2 Broke Yoopers</title><div id="books-section"></div>'],
};
if (process.argv.includes("--serve")) {
  const server = http.createServer((q, s) => { const p = PAGES[q.url] || [404, ""]; s.writeHead(p[0], { "content-type": "text/html" }); s.end(p[1]); });
  server.listen(0, "127.0.0.1", () => console.log(server.address().port));
} else if (process.argv.includes("--selftest")) {
  const { spawn } = require("child_process");
  const child = spawn(process.execPath, [__filename, "--serve"]);
  child.stdout.once("data", (d) => {
    const base = "http://127.0.0.1:" + String(d).trim();
    const site = base + "/site/";
    const broken = [
      { name: "Dead Store Page", url: base + "/gone" },
      { name: "Removed Store Page", url: base + "/removed" },
      { name: "Not Found Page", url: base + "/sorry" },
      { name: "Missing Section", url: site + "#merch" },
      { name: "Ya Ain't Truly a Yooper T-Shirt", url: site },
    ];
    const { fail } = run(broken, site);
    // Each broken link must fail. Then prove a good one still passes, so the check is not failing everything.
    const good = run([{ name: "Good Section", url: site + "#books" }], site).fail === 0;
    child.kill();
    const caught = fail === broken.length;
    console.log((caught ? "PASS" : "FAIL") + " selftest: " + fail + " of " + broken.length + " dead links were caught");
    console.log((good ? "PASS" : "FAIL") + " selftest: a good section still passes");
    finish((caught ? 1 : 0) + (good ? 1 : 0), (caught ? 0 : 1) + (good ? 0 : 1));
  });
} else {
  const { pass, fail } = run(GIFTS, "https://2brokeyoopers.com/");
  finish(pass, fail);
}
