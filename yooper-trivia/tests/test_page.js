// Checks the promises the quiz page makes. Run: node yooper-trivia/tests/test_page.js
// Pass means the last line says FAIL=0. Run with --selftest to prove each check can fail.
"use strict";
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..");
const root = path.join(dir, "..");
const SLOGAN = "From 2 Broke Yoopers — affordable products built for fun, function, and honest value.";
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");
const strip = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);

function checks(f) {
  const lines = strip(f.page);
  const out = [];
  const ok = (name, cond) => out.push([name, !!cond]);
  ok("the last line of the page is the 2 Broke Yoopers line", lines[lines.length - 1] === SLOGAN);
  ok("the end screen links to the store at https://2brokeyoopers.com", /<section id="end"[\s\S]*href="https:\/\/2brokeyoopers\.com"/.test(f.page));
  ok("the end screen links to the Yooper Dictionary", /<section id="end"[\s\S]*href="\.\.\/yooper-dictionary\/"/.test(f.page));
  ok("the end screen has a share-your-score button", /<section id="end"[\s\S]*id="share"[^>]*>Share your score</.test(f.page));
  ok("a round is 10 questions", /var ROUND = 10;/.test(f.page));
  ok("the page loads the questions file", f.page.includes('<script src="questions.js"></script>'));
  ok("the page fits a phone screen", f.page.includes('name="viewport" content="width=device-width'));
  ok("the page registers the offline helper", f.page.includes('register("sw.js")'));
  ok("the offline helper saves the page, the questions and the icons", ["'index.html'", "'questions.js'", "'manifest.webmanifest'", "icon-192.png"].every((a) => f.sw.includes(a)));
  ok("the phone install file names the quiz", /"name": "Yooper Trivia"/.test(f.manifest));
  ok("the start page has a card for Yooper Trivia", /<a class="tool" href="yooper-trivia\/"><strong>[^<]*Trivia/.test(f.start));
  ok("the page writes U.P., never UP, for the peninsula", !/\bUP\b/.test(lines.join(" ")));
  ok("the page says thank you and please", /thank you/i.test(f.page) && /please/i.test(f.page));
  ok("no .md files in the trivia folder", !f.files.some((n) => /\.md$/i.test(n)));
  ok("no long words a twelve-year-old would trip on", !/\b(utilize|leverage|optimi[sz]e|workflow|pipeline|metadata|parameters?)\b/i.test(lines.join(" ")));
  return out;
}

const real = {
  page: read(path.join(dir, "index.html")),
  sw: read(path.join(dir, "sw.js")),
  manifest: read(path.join(dir, "manifest.webmanifest")),
  start: read(path.join(root, "index.html")),
  files: fs.readdirSync(dir).concat(fs.readdirSync(path.join(dir, "tests"))),
};
let pass = 0, fail = 0;
if (process.argv.includes("--selftest")) {
  // Break every promise on purpose. Every check must turn to FAIL.
  const broken = {
    page: real.page.replace(SLOGAN, "Thanks for visiting.").replace(/https:\/\/2brokeyoopers\.com/g, "https://example.com").replace(/\.\.\/yooper-dictionary\//g, "../nowhere/")
      .replace(">Share your score<", ">Tell a friend<").replace("var ROUND = 10;", "var ROUND = 9;").replace('<script src="questions.js"></script>', "")
      .replace("width=device-width", "width=1200").replace('register("sw.js")', 'register("nothing.js")').replace(/thank you/gi, "ok").replace(/please/gi, "now")
      + "<p>Welcome to the UP. We leverage metadata.</p>",
    sw: real.sw.replace("'questions.js'", "'other.js'"),
    manifest: real.manifest.replace('"name": "Yooper Trivia"', '"name": "Quiz"'),
    start: real.start.replace(/yooper-trivia\//g, "nowhere/"),
    files: real.files.concat("NOTES.md"),
  };
  for (const [name, good] of checks(broken)) {
    if (good) { fail++; console.log("FAIL selftest: this check did not catch a broken page: " + name); } else { pass++; console.log("PASS selftest caught: " + name); }
  }
} else {
  for (const [name, good] of checks(real)) { if (good) { pass++; console.log("PASS " + name); } else { fail++; console.log("FAIL " + name); } }
}
console.log("PASS=" + pass + " FAIL=" + fail);
process.exit(fail ? 1 : 0);
