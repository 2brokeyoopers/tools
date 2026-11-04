// Opens the real page in Chromium at phone size and uses it like a shopper would.
// Run: node gift-finder/tests/test_page.js       Pass means the last line says FAIL=0.
// Run with --selftest to serve a deliberately broken copy of the page. Every check must then FAIL.
// Needs Playwright with Chromium (npm install playwright, then npx playwright install chromium).
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");

const dir = path.join(__dirname, "..");
const root = path.join(dir, "..");
const SLOGAN = "From 2 Broke Yoopers — affordable products built for fun, function, and honest value.";
const { GIFTS } = require("../gifts.js");
const urls = new Set(GIFTS.map((g) => g.url));

// Break every promise the page makes, for the selftest.
function breakPage(html) {
  return html.replace(SLOGAN, "Thanks for visiting.")
    .replace(/<p class="printables"[\s\S]*?<\/p>/, "")
    .replace(/navigator\.serviceWorker\.register\("sw\.js"\)/, "Promise.resolve()")
    .replace("Sorry, please pick", "Missing:")
    .replace("'<span class=\"tag near\">Close pick</span>'", "''")
    .replace(/\.choices label \{/, ".choices label { min-height: 1rem !important; height: 1.2rem; overflow: hidden;")
    .replace("</main>", '<div style="width:900px;height:4px"></div></main>')
    .replace('href="\' + esc(g.url) + \'"', 'href="https://www.zazzle.com/store/2brokeyoopers"')
    .replace(/a\.shop \{[^}]*\}/, "a.shop { font-size: .8rem; }")
    .replace("'<ol class=\"gifts\">' + found.picks.map", "'<ol class=\"gifts\">' + found.picks.slice(0, 1).map")
    .replace("found.nearby.map", "found.nearby.slice(0, 0).map")
    .replace('["10", "25", "50", "0"]', 'Object.keys(G.BUDGETS)');
}

