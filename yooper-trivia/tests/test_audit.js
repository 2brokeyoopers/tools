// Outside check, 2026-11-04. Each rule below is a mistake found by reading every source page in full.
// Run: node yooper-trivia/tests/test_audit.js   Pass means the last line says FAIL=0.
// --selftest puts each mistake back on a copy and every rule must catch it.
"use strict";
const fs = require("fs");
const path = require("path");
const QUESTIONS = require("../questions.js");
const PAGE = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const SW = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
const low = (s) => String(s).toLowerCase();
const find = (list, words) => list.filter((x) => new RegExp("\\b" + words, "i").test(x.q));

function problems(list, page, sw) {
  const out = [];
  // 1. Every number in a question must be in its quote, or the player sees a fact nobody checked.
  for (const x of list) {
    const quote = x.quote.join(" ");
    for (const n of String(x.q).match(/\d[\d,.]*\d|\d/g) || []) {
      if (!quote.includes(n)) out.push("number " + n + " in \"" + x.q.slice(0, 60) + "\" is not in its quote");
    }
  }
  // 2. Soo Locks page: "The first lock to be built in the St. Marys River was on the Canadian side in 1798".
  //    So 1798 is also a right answer to "the first Soo Locks" unless the question says U.S.
  for (const x of find(list, "first (u\\.s\\. )?soo locks")) {
    if (x.choices.includes("1798")) out.push("Soo Locks year question offers 1798, which the source also calls the first lock");
    if (!/U\.S\.|American/.test(x.q)) out.push("Soo Locks year question does not say U.S., so 1798 (Canadian lock) is also right");
  }
  // 3. Pine Mountain page: "Excluding ski flying hills, ... the largest ski jump in the United States".
  //    Copper Peak near Ironwood is bigger, so the question must keep the "not counting ski flying" part.
  for (const x of find(list, "pine mountain")) {
    if (!/ski flying/i.test(x.q)) out.push("Pine Mountain question drops the source's \"excluding ski flying hills\"");
    if (!x.quote.some((q) => q.includes("Excluding ski flying hills"))) out.push("Pine Mountain quote leaves out \"Excluding ski flying hills\"");
  }
  // 4. "Almost half the Finnish immigrants to the U.S. settled in the Upper Peninsula" has no citation, and
  //    Wikipedia's own Finnish Americans page counts more Finnish Americans in Minnesota than in all of Michigan.
  for (const x of list) if (x.quote.some((q) => /almost half the finnish/i.test(q))) out.push("uses the uncited \"almost half the Finnish immigrants\" claim");
  // 5. An answer that starts with "About" must not be a three-decimal number ("About 4.995 miles").
  for (const x of list) for (const c of x.choices) if (/\d\.\d{3}/.test(c) && (/^about\b/i.test(c) || /^about\b/i.test(x.q))) out.push("answer \"" + c + "\" is a three-decimal number for an About question");
  // 6. The wrong-answer line must not read "The answer is About 48 feet." (capital letter mid-sentence).
  if (/The answer is " \+ item\.answer/.test(page)) out.push("wrong-answer line puts the answer mid-sentence, e.g. \"The answer is About 48 feet.\"");
  // 7. Weak signal at camp: the offline copy must win after a few seconds, not wait for the network forever.
  if (!/setTimeout/.test(sw) || !/Promise\.race/.test(sw)) out.push("sw.js has no time limit, so a weak signal leaves the page blank");
  return out;
}

let pass = 0, fail = 0;
const RULES = 7;
if (process.argv.includes("--selftest")) {
  const copy = () => JSON.parse(JSON.stringify(QUESTIONS));
  const cases = [
    ["number not in quote", /not in its quote/, () => { const c = copy(); c.push({ q: "Is the statue 52 feet tall?", choices: ["a", "b", "c", "d"], answer: "a", quote: ["a statue"], src: "x" }); return [c, PAGE, SW]; }],
    ["Soo Locks 1798", /1798/, () => { const c = copy(); c.push({ q: "In what year did the first Soo Locks open?", choices: ["1855", "1798", "1901", "1932"], answer: "1855", quote: ["The first locks were opened in 1855."], src: "x" }); return [c, PAGE, SW]; }],
    ["Pine Mountain without ski flying", /Pine Mountain/, () => { const c = copy(); c.push({ q: "Pine Mountain, the largest ski jump in the United States, is where?", choices: ["a", "b", "c", "d"], answer: "a", quote: ["the largest ski jump"], src: "x" }); return [c, PAGE, SW]; }],
    ["Finnish almost half", /almost half/, () => { const c = copy(); c.push({ q: "Finns?", choices: ["a", "b", "c", "d"], answer: "a", quote: ["Almost half the Finnish immigrants to the U.S. settled in the Upper Peninsula"], src: "x" }); return [c, PAGE, SW]; }],
    ["About 4.995 miles", /three-decimal/, () => { const c = copy(); c.push({ q: "About how long?", choices: ["4.995 miles", "b", "c", "d"], answer: "b", quote: ["b"], src: "x" }); return [c, PAGE, SW]; }],
    ["answer mid-sentence", /mid-sentence/, () => [copy(), PAGE + '\n"The answer is " + item.answer', SW]],
    ["no time limit", /time limit/, () => [copy(), PAGE, "self.addEventListener('fetch', e => e.respondWith(fetch(e.request)));"]],
  ];
  for (const [name, rule, make] of cases) {
    const found = problems(...make()).filter((p) => rule.test(p));
    if (found.length) { pass++; console.log("PASS selftest caught: " + name + " -> " + found[0]); }
    else { fail++; console.log("FAIL selftest: this broken copy got through: " + name); }
  }
} else {
  const found = problems(QUESTIONS, PAGE, SW);
  for (const p of found) { fail++; console.log("FAIL " + p); }
  pass = Math.max(0, RULES - fail);
}
console.log("PASS=" + pass + " FAIL=" + fail);
process.exit(fail ? 1 : 0);
