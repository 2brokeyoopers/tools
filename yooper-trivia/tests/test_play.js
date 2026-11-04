// Plays the quiz in a real browser at phone size. Run: node yooper-trivia/tests/test_play.js
// Needs Playwright with Chromium. Pass means the last line says FAIL=0.
// Run with --selftest to play a deliberately broken copy; the round and offline checks must fail on it.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json" };
function serve(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      const file = path.join(root, p);
      if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); return res.end("not found"); }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function play(root) {
  const out = [];
  const ok = (name, cond) => out.push([name, !!cond]);
  const QUESTIONS = JSON.parse(JSON.stringify(require(path.join(root, "yooper-trivia", "questions.js"))));
  delete require.cache[require.resolve(path.join(root, "yooper-trivia", "questions.js"))];
  const answerOf = new Map(QUESTIONS.map((q) => [q.q, q.answer]));
  const server = await serve(root);
  const url = "http://127.0.0.1:" + server.address().port + "/yooper-trivia/";
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });
  // Computers without a share menu copy the score instead. Catch what would be copied.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } }, configurable: true });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const noSideScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  try {
    await page.goto(url);
    ok("the start screen fits the phone with no sideways scrolling", await noSideScroll());
    await page.click("#go");
    const asked = [];
    let expected = 0, everyFeedback = true, oneRightShown = true, fits = true, totalShown = "";
    for (let i = 0; i < 12; i++) {
      if (!(await page.isVisible("#play"))) break;
      const q = await page.textContent("#question");
      asked.push(q);
      totalShown = await page.textContent("#count");
      if (!(await noSideScroll())) fits = false;
      const choices = await page.$$eval("#choices .choice", (bs) => bs.map((b) => b.textContent));
      // Answer right on even turns, wrong on odd turns, so the score is known.
      const right = answerOf.get(q);
      const pick = i % 2 === 0 ? right : choices.find((c) => c !== right);
      if (i % 2 === 0) expected++;
      await page.click("#choices .choice >> text=" + JSON.stringify(pick));
      if (!(await page.isVisible("#feedback"))) everyFeedback = false;
      const shownRight = await page.$$eval("#choices .choice.right", (bs) => bs.map((b) => b.textContent));
      if (shownRight.length !== 1 || shownRight[0] !== right) oneRightShown = false;
      if (!(await noSideScroll())) fits = false;
      await page.click("#next");
    }
    ok("a round asks exactly 10 questions", asked.length === 10 && /of 10$/.test(totalShown));
    ok("the 10 questions in a round are all different", new Set(asked).size === asked.length && asked.length > 0);
    ok("every question is one from questions.js", asked.length > 0 && asked.every((q) => answerOf.has(q)));
    ok("every answer shows the fact and its source", everyFeedback);
    ok("after each answer the right answer is the one marked right", oneRightShown);
    ok("the questions fit the phone with no sideways scrolling", fits);
    ok("the end screen shows the score", (await page.isVisible("#end")) && (await page.textContent("#final")) === expected + " / " + asked.length);
    ok("the end screen fits the phone with no sideways scrolling", await noSideScroll());
    await page.click("#share");
    const copied = await page.evaluate(() => window.__copied || "");
    ok("the share button shares the score and the quiz link", copied.includes("I scored " + expected + " out of " + asked.length) && copied.includes("https://2brokeyoopers.github.io/tools/yooper-trivia/"));
    ok("the end screen links to the store and the dictionary", (await page.isVisible('#end a[href="https://2brokeyoopers.com"]')) && (await page.isVisible('#end a[href="../yooper-dictionary/"]')));
    await page.click("#again");
    ok("play again starts a fresh round at question 1", (await page.textContent("#count")).startsWith("Question 1 of"));

    // Offline: let the helper save the files, then switch the internet off and start a new round.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 });
    // Shut the web server down as well as switching the browser offline. Older Chromium lets a service worker
    // reach the network even when the browser is offline, so only a stopped server proves the saved copy is used.
    await context.setOffline(true);
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    let offlineOk = false;
    try {
      await page.reload();
      await page.click("#go", { timeout: 5000 });
      const q = await page.textContent("#question", { timeout: 5000 });
      offlineOk = answerOf.has(q);
    } catch (e) { offlineOk = false; }
    ok("the quiz still works with the internet switched off", offlineOk);
    ok("no errors in the page", errors.length === 0);
  } finally {
    await browser.close();
    if (server.listening) { server.closeAllConnections(); server.close(); }
  }
  return out;
}

function brokenCopy() {
  // A copy of the site with nine questions per round and the questions left out of the offline files.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trivia-broken-"));
  const repo = path.join(__dirname, "..", "..");
  for (const d of ["yooper-trivia", "yooper-dictionary"]) {
    fs.mkdirSync(path.join(tmp, d));
    for (const f of fs.readdirSync(path.join(repo, d))) { const s = path.join(repo, d, f); if (fs.statSync(s).isFile()) fs.copyFileSync(s, path.join(tmp, d, f)); }
  }
  const page = path.join(tmp, "yooper-trivia", "index.html");
  fs.writeFileSync(page, fs.readFileSync(page, "utf8").replace("var ROUND = 10;", "var ROUND = 9;"));
  const sw = path.join(tmp, "yooper-trivia", "sw.js");
  fs.writeFileSync(sw, fs.readFileSync(sw, "utf8").replace("'questions.js', ", "").replace("caches.open(CACHE).then(c => c.put(e.request, copy))", "Promise.resolve()"));
  return tmp;
}

(async () => {
  let pass = 0, fail = 0;
  if (process.argv.includes("--selftest")) {
    const results = new Map(await play(brokenCopy()));
    for (const name of ["a round asks exactly 10 questions", "the quiz still works with the internet switched off"]) {
      if (results.get(name) === false) { pass++; console.log("PASS selftest caught: " + name); }
      else { fail++; console.log("FAIL selftest: this check did not catch the broken copy: " + name); }
    }
  } else {
    for (const [name, good] of await play(path.resolve(__dirname, "..", ".."))) {
      if (good) { pass++; console.log("PASS " + name); } else { fail++; console.log("FAIL " + name); }
    }
  }
  console.log("PASS=" + pass + " FAIL=" + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL the browser check crashed: " + e.message); console.log("PASS=0 FAIL=1"); process.exit(1); });
