// Builds "printable/Yooper Dictionary - printable.pdf" from words.js: the paid handout.
// Run from the repo folder: NODE_PATH=$(npm root -g) node yooper-dictionary/make_printable.js
// Check it with: node --test yooper-dictionary/tests/printable.test.js
// Pictures in printable/art come from the 2BY LIBRARY (sources listed in printable/art/SOURCES.txt).
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const WORDS = require('./words.js');
const EXTRAS = require('./printable/extras.js');
const { sortAZ } = require('./dictionary.js');

const OUT = path.join(__dirname, 'printable', 'Yooper Dictionary - printable.pdf');
const ART = path.join(__dirname, 'printable', 'art');
const SLOGAN = 'From 2 Broke Yoopers — affordable products built for fun, function, and honest value.';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const img = f => 'data:image/png;base64,' + fs.readFileSync(path.join(ART, f)).toString('base64');
const letterOf = t => { const c = t.normalize('NFD').replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase(); return /[0-9]/.test(c) ? '#' : c; };

// ---- dictionary entries
let dict = '', last = '';
for (const w of sortAZ(WORDS)) {
  const L = letterOf(w.term);
  if (L !== last) { dict += `<div class="letter">${L}</div>`; last = L; }
  const say = w.say ? ` <span class="say">(${esc(w.say)})</span>` : '';
  dict += `<p class="e"><b>${esc(w.term)}</b>${say} <i>${esc(w.pos || '')}</i> ${esc(w.def)}</p>`;
}

// ---- word search: fixed seed so every build is the same puzzle
function makeSearch(words, size, seed) {
  let s = seed; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const dirs = [[0, 1], [1, 0], [1, 1], [-1, 1]];
  for (let attempt = 0; attempt < 500; attempt++) {
    const g = Array.from({ length: size }, () => Array(size).fill(''));
    const placed = [];
    let ok = true;
    for (const w of words.slice().sort((a, b) => b.length - a.length)) {
      let done = false;
      for (let t = 0; t < 400 && !done; t++) {
        const [dr, dc] = dirs[Math.floor(rnd() * dirs.length)];
        const r0 = Math.floor(rnd() * size), c0 = Math.floor(rnd() * size);
        const r1 = r0 + dr * (w.length - 1), c1 = c0 + dc * (w.length - 1);
        if (r1 < 0 || r1 >= size || c1 >= size) continue;
        let fits = true;
        for (let i = 0; i < w.length; i++) { const ch = g[r0 + dr * i][c0 + dc * i]; if (ch && ch !== w[i]) { fits = false; break; } }
        if (!fits) continue;
        const cells = [];
        for (let i = 0; i < w.length; i++) { g[r0 + dr * i][c0 + dc * i] = w[i]; cells.push((r0 + dr * i) + ',' + (c0 + dc * i)); }
        placed.push({ w, cells, r0, c0, dr, dc }); done = true;
      }
      if (!done) { ok = false; break; }
    }
    if (!ok) continue;
    const fill = 'ABCDEFGHIJKLMNOPRSTUVWY';
    const used = new Set(placed.flatMap(p => p.cells));
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!g[r][c]) g[r][c] = fill[Math.floor(rnd() * fill.length)];
    return { g, placed, used };
  }
  throw new Error('word search did not fit');
}
const WS = EXTRAS.wordSearch.words.map(w => w.toUpperCase());
const { g, used, placed } = makeSearch(WS, EXTRAS.wordSearch.size, 906);
const grid = (key) => '<table class="' + (key ? 'key' : 'ws') + '">' + g.map((row, r) => '<tr>' + row.map((ch, c) =>
  `<td${key && used.has(r + ',' + c) ? ' class="hit"' : ''}>${key && !used.has(r + ',' + c) ? '' : ch}</td>`).join('') + '</tr>').join('') + '</table>';

// ---- sources, grouped
const src = {};
for (const w of WORDS) { const k = w.source.name; (src[k] = src[k] || { url: w.source.url, n: 0 }).n++; }
const srcList = Object.entries(src).sort((a, b) => a[0].localeCompare(b[0]))
  .map(([n, v]) => `<li>${esc(n)} <span class="u">(${esc(v.url.split('/')[2].replace(/^www\./, ''))})</span></li>`).join('');
const factSrc = EXTRAS.facts.map((f, i) => `<li>Fun fact ${i + 1}: ${esc(f.source)} <span class="u">(${esc(f.url.split('/')[2].replace(/^www\./, ''))})</span></li>`).join('');

