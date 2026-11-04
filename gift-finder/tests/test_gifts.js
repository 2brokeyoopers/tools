// Checks the gift list and the matching. Needs no internet.
// Run: node gift-finder/tests/test_gifts.js        Pass means the last line says FAIL=0.
// Run with --selftest to feed it broken gift lists. Every check must then FAIL.
"use strict";
const fs = require("fs");
const path = require("path");
const real = require("../gifts.js");

// A product's own page on each store. Anything else (a shop front, a search, a profile) is refused.
const PRODUCT_PAGE = [
  /^https:\/\/payhip\.com\/b\/[A-Za-z0-9]{5}$/,
  /^https:\/\/www\.amazon\.com\/dp\/[A-Z0-9]{10}$/,
  /^https:\/\/www\.etsy\.com\/listing\/\d{6,}(\/[a-z0-9-]+)?$/,
  /^https:\/\/www\.teepublic\.com\/(t-shirt|hoodie|kids-t-shirt|crewneck-sweatshirt|long-sleeve-t-shirt|tank-top|mug|sticker)\/\d{6,}(-[a-z0-9-]+)?$/,
  /^https:\/\/www\.redbubble\.com\/i\/[a-z-]+\/[A-Za-z0-9-]+\/\d{6,}\/[a-z0-9]{4}$/,
  /^https:\/\/www\.zazzle\.com\/[a-z0-9_]+-\d{18}$/,
];
// Our own site: the home page, or one of its sections that was seen on the live site.
const SITE = /^https:\/\/2brokeyoopers\.com\/(#[a-z-]+)?$/;
const SITE_SECTIONS = ["", "#merch", "#books", "#shop", "#yooper-calendar", "#deer-camp-calendar", "#deer-camp-logbook", "#word-search"];

function isProductLink(url) {
  if (SITE.test(url)) return SITE_SECTIONS.includes(url.replace("https://2brokeyoopers.com/", ""));
  return PRODUCT_PAGE.some((r) => r.test(url));
}

function readConfirmed() {
  const file = path.join(__dirname, "confirmed_links.txt");
  return new Set(fs.readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l.startsWith("https://")).map((l) => l.split(" | ")[0].trim()));
}

// Every way a person can answer: 6 people x 4 budgets x 255 mixes of likes.
function everyAnswer(api) {
  const keys = Object.keys(api.LIKES);
  const out = [];
  for (const who of Object.keys(api.WHO)) for (const budget of Object.keys(api.BUDGETS).map(Number))
    for (let mask = 1; mask < 1 << keys.length; mask++) out.push({ who, budget, likes: keys.filter((_, i) => mask & (1 << i)) });
  return out;
}

function checks(list, confirmed, api) {
  const out = [];
  const ok = (name, bad) => out.push([name, bad.length === 0, bad.slice(0, 5)]);
  const find = (a) => api.findGifts(a, list);

  ok("the gift list is not empty", list.length ? [] : ["no gifts at all"]);
  ok("every link goes to one product's own page or to 2brokeyoopers.com, never a shop front",
    list.filter((g) => !isProductLink(g.url)).map((g) => g.id + ": " + g.url));
  ok("every link was opened and confirmed (on tests/confirmed_links.txt), so no dead or unchecked link",
    list.filter((g) => !confirmed.has(g.url)).map((g) => g.id + ": " + g.url));
  ok("every gift has a name, a kind, a price line, a short note and at least one like",
    list.filter((g) => !(g.name && g.kind && g.priceText && g.blurb && g.likes.length && g.store)).map((g) => g.id));
  ok("every like is a real choice on the page",
    list.filter((g) => g.likes.some((l) => !(l in api.LIKES))).map((g) => g.id));
  ok("every price line agrees with the price used for the budget",
    list.filter((g) => {
      if (g.price === null) return /\$\d/.test(g.priceText) && !/^From \$/.test(g.priceText) ? true : false;
      if (g.price === 0) return !/free/i.test(g.priceText);
      const m = g.priceText.match(/\$(\d+(?:\.\d\d)?)/);
      return !m || Number(m[1]) !== g.price;
    }).map((g) => g.id + ": " + g.priceText));
  ok("printables, books, shirts, mugs and stickers are all on offer",
    ["Printable", "Book", "Shirt", "Mug", "Sticker"].filter((k) => !list.some((g) => g.kind === k)));

  const answers = everyAnswer(api);
  const empty = [], overBudget = [], offTopic = [], noTopPick = [], wrongPerson = [], tooMany = [], strayClose = [];
  for (const a of answers) {
    const r = find(a);
    const all = r.picks.concat(r.nearby);
    if (all.length < api.MIN_RESULTS) empty.push(JSON.stringify(a) + " gave " + all.length);
    if (all.length > api.MAX_RESULTS) tooMany.push(JSON.stringify(a) + " gave " + all.length);
    for (const g of all) if ((g.notFor || []).includes(a.who)) wrongPerson.push(g.id + " shown to " + a.who);
    // A close pick that matches nothing they like is fine only when no unshown gift matches a like.
    const shown = new Set(all.map((g) => g.id));
    const likedLeft = list.some((g) => !shown.has(g.id) && !(g.notFor || []).includes(a.who) && g.likes.some((l) => a.likes.includes(l)));
    for (const g of r.nearby) if (likedLeft && !g.likes.some((l) => a.likes.includes(l))) strayClose.push(g.id + " for " + JSON.stringify(a));
    for (const g of r.picks) {
      if (!api.fitsBudget(g, a.budget)) overBudget.push(g.id + " for " + JSON.stringify(a));
      if (!g.likes.some((l) => a.likes.includes(l))) offTopic.push(g.id + " for " + JSON.stringify(a));
    }
  }
  ok("no answer ever gives an empty page (all " + answers.length + " ways to answer give at least " + api.MIN_RESULTS + " ideas)", empty);
  ok("never more than " + api.MAX_RESULTS + " ideas at once", tooMany);
  ok("a gift is never shown to someone it is not for (no true crime for a kid)", wrongPerson);
  ok("close picks share something they like whenever such a gift exists", strayClose);
  ok("a gift shown as a match always fits the budget", overBudget);
  ok("a gift shown as a match always fits something they like", offTopic);
  for (const like of Object.keys(api.LIKES)) {
    const r = find({ who: "friend", budget: 0, likes: [like] });
    if (!r.picks.length) noTopPick.push(like);
  }
  ok("every like has at least one real match when the budget is open", noTopPick);
  const cheapPicks = Object.keys(api.LIKES).filter((like) => !find({ who: "friend", budget: 25, likes: [like] }).picks.length);
  ok("every like has at least one real match up to $25", cheapPicks);
  return out;
}

