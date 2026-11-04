// Reads every source page on the internet and checks that each question's quote is really on it, word for word.
// Run: node yooper-trivia/tests/verify_sources_online.js            (needs the internet, takes a few minutes)
//      node yooper-trivia/tests/verify_sources_online.js --cache DIR  (keeps a copy of each page in DIR and reuses it)
// Pass means the last line says FAIL=0. Run with --selftest to prove a made-up quote is caught.
// This check is not in the double-click check because it needs the internet. Run it after changing any question.
"use strict";
const fs = require("fs");
const path = require("path");
const https = require("https");
const QUESTIONS = require("../questions.js");

const argCache = process.argv.indexOf("--cache");
const cacheDir = argCache > 0 ? process.argv[argCache + 1] : null;

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "2BY-yooper-trivia-factcheck/1.0 (2brokeyoopers@gmail.com)" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return resolve(get(new URL(res.headers.location, url).href)); }
      let body = ""; res.setEncoding("utf8"); res.on("data", (c) => (body += c));
      res.on("end", () => (res.statusCode === 200 ? resolve(body) : reject(new Error("HTTP " + res.statusCode + " for " + url))));
    }).on("error", reject);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function norm(s) {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/&nbsp;/g, " ").replace(/\s+/g, " ").toLowerCase();
}
async function page(src) {
  const title = decodeURIComponent(src.split("/wiki/")[1]);
  const file = cacheDir && path.join(cacheDir, title.replace(/[^A-Za-z0-9._-]/g, "_") + ".txt");
  if (file && fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  await sleep(4000);
  // The plain text of the page as a reader sees it, with redirects followed.
  const json = JSON.parse(await get("https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=" + encodeURIComponent(title)));
  const found = Object.values(json.query.pages)[0];
  if (!found || found.missing !== undefined || !found.extract) throw new Error("page not found: " + title);
  if (file) { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(file, found.extract); }
  return found.extract;
}

(async () => {
  let pass = 0, fail = 0;
  const pages = {};
  const list = process.argv.includes("--selftest")
    ? [{ q: "selftest", quote: ["The Mackinac Bridge is made of solid fudge and was opened by a moose."], src: "https://en.wikipedia.org/wiki/Mackinac_Bridge" }]
    : QUESTIONS;
  for (const item of list) {
    try {
      if (!(item.src in pages)) pages[item.src] = norm(await page(item.src));
      const missing = item.quote.filter((piece) => !pages[item.src].includes(norm(piece)));
      if (missing.length) { fail++; console.log("FAIL quote not found on " + item.src + " for: " + item.q + "\n     missing: " + missing.join(" | ")); }
      else { pass++; console.log("PASS " + item.q); }
    } catch (e) { fail++; console.log("FAIL could not read " + item.src + ": " + e.message); }
  }
  if (process.argv.includes("--selftest")) {
    // The made-up quote must be caught.
    const caught = fail === 1;
    console.log(caught ? "PASS selftest: a made-up quote was caught" : "FAIL selftest: a made-up quote got through");
    console.log("PASS=" + (caught ? 1 : 0) + " FAIL=" + (caught ? 0 : 1));
    process.exit(caught ? 0 : 1);
  }
  console.log("PASS=" + pass + " FAIL=" + fail);
  process.exit(fail ? 1 : 0);
})();
