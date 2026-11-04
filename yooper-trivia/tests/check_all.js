// Runs every check for Yooper Trivia and writes CHECK RESULTS.txt in the yooper-trivia folder.
// Pass means every line in CHECK RESULTS.txt says FAIL=0.
"use strict";
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const runs = [
  ["questions: answer key, duplicates, sources", "test_questions.js", []],
  ["questions selftest", "test_questions.js", ["--selftest"]],
  ["page promises", "test_page.js", []],
  ["page promises selftest", "test_page.js", ["--selftest"]],
  ["playing a round at phone size, and offline", "test_play.js", []],
  ["playing a round selftest", "test_play.js", ["--selftest"]],
];
const lines = ["Yooper Trivia checks, " + new Date().toISOString()];
let bad = 0;
for (const [name, file, args] of runs) {
  const r = spawnSync(process.execPath, [path.join(__dirname, file), ...args], { encoding: "utf8" });
  const last = (r.stdout || "").trim().split(/\r?\n/).pop() || "no output";
  const good = r.status === 0 && /FAIL=0$/.test(last);
  if (!good) { bad++; process.stdout.write(r.stdout || ""); process.stdout.write(r.stderr || ""); }
  lines.push(name + ": " + (good ? last : last + " (FAIL=1)"));
}
lines.push(bad ? "OVERALL FAIL=" + bad : "OVERALL FAIL=0");
fs.writeFileSync(path.join(__dirname, "..", "CHECK RESULTS.txt"), lines.join("\r\n") + "\r\n");
console.log(lines.join("\n"));
process.exit(bad ? 1 : 0);
