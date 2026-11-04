// Checks every trivia question. Run: node yooper-trivia/tests/test_questions.js
// Pass means the last line says FAIL=0. Run with --selftest to prove each rule catches a broken question.
"use strict";
const fs = require("fs");
const path = require("path");
const QUESTIONS = require("../questions.js");
const readmeFile = path.join(__dirname, "..", "README.txt");
const README = fs.existsSync(readmeFile) ? fs.readFileSync(readmeFile, "utf8") : "";
const MIN_QUESTIONS = 60;

const low = (s) => String(s).toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// True when the words appear as whole words (so "4 feet" is not found inside "48 feet").
const has = (text, words) => new RegExp("(^|[^a-z0-9])" + esc(low(words)) + "($|[^a-z0-9])").test(low(text));
const sourcesListed = () => {
  const part = README.split(/^SOURCES\b.*$/m)[1] || "";
  // Each source is one line that starts with "- https://".
  return new Set([...part.matchAll(/^- (https:\/\/\S+)/gm)].map((m) => m[1]));
};
const sameQuestion = (s) => low(s).replace(/[^a-z0-9 ]/g, "");

// Returns a list of problems, one line each. An empty list means every question is good.
function problems(list, readme) {
  const out = [];
  const listed = readme;
  if (!listed.size) out.push("README.txt has no SOURCES list");
  if (!Array.isArray(list) || list.length < MIN_QUESTIONS) out.push("there must be at least " + MIN_QUESTIONS + " questions, found " + (list ? list.length : 0));
  const seen = new Map();
  (list || []).forEach((item, i) => {
    const name = "question " + (i + 1) + " (" + String(item.q).slice(0, 50) + ")";
    if (!item.q || !String(item.q).trim().endsWith("?")) out.push(name + ": the question must end with a question mark");
    const key = sameQuestion(item.q);
    if (seen.has(key)) out.push(name + ": duplicate of question " + seen.get(key));
    else seen.set(key, i + 1);
    const choices = Array.isArray(item.choices) ? item.choices : [];
    if (choices.length !== 4) out.push(name + ": needs exactly 4 answers, has " + choices.length);
    if (new Set(choices.map(low)).size !== choices.length) out.push(name + ": two answers are the same");
    if (choices.filter((c) => c === item.answer).length !== 1) out.push(name + ": the right answer is not exactly one of the four answers");
    const quote = Array.isArray(item.quote) ? item.quote.filter((p) => String(p).trim()) : [];
    if (!quote.length) out.push(name + ": missing the quote that proves the answer");
    const whole = quote.join(" ... ");
    const keys = [].concat(item.key || item.answer || []);
    for (const k of keys) {
      if (!has(item.answer || "", k)) out.push(name + ": the answer \"" + item.answer + "\" does not contain the proof words \"" + k + "\"");
      if (quote.length && !has(whole, k)) out.push(name + ": the quote does not prove the answer (\"" + k + "\" is not in it)");
    }
    for (const c of choices) {
      if (c !== item.answer && quote.length && has(whole, c)) out.push(name + ": the wrong answer \"" + c + "\" appears in the quote, so the answer key may be wrong");
    }
    if (!item.src || !/^https:\/\/\S+$/.test(item.src)) out.push(name + ": missing a source link");
    else if (!listed.has(item.src)) out.push(name + ": source " + item.src + " is not listed under SOURCES in README.txt");
  });
  return out;
}

let pass = 0, fail = 0;
if (process.argv.includes("--selftest")) {
  // Break the questions on purpose. Each broken copy must be caught.
  const copy = () => JSON.parse(JSON.stringify(QUESTIONS));
  const cases = [
    ["wrong answer key", /answer key may be wrong|does not contain the proof words|quote does not prove/, () => { const c = copy(); c[0].answer = c[0].choices.find((x) => x !== c[0].answer); return [c, sourcesListed()]; }],
    ["right answer missing from the four answers", /not exactly one of the four/, () => { const c = copy(); c[1].answer = "Paul Bunyan"; return [c, sourcesListed()]; }],
    ["duplicate question", /duplicate of question/, () => { const c = copy(); c.push(Object.assign({}, c[5], { q: c[5].q.toUpperCase() })); return [c, sourcesListed()]; }],
    ["missing source link", /missing a source link/, () => { const c = copy(); delete c[2].src; return [c, sourcesListed()]; }],
    ["source not listed in README.txt", /is not listed under SOURCES/, () => { const s = sourcesListed(); s.delete(QUESTIONS[3].src); return [copy(), s]; }],
    ["missing quote", /missing the quote/, () => { const c = copy(); c[4].quote = []; return [c, sourcesListed()]; }],
    ["quote that does not prove the answer", /quote does not prove/, () => { const c = copy(); c[6].quote = ["Lake Superior is big and cold."]; return [c, sourcesListed()]; }],
    ["only three answers", /exactly 4 answers/, () => { const c = copy(); c[7].choices = c[7].choices.filter((x) => x !== c[7].answer).slice(0, 2).concat(c[7].answer); return [c, sourcesListed()]; }],
    ["too few questions", /at least 60 questions/, () => [copy().slice(0, MIN_QUESTIONS - 1), sourcesListed()]],
  ];
  // A case counts only when the exact rule for that break fires, not some other complaint.
  for (const [name, rule, make] of cases) {
    const [list, listed] = make();
    const found = problems(list, listed).filter((p) => rule.test(p));
    if (found.length) { pass++; console.log("PASS selftest caught: " + name + " -> " + found[0]); }
    else { fail++; console.log("FAIL selftest: this broken copy got through: " + name); }
  }
} else {
  const found = problems(QUESTIONS, sourcesListed());
  for (const p of found) { fail++; console.log("FAIL " + p); }
  const badOnes = new Set(found.map((p) => p.split(":")[0]).filter((p) => p.startsWith("question ")));
  pass = QUESTIONS.length - badOnes.size;
  console.log(QUESTIONS.length + " questions, " + sourcesListed().size + " sources listed in README.txt");
}
console.log("PASS=" + pass + " FAIL=" + fail);
process.exit(fail ? 1 : 0);
