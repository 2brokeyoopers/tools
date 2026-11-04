// DELIBERATELY BROKEN word list. Every entry breaks one rule, so every entries test must FAIL on it.
// Used only by: YD_WORDS=yooper-dictionary/tests/broken-words.js node --test yooper-dictionary/tests/entries.test.js
module.exports = [
  {term: 'pasty', pos: 'n.', def: '', ex: 'No meaning given.', source: {name: 'Somewhere', url: 'https://example.com/a'}},
  {term: 'sisu', pos: 'n.', def: 'Grit.', ex: 'No source given.'},
  {term: 'troll', pos: 'n.', def: 'Someone from below the bridge. UNVERIFIED', ex: 'Hi.', source: {name: 'Nowhere', url: 'https://example.com/b'}},
  {term: 'Troll', pos: 'n.', def: 'Same word twice.', ex: 'Hi again.', source: {name: 'Nowhere', url: 'https://example.com/c'}},
  {term: 'camp', pos: 'n.', def: 'A cabin in the UP without periods.', ex: 'Fun.', source: {name: 'X', url: 'https://example.com/d'}},
  {term: 'beater', pos: 'n.', def: 'A stupid old car.', ex: 'Rude.', source: {name: 'X', url: 'https://example.com/e'}}
];
