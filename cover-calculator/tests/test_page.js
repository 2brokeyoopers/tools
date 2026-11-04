// Checks the promises the page makes. Run: node cover-calculator/tests/test_page.js
// Pass means the last line says FAIL=0. Run with --selftest to prove each check can fail.
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");
const SLOGAN = "From 2 Broke Yoopers — affordable products built for fun, function, and honest value.";
const PAYHIP = "https://payhip.com/b/16Nra";

const strip = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);

function checks(page, start) {
  const lines = strip(page);
  const out = [];
  const ok = (name, cond) => out.push([name, !!cond]);
  ok("the last line of the page is the 2 Broke Yoopers line", lines[lines.length - 1] === SLOGAN);
  ok("the page links to KDP Quick Formatter on Payhip", page.includes('href="' + PAYHIP + '"'));
  ok("the page cites the KDP help page Create a Paperback Cover", page.includes("kdp.amazon.com/en_US/help/topic/G201953020"));
  ok("the page cites the trim size table on Paperback Submission Guidelines", page.includes("kdp.amazon.com/en_US/help/topic/G201857950"));
  ok("the page states all four spine rates", ["0.002252", "0.0025\"", "0.002347"].every((r) => page.includes(r)));
  ok("the page states the 79 page spine text rule", page.includes("more than 79 pages"));
  ok("the page offers a template download", page.includes('id="dl"'));
  ok("the start page links to the calculator", /href="cover-calculator\/"/.test(start));
  ok("no long words a twelve-year-old would trip on", !/\b(utilize|leverage|optimi[sz]e|workflow|pipeline|metadata|parameters?)\b/i.test(lines.join(" ")));
  return out;
}

const page = fs.readFileSync(path.join(root, "cover-calculator", "index.html"), "utf8");
const start = fs.readFileSync(path.join(root, "index.html"), "utf8");
let pass = 0, fail = 0;

if (process.argv.includes("--selftest")) {
  // Break each promise on purpose. Every check must turn to FAIL.
  const broken = checks(page.replace(SLOGAN, "Thanks for visiting.").replace(PAYHIP, "https://example.com").replace(/G201953020/g, "X").replace(/G201857950/g, "X")
    .replace(/0\.002252|0\.002347/g, "0.1").replace(/more than 79 pages/g, "lots of pages").replace('id="dl"', 'id="x"') + "<p>We leverage metadata.</p>",
    start.replace(/cover-calculator\//g, "nowhere/"));
  for (const [name, good] of broken) {
    if (good) { fail++; console.log("FAIL selftest: this check did not catch a broken page: " + name); } else { pass++; console.log("PASS selftest caught: " + name); }
  }
} else {
  for (const [name, good] of checks(page, start)) { if (good) { pass++; console.log("PASS " + name); } else { fail++; console.log("FAIL " + name); } }
}
console.log("PASS=" + pass + " FAIL=" + fail);
process.exit(fail ? 1 : 0);
