/* Yooper Dictionary search, A to Z sort and random word.
   Works in the browser (window.YooperDict) and in Node (require) for the tests. */
(function (root) {
  'use strict';

  // Lower case, no accents, no punctuation, single spaces.
  function normalize(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  // Spelled-the-way-it-sounds key: ie/ey at the end act like y, doubled letters count once, ph = f, ck = k.
  function soundKey(s) {
    return normalize(s)
      .replace(/ph/g, 'f').replace(/ck/g, 'k')
      .replace(/(ie|ey|ee)\b/g, 'y')
      .replace(/([a-z])\1+/g, '$1');
  }

  // Edit distance where a swap of two side-by-side letters counts as one slip.
  function editDistance(a, b) {
    a = String(a); b = String(b);
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    const d = [];
    for (let i = 0; i <= m; i++) { d[i] = [i]; }
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
        d[i][j] = v;
      }
    }
    return d[m][n];
  }

  // How many slips a search may contain and still match.
  function typoAllowance(q) {
    const n = normalize(q).replace(/ /g, '').length;
    if (n <= 3) return 0;
    if (n <= 5) return 1;
    if (n <= 9) return 2;
    return 3;
  }

  function sortKey(e) { return normalize(e.term).replace(/ /g, ''); }

  // A to Z by the word itself; capitals and punctuation ignored; numbers first.
  function sortAZ(list) {
    return list.slice().sort(function (a, b) {
      const ka = sortKey(a), kb = sortKey(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  }

  // Lower score is a better match. Returns Infinity for no match.
  function score(e, q, qs, allow) {
    const names = [e.term].concat(e.alt || [], e.say ? [e.say] : []);
    let best = Infinity;
    for (const name of names) {
      const t = normalize(name);
      if (!t) continue;
      if (t === q) return 0;
      if (soundKey(name) === qs) best = Math.min(best, 1);
      if (t.startsWith(q)) best = Math.min(best, 2);
      else if (q.length >= 3 ? t.includes(q) : (' ' + t).includes(' ' + q)) best = Math.min(best, 3);
      if (allow > 0) {
        const dist = editDistance(t, q);
        if (dist <= allow) best = Math.min(best, 4 + dist);
        const ds = editDistance(soundKey(name), qs);
        if (ds <= allow) best = Math.min(best, 4 + ds);
        // a slip inside one word of a longer saying
        if (q.indexOf(' ') < 0) {
          for (const w of t.split(' ')) {
            const dw = editDistance(w, q);
            if (w.length > 3 && dw <= allow) best = Math.min(best, 7 + dw);
          }
        }
      }
    }
    if (best === Infinity && q.length >= 3) {
      const words = normalize(e.def + ' ' + (e.ex || '')).split(' ');
      if (words.indexOf(q) >= 0) best = 10;
      else if (q.length >= 4 && words.some(function (w) { return w.startsWith(q); })) best = 11;
      else if (q.indexOf(' ') > 0 && normalize(e.def).includes(q)) best = 12;
    }
    return best;
  }

  // Search the list. Empty search gives everything A to Z.
  function search(list, query) {
    const q = normalize(query);
    if (!q) return sortAZ(list);
    const qs = soundKey(query);
    const allow = typoAllowance(q);
    const scored = [];
    for (const e of list) {
      const s = score(e, q, qs, allow);
      if (s !== Infinity) scored.push({ e: e, s: s, k: sortKey(e) });
    }
    scored.sort(function (a, b) { return a.s - b.s || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0); });
    return scored.map(function (x) { return x.e; });
  }

  // Pick a random entry; never the one just shown when there is a choice.
  function randomEntry(list, rng, last) {
    if (!list || !list.length) return null;
    rng = rng || Math.random;
    const pool = list.length > 1 && last ? list.filter(function (e) { return e !== last; }) : list;
    const i = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    return pool[i];
  }

  const api = { normalize: normalize, soundKey: soundKey, editDistance: editDistance, typoAllowance: typoAllowance, sortAZ: sortAZ, search: search, randomEntry: randomEntry };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.YooperDict = api;
})(this);
