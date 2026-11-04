// Every entry must carry a meaning, an example and a checked source.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// YD_WORDS lets the check point these tests at the deliberately broken list to prove they can fail.
const WORDS = require(process.env.YD_WORDS ? path.resolve(process.env.YD_WORDS) : path.join(__dirname, '..', 'words.js'));
const PAGE = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const SLOGAN = 'From 2 Broke Yoopers - affordable products built for fun, function, and honest value.';
const filled = s => typeof s === 'string' && s.trim().length > 0;

test('there are at least 150 words', () => {
  assert.ok(WORDS.length >= 150, `only ${WORDS.length} words`);
});

test('every entry has a word, a plain meaning and an example', () => {
  for (const e of WORDS) {
    assert.ok(filled(e.term), 'entry with no word: ' + JSON.stringify(e));
    assert.ok(filled(e.def), `${e.term}: no meaning`);
    assert.ok(filled(e.ex), `${e.term}: no example sentence`);
    assert.ok(e.def.split(/\s+/).length <= 40, `${e.term}: meaning is too long to be plain`);
  }
});

test('every entry has a source with a name and a real web address', () => {
  for (const e of WORDS) {
    assert.ok(e.source && filled(e.source.name), `${e.term}: no source name`);
    assert.ok(e.source && /^https?:\/\/[^\s/]+\.[^\s]+$/.test(e.source.url || ''), `${e.term}: bad source address`);
  }
});

test('nothing marked UNVERIFIED is on the page', () => {
  for (const e of WORDS) {
    assert.ok(!JSON.stringify(e).includes('UNVERIFIED'), `${e.term} is UNVERIFIED and must be left out`);
  }
});

test('no word appears twice', () => {
  const seen = new Set();
  for (const e of WORDS) {
    const k = e.term.toLowerCase().replace(/[^a-z0-9]/g, '');
    assert.ok(!seen.has(k), `${e.term} appears twice`);
    seen.add(k);
  }
});

test('U.P. is always written with periods', () => {
  const bad = /\bUP\b|\bU\.P(?!\.)|\bU\. P\./;
  for (const e of WORDS) {
    for (const f of ['term', 'def', 'ex']) assert.ok(!bad.test(e[f]), `${e.term}: write U.P. with periods in ${f}`);
  }
  const visible = PAGE.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  assert.ok(!bad.test(visible), 'page text writes UP without periods');
});

test('family-friendly wording', () => {
  const banned = /\b(damn|hell|shit|crap|ass|piss|bastard|sex|sexy|drunk|beer|booze|whiskey|stupid|idiot|dumb|hate)\b/i;
  for (const e of WORDS) {
    const text = [e.term, e.def, e.ex].join(' ').replace(/root ?beer/gi, 'root-soda'); // root beer is a soft drink
    assert.ok(!banned.test(text), `${e.term}: not family-friendly: ${text.match(banned)}`);
  }
});

test('page ends with the 2 Broke Yoopers line', () => {
  const text = PAGE.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.ok(text.endsWith(SLOGAN), 'last words on the page must be: ' + SLOGAN);
});

test('page has search, A to Z, random word, and a phone-sized layout', () => {
  assert.match(PAGE, /<meta name="viewport" content="width=device-width/);
  assert.match(PAGE, /id="q"/);
  assert.match(PAGE, /id="random"/);
  assert.match(PAGE, /src="words\.js"/);
  assert.match(PAGE, /src="dictionary\.js"/);
});
