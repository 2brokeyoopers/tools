// Fails if the old KDP Quick Formatter price appears anywhere in this repo.
// The price dropped to $14.99 on Payhip on 2026-11-04 (Mike).
// Run: node cover-calculator/tests/test_prices.js   Pass means the last line says FAIL=0.
// Run with --selftest to prove it catches the old price.
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");
const OLD = "19" + ".99"; // built from parts so this file does not trip its own check
const NEW = "$14.99";
const OLD_RE = new RegExp("19\\s*\\.\\s*99");
const SKIP_DIRS = new Set([".git", "node_modules"]);
const TEXT = /\.(html?|js|py|txt|json|css|ya?ml|webmanifest|bat|svg)$/i;

function files(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(files(p));
    else if (TEXT.test(e.name)) out.push(p);
  }
  return out;
}

function scan(list) {
  const hits = [];
  for (const [name, text] of list) text.split(/\r?\n/).forEach((line, i) => { if (OLD_RE.test(line)) hits.push(name + " line " + (i + 1)); });
  return hits;
}

const all = files(root).map((p) => [path.relative(root, p), fs.readFileSync(p, "utf8")]);
let pass = 0, fail = 0;
const result = (good, msg) => { if (good) { pass++; console.log("PASS " + msg); } else { fail++; console.log("FAIL " + msg); } };

if (process.argv.includes("--selftest")) {
  result(scan([["broken page", "<p>Only $" + OLD + " today</p>"]]).length === 1, "selftest caught the old price on a broken page");
  result(scan([["broken page", "price: " + OLD.replace(".", " . ")]]).length === 1, "selftest caught the old price written with spaces");
  result(scan([["good page", "<p>Only " + NEW + "</p>"]]).length === 0, "selftest left the new price alone");
  result(all.length >= 10, "selftest found " + all.length + " files to read, so the scan is not empty");
} else {
  if (all.length < 10) result(false, "only " + all.length + " files found to read, so the scan proves nothing");
  const hits = scan(all);
  result(hits.length === 0, hits.length ? "the old price is still in: " + hits.join(", ") : "the old price appears nowhere in " + all.length + " files");
  const page = all.find(([n]) => n.replace(/\\/g, "/") === "cover-calculator/index.html");
  result(page && page[1].includes(NEW), "the cover calculator shows the formatter at " + NEW);
  const kdp = all.find(([n]) => n.replace(/\\/g, "/") === "kdp-check/index.html");
  result(kdp && kdp[1].includes(NEW), "the KDP check shows the formatter at " + NEW);
}
console.log("PASS=" + pass + " FAIL=" + fail);
process.exit(fail ? 1 : 0);
