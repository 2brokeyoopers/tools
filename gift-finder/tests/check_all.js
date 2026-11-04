// Runs every check for the Yooper Gift Finder and writes gift-finder\CHECK RESULTS.txt.
// Pass means every line in CHECK RESULTS.txt says FAIL=0.
"use strict";
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const runs = [
  ["gift list and matching", "test_gifts.js", []],
  ["gift list selftest (shop front, dead link, empty result)", "test_gifts.js", ["--selftest"]],
  ["outside check of 2026-11-04 (front page link, moved links, kid results, close picks)", "test_audit.js", []],
  ["outside check selftest", "test_audit.js", ["--selftest"]],
  ["every link opened on the internet", "test_links_live.js", []],
  ["dead link selftest", "test_links_live.js", ["--selftest"]],
  ["page on a phone, online and offline", "test_page.js", []],
  ["page selftest", "test_page.js", ["--selftest"]],
];
const lines = ["Yooper Gift Finder checks, " + new Date().toISOString()];
let bad = 0;
for (const [name, file, args] of runs) {
  const r = spawnSync(process.execPath, [path.join(__dirname, file), ...args], { encoding: "utf8" });
  const out = (r.stdout || "").trim().split(/\r?\n/);
  const last = out.pop() || "no output";
  const good = r.status === 0 && /FAIL=0$/.test(last);
  if (!good) { bad++; process.stdout.write(r.stdout || ""); process.stdout.write(r.stderr || ""); }
  lines.push(name + ": " + (good ? last : last + " (FAIL=1)"));
  // Links a store would not show our robot get listed, so a person can open them by hand.
  const unreached = out.filter((l) => /^  https:\/\//.test(l));
  if (unreached.length) lines.push("  please open by hand once (a store turned our robot away): " + unreached.length + " links", ...unreached);
}
lines.push(bad ? "OVERALL FAIL=" + bad : "OVERALL FAIL=0");
fs.writeFileSync(path.join(__dirname, "..", "CHECK RESULTS.txt"), lines.join("\r\n") + "\r\n");
console.log(lines.join("\n"));
process.exit(bad ? 1 : 0);
