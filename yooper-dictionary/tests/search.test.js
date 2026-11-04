// Search tests for the Yooper Dictionary. Run: node --test yooper-dictionary/tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const dict = require(path.join(__dirname, '..', 'dictionary.js'));
const WORDS = require(path.join(__dirname, '..', 'words.js'));

const terms = list => list.map(e => e.term);
const first = q => (dict.search(WORDS, q)[0] || {}).term;

test('exact word comes back first', () => {
  assert.equal(first('pasty'), 'pasty');
  assert.equal(first('sisu'), 'sisu');
});

test('capital letters and extra spaces do not matter', () => {
  assert.equal(first('  YOOPER '), 'Yooper');
  assert.equal(first('Holy   WAH'), 'holy wah');
});

test('forgives common misspellings', () => {
  assert.equal(first('chopers'), 'choppers');      // missing letter
  assert.equal(first('swampres'), 'swampers');     // swapped letters
  assert.equal(first('sissu'), 'sisu');            // extra letter
  assert.equal(first('holy wha'), 'holy wah');     // swapped letters in a saying
  assert.equal(first('pastie'), 'pasty');          // spelled the way it sounds
  assert.equal(first('cudigi'), 'cudighi');
});

test('finds a word by another spelling', () => {
  assert.equal(first('chuke'), 'chook');
});

test('finds a word by a word in its meaning', () => {
  const hits = terms(dict.search(WORDS, 'mittens'));
  assert.ok(hits.includes('choppers'), 'choppers should come up for mittens');
});

test('nonsense finds nothing', () => {
  assert.deepEqual(dict.search(WORDS, 'qzxvbnm'), []);
});

test('empty search shows every word, A to Z', () => {
  const all = dict.search(WORDS, '');
  assert.equal(all.length, WORDS.length);
  assert.deepEqual(terms(all), terms(dict.sortAZ(WORDS)));
});

test('A to Z ignores capital letters and punctuation', () => {
  const sorted = terms(dict.sortAZ([{term: 'eh'}, {term: 'Yooper'}, {term: "'zat so"}, {term: 'Camp'}, {term: 'beater'}]));
  assert.deepEqual(sorted, ['beater', 'Camp', 'eh', 'Yooper', "'zat so"]);
});

test('A to Z does not change the original list', () => {
  const list = [{term: 'b'}, {term: 'a'}];
  dict.sortAZ(list);
  assert.deepEqual(terms(list), ['b', 'a']);
});

test('random word is always a real entry and avoids repeating the last one', () => {
  const list = [{term: 'a'}, {term: 'b'}, {term: 'c'}];
  assert.equal(dict.randomEntry(list, () => 0).term, 'a');
  assert.equal(dict.randomEntry(list, () => 0.999).term, 'c');
  assert.notEqual(dict.randomEntry(list, () => 0, list[0]).term, 'a');
  for (let i = 0; i < 200; i++) assert.ok(list.includes(dict.randomEntry(list, Math.random)));
  assert.equal(dict.randomEntry([], Math.random), null);
});

test('misspelling allowance grows with word length', () => {
  assert.equal(dict.typoAllowance('eh'), 0);
  assert.equal(dict.typoAllowance('sisu'), 1);
  assert.equal(dict.typoAllowance('swampers'), 2);
  assert.equal(dict.editDistance('swampers', 'swampres'), 1); // a swap counts as one slip
});
