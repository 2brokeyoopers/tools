// Outside check, 2026-11-04. Each rule below is a mistake found by opening every link and trying all 12,264 answers.
// Run: node gift-finder/tests/test_audit.js   Pass means the last line says FAIL=0.
// --selftest puts each mistake back on a copy and every rule must catch it.
"use strict";
const fs = require("fs");
const path = require("path");
const real = require("../gifts.js");
const CONFIRMED = fs.readFileSync(path.join(__dirname, "confirmed_links.txt"), "utf8");

// Gifts made for tired grown-ups. A kid should never be shown these.
const GROWN_UP_ONLY = ["meal-plan", "sleep-guide", "kitchen-reset", "onto-you-tumbler"];
// Zazzle moved these two products to new addresses. The old ones only work by redirect.
const MOVED = ["im_onto_you_pointing_finger_playfully_fun_insulated_tumbler", "happy_dog_smelling_morel_mushrooms_nature_love_trucker_hat"];

function everyAnswer(api, fn) {
  const likes = Object.keys(api.LIKES);
  for (const who of Object.keys(api.WHO)) for (const budget of [10, 25, 50, 0]) for (let m = 1; m < 1 << likes.length; m++) {
    const L = likes.filter((_, i) => (m >> i) & 1);
    fn({ who, budget, likes: L }, api.findGifts({ who, budget, likes: L }));
  }
}

function problems(api, confirmed) {
  const out = [];
  // 1. No button may open the store's front page.
  for (const g of api.GIFTS) if (/^https:\/\/(www\.)?2brokeyoopers\.com\/?$/.test(g.url)) out.push(g.id + " opens the 2brokeyoopers.com front page, not the product");
  // 2. No moved Zazzle address.
  for (const g of api.GIFTS) for (const m of MOVED) if (g.url.includes(m)) out.push(g.id + " uses an old Zazzle address that only works by redirect");
  for (const m of MOVED) if (confirmed.includes(m)) out.push("confirmed_links.txt still lists the old Zazzle address " + m);
  // 3. A shirt comes in many styles, so a single price we never saw on the store is a guess.
  for (const g of api.GIFTS) if (g.kind === "Shirt" && g.price !== null) out.push(g.id + " shows a single shirt price (" + g.priceText + ") that no store page confirmed");
  let kid = new Set(), filler = new Set(), hits = 0;
  everyAnswer(api, (a, r) => {
    const all = r.picks.concat(r.nearby);
    // 4. Silly result: grown-up printables or an insulated tumbler for a kid.
    if (a.who === "kid") for (const g of all) if (GROWN_UP_ONLY.includes(g.id)) kid.add(g.id);
    // 5. Silly result: a close pick that shares nothing with their likes should be a general Yooper gift
    //    (pride or a laugh), not a kitchen printable for someone who asked for fishing.
    for (const g of r.nearby) {
      if (!g.likes.some((l) => a.likes.includes(l)) && !g.likes.some((l) => l === "pride" || l === "humor")) { filler.add(g.id + " for " + a.likes.join("+")); hits++; }
    }
  });
  for (const id of kid) out.push(id + " is shown for a kid");
  if (hits) out.push(hits + " answers get an unrelated close pick, e.g. " + [...filler].slice(0, 3).join(", "));
  return out;
}

let pass = 0, fail = 0;
const RULES = 5;
if (process.argv.includes("--selftest")) {
  const withGifts = (change) => { const g = real.GIFTS.map((x) => ({ ...x })); change(g); return { ...real, GIFTS: g, findGifts: (a) => real.findGifts(a, g) }; };
  const cases = [
    ["front page link", /front page/, () => [withGifts((g) => (g[0].url = "https://2brokeyoopers.com/")), CONFIRMED]],
    ["moved Zazzle address", /old Zazzle address/, () => [withGifts((g) => (g[0].url = "https://www.zazzle.com/" + MOVED[0] + "-256785691398492249")), CONFIRMED]],
    ["guessed shirt price", /single shirt price/, () => [withGifts((g) => { const s = g.find((x) => x.kind === "Shirt"); s.price = 24; s.priceText = "From $24"; }), CONFIRMED]],
    ["grown-up printable for a kid", /shown for a kid/, () => [withGifts((g) => { const s = g.find((x) => x.id === "sleep-guide"); s.notFor = []; }), CONFIRMED]],
    // The old matcher padded short lists with the cheapest gift, whatever it was.
    ["unrelated close pick", /unrelated close pick/, () => [{ ...real, findGifts: (a) => { const r = real.findGifts(a); return { picks: r.picks, nearby: r.nearby.length ? [real.GIFTS.find((x) => x.id === "kitchen-reset")] : [] }; } }, CONFIRMED]],
  ];
  for (const [name, rule, make] of cases) {
    const found = problems(...make()).filter((p) => rule.test(p));
    if (found.length) { pass++; console.log("PASS selftest caught: " + name + " -> " + found[0]); }
    else { fail++; console.log("FAIL selftest: this broken copy got through: " + name); }
  }
} else {
  const found = problems(real, CONFIRMED);
  for (const p of found) { fail++; console.log("FAIL " + p); }
  pass = Math.max(0, RULES - fail);
}
console.log("PASS=" + pass + " FAIL=" + fail);
process.exit(fail ? 1 : 0);