function serve(broken) {
  return new Promise((resolve) => {
    const server = http.createServer((q, s) => {
      const name = decodeURIComponent(q.url.split("?")[0]).replace(/^\/gift-finder\//, "/") || "/";
      const file = path.join(dir, name === "/" ? "index.html" : name);
      if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { s.writeHead(404); return s.end(); }
      let body = fs.readFileSync(file);
      if (broken && file.endsWith("index.html")) body = breakPage(body.toString());
      s.writeHead(200, { "content-type": file.endsWith(".js") ? "text/javascript" : "text/html; charset=utf-8" });
      s.end(body);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

// Taps through the page's own controls. Done in the page itself, because on a broken (too wide)
// page a phone zooms out and a pretend finger can miss. The checks below judge the layout.
async function pick(page, who, budget, likes) {
  await page.evaluate(([who, budget, likes]) => {
    document.querySelector('input[name="who"][value="' + who + '"]').click();
    document.querySelector('input[name="budget"][value="' + budget + '"]').click();
    likes.forEach((l) => document.querySelector('input[name="likes"][value="' + l + '"]').click());
    document.querySelector("button.go").click();
  }, [who, budget, likes]);
  await page.waitForTimeout(300);
}

async function checks(broken) {
  const out = [];
  const ok = (name, cond, why) => out.push([name, !!cond, why || ""]);
  const server = await serve(broken);
  const base = "http://127.0.0.1:" + server.address().port + "/gift-finder/";
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 740 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: "load" });

  // Measured against the phone width itself: a phone zooms out on a too-wide page, so its own width would grow too.
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - 375);
  ok("phone width (375 px): nothing sticks out sideways", wide <= 0, "page is " + wide + " px too wide");
  const small = await page.$$eval(".choices label", (els) => els.filter((e) => e.getBoundingClientRect().height < 44).length);
  ok("phone: every answer is a big enough target for a thumb (44 px or taller)", small === 0, small + " too small");

  const budgets = await page.$$eval('input[name="budget"]', (els) => els.map((e) => e.value).join(","));
  ok("budgets read from small to large, with no limit last", budgets === "10,25,50,0", budgets);

  await page.evaluate(() => document.querySelector("button.go").click());
  const nudge = (await page.textContent("#nudge")) || "";
  ok("an empty answer gets a polite nudge with please and thank you", /please/i.test(nudge) && /thank you/i.test(nudge), nudge);

  await pick(page, "dad", "25", ["hunting", "fishing"]);
  const hrefs = await page.$$eval("#result a.shop", (as) => as.map((a) => a.getAttribute("href")));
  ok("answers give at least 3 gift ideas", hrefs.length >= 3, hrefs.length + " ideas");
  const strays = hrefs.filter((h) => !urls.has(h));
  ok("every gift button goes to a confirmed link from gifts.js", hrefs.length && strays.length === 0, strays.join(" "));
  ok("the results mention that we have printables", await page.isVisible("#printables-note"));
  const shopSmall = await page.$$eval("#result a.shop", (els) => els.filter((e) => e.getBoundingClientRect().height < 44).length);
  ok("phone: every gift button is big enough to tap (44 px or taller)", hrefs.length && shopSmall === 0, shopSmall + " too small");
  const wide2 = await page.evaluate(() => document.documentElement.scrollWidth - 375);
  ok("phone: the results do not stick out sideways either", wide2 <= 0, wide2 + " px too wide");

  // The hard case: a kid, under $10, kids stuff. Few true matches, so close picks must show and be labeled.
  await page.evaluate(() => document.querySelectorAll("#finder input").forEach((i) => { i.checked = false; }));
  await pick(page, "kid", "10", ["kids"]);
  const closeCount = (await page.$$("#result .tag.near")).length;
  const total = (await page.$$("#result a.shop")).length;
  ok("a hard answer still gives 3 ideas, with close picks labeled as such", total >= 3 && closeCount >= 1, total + " ideas, " + closeCount + " labeled close");

  const lines = (await page.evaluate(() => document.body.innerText)).split("\n").map((l) => l.trim()).filter(Boolean);
  ok("the last line of the page is the 2 Broke Yoopers line", lines[lines.length - 1] === SLOGAN, lines[lines.length - 1]);

  // Offline: wait for the saved copy, cut the internet, reload, and shop again.
  let offlineOk = false, why = "";
  try {
    await page.evaluate(() => Promise.race([navigator.serviceWorker.ready, new Promise((_, no) => setTimeout(() => no(new Error("no saved copy")), 5000))]));
    await page.reload({ waitUntil: "load" });
    await ctx.setOffline(true);
    await page.reload({ waitUntil: "load" });
    await pick(page, "kid", "0", ["kids"]);
    offlineOk = (await page.$$("#result a.shop")).length >= 3;
    if (!offlineOk) why = "no ideas showed offline";
  } catch (e) { why = String(e.message || e).split("\n")[0]; }
  ok("works with the internet off after the first visit", offlineOk, why);

  await browser.close();
  server.close();

  const start = fs.readFileSync(path.join(root, "index.html"), "utf8");
  ok("the start page has a card for the gift finder", /<a class="tool" href="gift-finder\/">/.test(broken ? start.replace(/gift-finder\//g, "nowhere/") : start));
  return out;
}

(async () => {
  const self = process.argv.includes("--selftest");
  let pass = 0, fail = 0;
  for (const [name, good, why] of await checks(self)) {
    if (self) { if (good) { fail++; console.log("FAIL selftest: did not catch a broken page: " + name); } else { pass++; console.log("PASS selftest caught: " + name + (why ? " (" + why + ")" : "")); } }
    else if (good) { pass++; console.log("PASS " + name); } else { fail++; console.log("FAIL " + name + (why ? " (" + why + ")" : "")); }
  }
  console.log("PASS=" + pass + " FAIL=" + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL the page check crashed: " + e.message); console.log("PASS=0 FAIL=1"); process.exit(1); });