const say = WORDS.filter(w => w.say && EXTRAS.sayKey.includes(w.term)).sort((a, b) => a.term.localeCompare(b.term))
  .map(w => `<tr><td><b>${esc(w.term)}</b></td><td>${esc(w.say)}</td></tr>`).join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: 8.5in 11in; margin: 0.5in 0.55in 0.55in; }
* { box-sizing: border-box; }
body { font-family: Lora, Georgia, serif; color: #1d1d1d; margin: 0; }
.page { page-break-after: always; position: relative; }
.page:last-child { page-break-after: auto; }
.green { color: #2f5d3a; }
/* cover */
.cover { height: 9.9in; border: 3px double #2f5d3a; padding: 0.45in 0.5in; text-align: center; display: flex; flex-direction: column; }
.cover .kicker { letter-spacing: .3em; text-transform: uppercase; color: #2f5d3a; font-size: 11pt; }
.cover h1 { font-size: 50pt; line-height: 1; margin: .12in 0 .08in; }
.cover .sub { font-style: italic; font-size: 15pt; }
.cover .map { height: 2.7in; margin: .3in auto .1in; width: 6in; background: #cfe0d3;
  -webkit-mask: url(${img('up_outline.png')}) center/contain no-repeat; mask: url(${img('up_outline.png')}) center/contain no-repeat; }
.cover .count { font-size: 14pt; font-weight: bold; margin-top: .1in; }
.cover .inside { margin: .2in auto 0; text-align: left; font-size: 11.5pt; line-height: 1.5; width: 4.2in; }
.cover .inside li { list-style: none; } .cover .inside li:before { content: "✓ "; color: #2f5d3a; font-weight: bold; }
.cover .brand { margin-top: auto; font-weight: bold; color: #2f5d3a; font-size: 13pt; }
.cover .branch { position: absolute; width: 1.5in; opacity: .85; }
.cover .b1 { left: .25in; top: .2in; transform: rotate(-15deg); } .cover .b2 { right: .2in; bottom: .5in; transform: rotate(160deg); }
/* dictionary */
h2 { font-size: 17pt; color: #2f5d3a; margin: 0 0 .06in; border-bottom: 2px solid #2f5d3a; }
.how { font-size: 8.5pt; color: #444; margin: 0 0 .08in; }
.dict { column-count: 3; column-gap: .22in; column-rule: 1px solid #c9d6cc; font-size: 8.6pt; line-height: 1.25; }
.letter { font-size: 13pt; font-weight: bold; color: #2f5d3a; border-bottom: 1px solid #2f5d3a; margin: .04in 0 .03in; break-after: avoid; }
.e { margin: 0 0 .045in; break-inside: avoid; } .e i { color: #2f5d3a; } .say { color: #555; }
/* extras */
.two { display: flex; gap: .3in; }
.facts { flex: 1.35; font-size: 11pt; line-height: 1.4; } .facts ol { padding-left: .22in; margin: 0; } .facts li { margin-bottom: .07in; }
.keybox { flex: 1; font-size: 10pt; }
.keybox table { border-collapse: collapse; width: 100%; } .keybox td { padding: 1px 3px; border-bottom: 1px dotted #bbb; }
.tip { font-size: 9pt; font-style: italic; margin: .05in 0 .08in; }
.deco { display: flex; justify-content: space-around; align-items: flex-end; margin-top: .15in; } .deco img { height: 1.9in; }
.ws { border-collapse: collapse; margin: .05in auto; } .ws td { width: .4in; height: .4in; text-align: center; font: bold 15pt Lora, Georgia, serif; border: 1px solid #c9d6cc; }
.wsrow { display: flex; gap: .25in; align-items: flex-start; }
.find { font-size: 10.5pt; columns: 1; } .find li { list-style: none; } .find li:before { content: "□ "; }
.beagle { width: 1.6in; margin-top: .15in; }
.bubble { font-size: 9.5pt; font-style: italic; border: 1px solid #2f5d3a; border-radius: 8px; padding: 4px 7px; margin-top: .05in; }
.key { border-collapse: collapse; transform: rotate(180deg); } .key td { width: .17in; height: .17in; font: 7pt Georgia, serif; text-align: center; border: 1px solid #eee; } .key td.hit { background: #e3eee5; }
.answer { font-size: 8pt; color: #555; margin-top: .15in; transform: rotate(180deg); line-height: 1.4; }
.sources { columns: 2; column-gap: .25in; font-size: 7.9pt; line-height: 1.22; padding-left: .15in; margin: .04in 0; } .sources li { break-inside: avoid; margin-bottom: 1px; }
.u { color: #666; }
.end { text-align: center; font-size: 10.5pt; margin-top: .12in; border-top: 2px solid #2f5d3a; padding-top: .08in; }
.end .slogan { font-weight: bold; color: #2f5d3a; margin-top: .06in; }
</style></head><body>

<section class="page cover">
  <img class="branch b1" src="${img('hemlock_branch_psf_ink_keyed.png')}" alt="">
  <img class="branch b2" src="${img('hemlock_branch_psf_ink_keyed.png')}" alt="">
  <div class="kicker">Printable edition</div>
  <h1>The Yooper Dictionary</h1>
  <div class="sub">How we talk up here in Michigan's Upper Peninsula, eh?</div>
  <div class="map"></div>
  <div class="count">${WORDS.length} words and sayings, each with a plain meaning</div>
  <ul class="inside">
    <li>Every word from A to Z, with how to say the tricky ones</li>
    <li>${EXTRAS.facts.length} U.P. fun facts and a place-name pronunciation key</li>
    <li>Da Yooper Word Search with an answer key</li>
    <li>Every source credited, so you can check us</li>
  </ul>
  <div class="brand">2 Broke Yoopers</div>
</section>

<section class="page">
  <h2>The words, A to Z</h2>
  <p class="how">Each word gives how to say it (when that helps), what kind of word it is, and a plain meaning. n. = thing, v. = action, adj. = describing word, phr. = saying, interj. = something you blurt out. The free, searchable phone version with an example for every word is at 2brokeyoopers.github.io/tools/yooper-dictionary.</p>
  <div class="dict">${dict}</div>
</section>

<section class="page">
  <h2>${EXTRAS.factsTitle}</h2>
  <div class="two">
    <div class="facts"><ol>${EXTRAS.facts.map(f => `<li>${esc(f.text)}</li>`).join('')}</ol></div>
    <div class="keybox"><b class="green">Say it like a Yooper</b>
      <p class="tip">${esc(EXTRAS.sayTip)}</p>
      <table>${say}</table></div>
  </div>
  <div class="deco"><img src="${img('pine_cone_psf_pd_ink_keyed.png')}" alt=""><img src="${img('trillium_psf_pd_ink_keyed.png')}" alt=""><img src="${img('morel_psf_pd_ink_keyed.png')}" alt=""></div>
</section>

<section class="page">
  <h2>${esc(EXTRAS.wordSearch.title)}</h2>
  <p class="how">${esc(EXTRAS.wordSearch.how)}</p>
  <div class="wsrow">${grid(false)}
    <div><ul class="find">${EXTRAS.wordSearch.words.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
      <img class="beagle" src="${img('beagle_psf_pd_ink_keyed.png')}" alt="">
      <div class="bubble">${esc(EXTRAS.wordSearch.dogLine)}</div></div></div>
  <div class="answer"><b>Answer key</b> (row from the top, column from the left):
    <span class="keylist">${EXTRAS.wordSearch.words.map(w => { const p = placed.find(x => x.w === w.toUpperCase());
      const dir = p.dr === 0 ? 'across' : p.dc === 0 ? 'down' : p.dr === 1 ? 'slant down' : 'slant up';
      return `${esc(w)} row ${p.r0 + 1}, column ${p.c0 + 1}, ${dir}`; }).join(' · ')}</span></div>
</section>

<section class="page">
  <h2>Where the words come from</h2>
  <p class="how">Every word and meaning was checked against these pages. Thank you to every writer, newspaper, museum and Yooper who wrote these down first!</p>
  <ul class="sources">${srcList}${factSrc}</ul>
  <div class="end">
    <p>Know a word we missed? Please send it to 2brokeyoopers@gmail.com. Thank you!</p>
    <p>Shirts, books and more printables: 2brokeyoopers.com</p>
    <p class="slogan">${SLOGAN}</p>
  </div>
</section>
</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.pdf({ path: OUT, format: 'Letter', printBackground: true, preferCSSPageSize: true });
  if (process.env.YD_HTML) fs.writeFileSync(process.env.YD_HTML, html);
  await browser.close();
  console.log('Wrote ' + OUT);
})();
