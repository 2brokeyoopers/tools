// Checks the cover math against answers from Amazon's own KDP cover calculator.
// Run:  node cover-calculator/tests/test_cover_math.js
// Pass means the last line says FAIL=0.
//
// It also proves every test can fail: each example is run a second time
// against a deliberately broken copy of the math, and that run MUST fail.
// If a broken copy still passes, the test is too weak and this file fails.
"use strict";
const path = require("path");
const fs = require("fs");

const examples = JSON.parse(fs.readFileSync(path.join(__dirname, "amazon_examples.json"), "utf8")).examples;
let math;
try {
  math = require(path.join(__dirname, "..", "cover-math.js"));
} catch (e) {
  console.log("FAIL could not load cover-math.js: " + e.message);
  console.log("PASS=0 FAIL=" + examples.length);
  process.exit(1);
}

// Amazon shows three decimals. On exact half-thousandths (like 0.8325) its own
// tool rounds sometimes up and sometimes down, so we allow one thousandth.
const TOL = 0.0011;
const close = (a, b) => Math.abs(a - b) <= TOL;

// What one example must match. Each line names the Amazon field it checks.
function check(m, ex) {
  const r = m.coverSize({ trim: ex.trim, paper: ex.paper, pages: ex.pages, bleed: true });
  const problems = [];
  const want = (label, got, expected) => { if (!close(got, expected)) problems.push(label + " got " + got + " but Amazon says " + expected); };
  want("full cover width", r.fullWidth, ex.full_cover[0]);
  want("full cover height", r.fullHeight, ex.full_cover[1]);
  want("front cover width", r.trimWidth, ex.front_cover[0]);
  want("front cover height", r.trimHeight, ex.front_cover[1]);
  want("spine width", r.spineWidth, ex.spine[0]);
  want("spine height", r.trimHeight, ex.spine[1]);
  want("spine safe width", r.spineSafeWidth, ex.spine_safe_area[0]);
  want("spine safe height", r.spineSafeHeight, ex.spine_safe_area[1]);
  want("safe area height", r.safeHeight, ex.safe_area[1]);
  want("bleed", r.bleed, ex.bleed[0]);
  want("barcode margin", r.barcodeMargin, ex.barcode_margin[0]);
  // Pixels at 300 DPI are the inches times 300, rounded up to a whole pixel.
  const pw = Math.ceil(ex.full_cover[0] * 300 - 1e-9), ph = Math.ceil(ex.full_cover[1] * 300 - 1e-9);
  if (Math.abs(r.pixelWidth - pw) > 1) problems.push("pixel width got " + r.pixelWidth + " but expected " + pw);
  if (Math.abs(r.pixelHeight - ph) > 1) problems.push("pixel height got " + r.pixelHeight + " but expected " + ph);
  // KDP prints spine text only on books with more than 79 pages.
  if (r.spineTextAllowed !== (ex.pages > 79)) problems.push("spine text answer is wrong for " + ex.pages + " pages");
  return problems;
}

// Deliberately broken copies of the math. Each example must fail on at least one.
const breakers = {
  "no bleed added": (m) => ({ coverSize: (o) => m.coverSize(Object.assign({}, o, { bleed: false })) }),
  "every paper uses the white rate": (m) => ({ coverSize: (o) => m.coverSize(Object.assign({}, o, { paper: "white" })) }),
  "one page too many": (m) => ({ coverSize: (o) => m.coverSize(Object.assign({}, o, { pages: o.pages + 1 })) }),
};

let pass = 0, fail = 0;
for (const ex of examples) {
  const name = ex.trim + " in, " + ex.pages + " pages, " + ex.paper + " paper";
  const problems = check(math, ex);
  if (problems.length) { fail++; console.log("FAIL " + name + ": " + problems.join("; ")); }
  else { pass++; console.log("PASS " + name); }
  // Proof the test can fail: at least one broken copy must be caught.
  const caught = Object.entries(breakers).filter(([, mk]) => check(mk(math), ex).length > 0).map(([k]) => k);
  if (problems.length === 0 && caught.length === 0) { fail++; console.log("FAIL " + name + ": no broken copy was caught, so this test proves nothing"); }
}
// Cream, white and color papers must each be caught by the wrong-rate breaker somewhere.
const papersCaught = new Set(examples.filter((ex) => check(breakers["every paper uses the white rate"](math), ex).length).map((ex) => ex.paper));
for (const p of ["cream", "premium"]) if (!papersCaught.has(p)) { fail++; console.log("FAIL the wrong paper rate is never caught for " + p + " paper"); }

// Page limits and custom sizes from the KDP help pages. Each case says whether a warning is due.
const limitCases = [
  [{ trim: "6 x 9", paper: "white", pages: 23 }, true, "23 pages is under the 24 page minimum"],
  [{ trim: "6 x 9", paper: "white", pages: 828 }, false, "828 white pages is the 6 x 9 maximum"],
  [{ trim: "6 x 9", paper: "cream", pages: 777 }, true, "777 cream pages is over the 776 maximum"],
  [{ trim: "7 x 10", paper: "standard", pages: 71 }, true, "standard color starts at 72 pages"],
  [{ trim: "8.27 x 11.69", paper: "standard", pages: 100 }, true, "standard color is not offered at 8.27 x 11.69"],
  [{ trim: "8.5 x 11", paper: "premium", pages: 591 }, true, "8.5 x 11 premium stops at 590 pages"],
  [{ trim: { w: 4, h: 6 }, paper: "white", pages: 100 }, false, "a 4 x 6 custom size is allowed"],
  [{ trim: { w: 3.9, h: 6 }, paper: "white", pages: 100 }, true, "a custom size under 4 inches wide is refused"],
];
for (const [opts, warn, why] of limitCases) {
  const got = math.coverSize(opts).problems.length > 0;
  if (got === warn) { pass++; console.log("PASS " + why); } else { fail++; console.log("FAIL " + why + ": the page " + (got ? "warned" : "did not warn")); }
}
// Spine text: 79 pages no, 80 pages yes.
for (const [n, want] of [[79, false], [80, true]]) {
  const got = math.coverSize({ trim: "6 x 9", paper: "white", pages: n }).spineTextAllowed;
  if (got === want) { pass++; console.log("PASS spine text at " + n + " pages is " + (want ? "allowed" : "not allowed")); } else { fail++; console.log("FAIL spine text at " + n + " pages"); }
}
// No bleed: the full cover is just back + spine + front, and the trim height.
{ const r = math.coverSize({ trim: "6 x 9", paper: "white", pages: 300, bleed: false });
  if (close(r.fullWidth, 12.676) && close(r.fullHeight, 9)) { pass++; console.log("PASS without bleed, 6 x 9 at 300 pages is 12.676 x 9"); } else { fail++; console.log("FAIL without bleed got " + r.fullWidth + " x " + r.fullHeight); } }

if (examples.length < 10) { fail++; console.log("FAIL only " + examples.length + " Amazon examples, need at least 10"); }
console.log("PASS=" + pass + " FAIL=" + fail);
process.exit(fail ? 1 : 0);
