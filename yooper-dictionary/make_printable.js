// Builds printable/Yooper Dictionary - printable.pdf from words.js.
// Run from the repo folder: node yooper-dictionary/make_printable.js
// Needs Playwright with Chromium. Check it with: node --test yooper-dictionary/tests/printable.test.js
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const WORDS = require('./words.js');
const { sortAZ } = require('./dictionary.js');

const OUT_DIR = path.join(__dirname, 'printable');
const OUT = path.join(OUT_DIR, 'Yooper Dictionary - printable.pdf');
const SLOGAN = 'From 2 Broke Yoopers — affordable products built for fun, function, and honest value.';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const letterOf = t => { const c = t.normalize('NFD').replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase(); return /[0-9]/.test(c) ? '#' : c; };

const sorted = sortAZ ? sortAZ(WORDS) : WORDS.slice().sort((a, b) => a.term.localeCompare(b.term));
let body = '', last = '';
for (const w of sorted) {
  const L = letterOf(w.term);
  if (L !== last) { body += `<h2 class="letter">${L}</h2>`; last = L; }
  const say = w.say ? ` <span class="say">(${esc(w.say)})</span>` : '';
  const alt = w.alt && w.alt.length ? `<div class="alt">Also: ${w.alt.map(esc).join(', ')}</div>` : '';
  body += `<div class="entry"><div class="head"><b class="term">${esc(w.term)}</b>${say} <i class="pos">${esc(w.pos || '')}</i></div>` +
    `<div class="def">${esc(w.def)}</div><div class="ex">“${esc(w.ex)}”</div>${alt}` +
    `<div class="src">Checked at: ${esc(w.source.name)}</div></div>`;
}

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: 8.5in 11in; margin: 0.6in 0.6in 0.7in; }
body { font-family: Lora, Georgia, serif; color: #1d1d1d; font-size: 10.5pt; line-height: 1.32; margin: 0; }
.cover { height: 9.6in; display: flex; flex-direction: column; justify-content: center; text-align: center; page-break-after: always; border: 3px double #2f5d3a; padding: 0.5in; box-sizing: border-box; }
.cover .kicker { letter-spacing: 0.25em; text-transform: uppercase; color: #2f5d3a; font-size: 11pt; }
.cover h1 { font-size: 48pt; margin: 0.15in 0 0.1in; line-height: 1.05; }
.cover .sub { font-size: 15pt; font-style: italic; margin-bottom: 0.35in; }
.cover .count { font-size: 13pt; }
.cover .fun { margin: 0.45in auto 0; max-width: 5.2in; font-size: 11pt; color: #444; }
.cover .brand { margin-top: 0.6in; font-weight: bold; color: #2f5d3a; font-size: 12pt; }
.how { font-size: 10.5pt; border-bottom: 2px solid #2f5d3a; margin-bottom: 0.1in; } .how p { margin: 0.04in 0; }
.how h2 { color: #2f5d3a; }
.cols { column-count: 2; column-gap: 0.35in; column-rule: 1px solid #c9d6cc; }
h2.letter { column-span: none; font-size: 22pt; color: #2f5d3a; border-bottom: 2px solid #2f5d3a; margin: 0.12in 0 0.06in; break-after: avoid; }
.entry { break-inside: avoid; margin: 0 0 0.11in; }
.term { font-size: 12pt; }
.say { color: #555; } .pos { color: #2f5d3a; }
.ex { font-style: italic; color: #333; }
.alt { font-size: 9pt; color: #444; }
.src { font-size: 7.5pt; color: #777; }
.end { text-align: center; margin-top: 0.4in; padding-top: 0.2in; border-top: 2px solid #2f5d3a; font-size: 12pt; break-inside: avoid; }
.end .slogan { margin-top: 0.2in; font-weight: bold; color: #2f5d3a; }
</style></head><body>
<section class="cover">
  <div class="kicker">Printable edition</div>
  <h1>The Yooper Dictionary</h1>
  <div class="sub">How we talk up here in Michigan's Upper Peninsula, eh</div>
  <div class="count">${WORDS.length} words and sayings, each with a plain meaning and an example</div>
  <div class="fun">Stick it on the fridge at camp, hand it to the trolls visiting from below the bridge, or settle that argument about pasties once and for all.</div>
  <div class="brand">2 Broke Yoopers</div>
</section>
<section class="how">
  <h2>How to use this dictionary</h2>
  <p>Words are in A to Z order. Each one gives the word, how to say it when that helps, a plain meaning and a short example. "Also" lists other spellings you might see.</p>
  <p>Every word was checked against a real web page that ties it to the U.P. The page we used is named in small print under each word.</p>
  <p>Want the free, searchable version for your phone? Visit 2brokeyoopers.github.io/tools/yooper-dictionary and look up any word in a second, even if you spell it like a troll.</p>
  <p>Know a word we missed? Thank you for helping! Please send it to 2brokeyoopers@gmail.com.</p>
</section>
<main class="cols">${body}</main>
<section class="end">
  <p>Thanks for reading, and have a good one!</p>
  <p>Find shirts, books and more printables at 2brokeyoopers.com.</p>
  <p class="slogan">${SLOGAN}</p>
</section>
</body></html>`;

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.pdf({ path: OUT, format: 'Letter', printBackground: true, preferCSSPageSize: true });
  await browser.close();
  console.log('Wrote ' + OUT);
})();