const confirmed = readConfirmed();
let pass = 0, fail = 0;
if (process.argv.includes("--selftest")) {
  // Three broken inputs, as asked: a shop front link, a dead (never confirmed) link, and an empty result.
  const shopFront = real.GIFTS.map((g, i) => (i === 0 ? { ...g, url: "https://www.zazzle.com/store/2brokeyoopers" } : g));
  const deadLink = real.GIFTS.map((g, i) => (i === 1 ? { ...g, url: "https://payhip.com/b/ZZZZZ" } : g));
  const emptyResult = []; // nothing to suggest at all
  const tooFew = real.GIFTS.slice(0, 2).map((g) => ({ ...g, likes: ["hunting"], kind: "Book" })); // two gifts can never fill three spots
  const badPrice = real.GIFTS.map((g, i) => (i === 0 ? { ...g, price: 4, priceText: "$49.99" } : g));
  const cases = [
    ["wrong price", badPrice, "every price line agrees"],
    ["shop front link", shopFront, "every link goes to one product's own page"],
    ["dead link", deadLink, "every link was opened and confirmed"],
    ["empty result (no gifts)", emptyResult, "no answer ever gives an empty page"],
    ["empty result (too few gifts)", tooFew, "no answer ever gives an empty page"],
    ["missing kinds", tooFew, "printables, books, shirts, mugs and stickers"],
    ["like with no match", tooFew, "every like has at least one real match when"],
  ];
  // Broken matchers: one forgets who the gift is for, one fills close picks with anything cheap,
  // one never stops adding ideas.
  const forgetsWho = { ...real, findGifts: (a, l) => real.findGifts({ ...a, who: "nobody" }, l) };
  const cheapFiller = { ...real, findGifts: (a, l) => { const r = real.findGifts(a, l); const filler = (l || real.GIFTS).filter((g) => !g.likes.some((x) => a.likes.includes(x)) && !r.picks.includes(g)).slice(0, 3); return { picks: r.picks.slice(0, 1), nearby: filler }; } };
  const endless = { ...real, findGifts: (a, l) => ({ picks: (l || real.GIFTS).slice(), nearby: [] }) };
  cases.push(["true crime shown to a kid", real.GIFTS, "a gift is never shown to someone it is not for", forgetsWho]);
  cases.push(["close picks that match nothing", real.GIFTS, "close picks share something they like", cheapFiller]);
  cases.push(["a page of 29 ideas", real.GIFTS, "never more than", endless]);
  for (const [label, list, want, api] of cases) {
    const row = checks(list, confirmed, api || real).find(([name]) => name.startsWith(want));
    if (row && !row[1]) { pass++; console.log("PASS selftest: the broken input '" + label + "' was caught by: " + row[0]); }
    else { fail++; console.log("FAIL selftest: the broken input '" + label + "' was NOT caught"); }
  }
  // Each shop front pattern on its own must be refused.
  const fronts = ["https://payhip.com/EasyfortheExasperated", "https://www.etsy.com/shop/2BrokeYoopers", "https://www.teepublic.com/user/teepublic-com-user-twobrokeyoopers",
    "https://www.redbubble.com/people/2BrokeYoopers/shop", "https://www.zazzle.com/store/2brokeyoopers", "https://www.amazon.com/stores/author/B0X", "https://www.amazon.com/",
    "https://2brokeyoopers.com/#no-such-section", "http://2brokeyoopers.com/"];
  for (const u of fronts) {
    if (!isProductLink(u)) { pass++; console.log("PASS selftest: refused " + u); } else { fail++; console.log("FAIL selftest: allowed " + u); }
  }
} else {
  for (const [name, good, bad] of checks(real.GIFTS, confirmed, real)) {
    if (good) { pass++; console.log("PASS " + name); } else { fail++; console.log("FAIL " + name + "\n     " + bad.join("\n     ")); }
  }
}
console.log("PASS=" + pass + " FAIL=" + fail);
process.exit(fail ? 1 : 0);
