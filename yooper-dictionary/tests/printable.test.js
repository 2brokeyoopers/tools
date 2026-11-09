// Checks the printable PDF. Run: node --test yooper-dictionary/tests/printable.test.js
// Needs pdftotext and pdfinfo (poppler). YD_PDF picks another PDF to prove the test can fail.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const WORDS = require('../words.js');
const PDF = process.env.YD_PDF || path.join(__dirname, '..', 'printable', 'Yooper-Dictionary-Ink-Saver-Edition.pdf');
const SLOGAN = 'From 2 Broke Yoopers — affordable products built for fun, function, and honest value.';
const flat = s => s.normalize('NFC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

let text = '', info = '';
try {
  text = flat(execFileSync('pdftotext', ['-layout', PDF, '-'], { encoding: 'utf8' }).replace(/-\n\s*/g, '-'));
  info = execFileSync('pdfinfo', [PDF], { encoding: 'utf8' });
} catch (e) { /* tests below fail on empty text */ }
const raw = (() => { try { return execFileSync('pdftotext', [PDF, '-'], { encoding: 'utf8' }); } catch (e) { return ''; } })();

test('the PDF exists and is not empty', () => {
  assert.ok(fs.existsSync(PDF) && fs.statSync(PDF).size > 10000, 'missing or tiny PDF');
});
test('every page is US Letter, 8.5 by 11 inches', () => {
  const m = info.match(/Page size:\s+([\d.]+) x ([\d.]+) pts/);
  assert.ok(m, 'no page size');
  assert.ok(Math.abs(+m[1] - 612) < 1 && Math.abs(+m[2] - 792) < 1, 'page is ' + m[1] + ' x ' + m[2]);
});
test('every word on the list is in the PDF with its meaning', () => {
  const t = flat(raw).replace(/[ -]/g, '');
  const missing = WORDS.filter(w => !t.includes(flat(w.term).replace(/[ -]/g, '')) || !t.includes(flat(w.def).replace(/[ -]/g, '')));
  assert.deepStrictEqual(missing.map(w => w.term), []);
});
test('the word count printed on the cover is the real count', () => {
  assert.ok(text.includes(WORDS.length + ' words and sayings'), 'cover count is not ' + WORDS.length);
});
test('nothing marked UNVERIFIED is printed', () => {
  assert.ok(!/UNVERIFIED/i.test(text));
});
test('no source notes clutter the printable', () => {
  assert.ok(!/Checked at:/.test(text), 'Checked at: lines found');
});
test('U.P. always has periods', () => {
  assert.ok(!/\bUP\b(?! in Da)/.test(raw.replace(/Live it UP/g, '')), 'bare UP found');
});
test('the last words of the PDF are the 2 Broke Yoopers line', () => {
  assert.ok(text.endsWith(flat(SLOGAN)), 'ends with: ' + text.slice(-120));
});
test('the sources page credits every source used', () => {
  const t = flat(raw).replace(/[ -]/g, '');
  const missing = [...new Set(WORDS.map(w => w.source.name))].filter(n => !t.includes(flat(n).replace(/[ -]/g, '')));
  assert.deepStrictEqual(missing, []);
});
test('every fun fact is printed with its source', () => {
  const E = require('../printable/extras.js');
  const t = flat(raw).replace(/[ -]/g, '');
  const missing = E.facts.filter(f => !t.includes(flat(f.text).replace(/[ -]/g, '')) || !t.includes(flat(f.source).replace(/[ -]/g, '')));
  assert.deepStrictEqual(missing.map(f => f.source), []);
});
test('the word search lists all 15 words', () => {
  const E = require('../printable/extras.js');
  assert.strictEqual(E.wordSearch.words.length, 15);
  assert.deepStrictEqual(E.wordSearch.words.filter(w => !text.includes(w)), []);
});
test('at least a cover page plus word pages, and not over 20 pages', () => {
  const n = +((info.match(/Pages:\s+(\d+)/) || [])[1] || 0);
  assert.ok(n >= 5 && n <= 12, 'pages: ' + n);
});
test('every answer key position really spells its word in the printed grid', () => {
  const E = require('../printable/extras.js');
  const n = E.wordSearch.size;
  const rows = raw.split('\n').map(l => l.trim()).filter(l => new RegExp('^([A-Z] ){' + (n - 1) + '}[A-Z]$').test(l)).map(l => l.split(' '));
  assert.strictEqual(rows.length, n, 'grid rows found: ' + rows.length);
  const key = raw.split('\n').join(' ').split('').reverse().join('');
  for (const w of E.wordSearch.words) {
    const m = key.match(new RegExp(w + ' row (\\d+), column (\\d+), (across|down|slant down|slant up)'));
    assert.ok(m, 'no key for ' + w);
    const [dr, dc] = { across: [0, 1], down: [1, 0], 'slant down': [1, 1], 'slant up': [-1, 1] }[m[3]];
    let got = '';
    for (let i = 0; i < w.length; i++) got += (rows[+m[1] - 1 + dr * i] || [])[+m[2] - 1 + dc * i] || '?';
    assert.strictEqual(got, w);
  }
});
