FREE TOOLS FROM 2 BROKE YOOPERS
Public site: https://2brokeyoopers.github.io/tools/ (GitHub Pages, served from the main branch)

PROJECT_NAME: KDP Cover Size Calculator (folder cover-calculator)
FINAL_TARGET: https://2brokeyoopers.github.io/tools/cover-calculator/ shows the full cover size, spine width, safe zones and spine text answer, and downloads a 300 DPI template
CHECK_COMMAND: node cover-calculator\tests\check_all.js   (or double-click cover-calculator\CHECK THE COVER CALCULATOR - double click me.bat). Pass is every line FAIL=0.
SUSPEND_DATE: 2026-12-04
MAX_IDLE_DAYS: 30
STATUS: LIVE since 2026-11-04. Mike approved it by eye, Gemini Pro graded it A with PUBLISH: YES, and it was merged to main.

WHAT IS IN THIS REPO
- index.html: the start page that links every tool
- yooper-dictionary/: the Yooper Dictionary
- kdp-check/: the free KDP manuscript check
- cover-calculator/: the KDP paperback cover size calculator (built 2026-11-04)

KDP COVER CALCULATOR, HOW IT WORKS
- cover-math.js holds all the math. The page and the tests both use this one file.
- index.html is the page. It draws the template in the browser and downloads it as a PNG stamped 300 DPI.
- tests/amazon_examples.json holds 19 answers read from Amazon's own KDP Cover Calculator on 2026-11-04.
- tests/test_cover_math.js checks the math against those 19 answers. It also runs each one against three
  deliberately broken copies of the math (no bleed, wrong paper rate, one page off) and fails if a broken
  copy is not caught. Proof run 2026-11-04: with bleed removed and wrong paper rates, all 19 FAILED
  (PASS=0 FAIL=19). With the real math, all 19 PASSED.
- tests/test_page.js checks the page's promises: the slogan is the last line, the Payhip link, the
  citations, the spine rates, the 79 page rule, the download button, and the start page link.
  Its --selftest breaks each promise on purpose and every check must fail.
- tests/test_template.js opens the real page in Chromium, downloads three templates and checks size,
  300 DPI stamp, bleed, trim line, spine folds, barcode box and safe zone by reading pixels.
  Its --selftest feeds it a broken picture and every check must fail.
- .github/workflows/cover-calculator-checks.yml runs every check on Linux AND Windows on each push.

DECISIONS MADE WITHOUT ASKING (2026-11-04, nobody was available to answer)
1. Worked examples. Amazon's help pages give the formulas but no worked numbers. So the 19 test examples
   come from Amazon's own KDP Cover Calculator (kdp.amazon.com/cover-calculator), which the help page
   links to. They cover all 16 standard trim sizes and all four papers.
2. Rounding. Sizes show three decimals, rounded half up, the same as Amazon's calculator. On exact
   half-thousandths (for example 333 cream pages = 0.8325") Amazon's own tool rounds up some times and
   down other times. So the tests allow one thousandth of an inch (about a third of a pixel).
3. Pixels are inches times 300, rounded UP to a whole pixel, so the picture is never too small.
4. Safe zone. Amazon's calculator table lists the front safe area as trim width minus 0.125", but
   Amazon's own downloaded template keeps 0.125" from the spine fold as well. We follow the template
   (0.125" in from every trim line and the fold), which is the safer one. Spine safe zone is the spine
   minus 0.0625" on each side, which matches Amazon exactly.
5. Spine text. Amazon says "more than 79 pages" in one place and "at least 79 pages" in another. We use
   more than 79 (80 pages or more), as the brief said. That is the safer reading.
6. Bleed input is a choice: with bleed (default, what KDP needs) or without (trim size only, marked as
   not the upload size). KDP covers always need 0.125" bleed, so it is not a free number.
7. Trim sizes. All 16 Amazon.com sizes, plus the 10 extra Amazon Japan sizes, plus a custom size
   (4" to 8.5" wide, 6" to 11.69" tall). Page limits per size and paper come from the KDP table and
   the page warns politely when a count is outside them.
8. Paper types are the four in the brief. Groundwood paper (0.00235" per page) is left out on purpose.
9. Slogan. The brief typed it with a short dash. The page uses the long dash, the same as every other
   page on this site and the rulebook's fixed wording, so the line reads the same everywhere.
10. Payhip link is https://payhip.com/b/16Nra, the same KDP Quick Formatter link the KDP check uses.
    The formatter price is $14.99 (Mike, 2026-11-04, after the Payhip price drop). Payhip blocked our
    robot from reading the live page, so this comes from Mike, not a fresh look.
13. Price check. tests/test_prices.js fails if the old formatter price shows up anywhere in this repo,
    and checks that both KDP pages show $14.99. It covers the KDP check page too, because that page
    offers the same formatter. The refund line in kdp-check/kdp_preflight_gate.py now says "refund
    what you paid", since buyers before 2026-11-04 paid the old price. The same file in the 2BY repo
    (kdp-free-check/web) still needs the same change.
11. The barcode box is 2" x 1.2", 0.25" from the spine fold and from the bottom trim, as in Amazon's
    template.
12. The page remembers the last choices on that one device only. Nothing is sent anywhere.

STILL OPEN
- What has been left out that should be in? Millimeter input and a hardcover option. Both are easy adds.
- Is this the best we can do? A PDF template would suit people using Canva or Word. Worth a later look.

====================================================================
YOOPER DICTIONARY (folder yooper-dictionary)

PROJECT_NAME: Yooper Dictionary (yooper-dictionary/)
FINAL_TARGET: Mike opens yooper-dictionary/index.html on his phone and sees 150+ real U.P. words, each with a meaning, an example and a source link, with forgiving search, A to Z letters and a Random word button.
CHECK_COMMAND: node --test yooper-dictionary/tests/search.test.js yooper-dictionary/tests/entries.test.js
SUSPEND_DATE: 2026-12-04
MAX_IDLE_DAYS: 14
STATUS: built on branch dictionary-next, pull request open for Mike, not merged

TO-DO LIST (Gemini Pro ranked it 2026-11-04, Gemini chat named dictionary; tick in place, one task at a time)
Card: dictionary, in company plan 6.26\2BY_CURRENT_STATE_READ_FIRST.txt
[ ] 0. Mike merges pull request #2 so the 153-word page goes live. Done when the live page shows 153 words.
[~] 1. Printable PDF of the dictionary (BUILT 2026-11-04: yooper-dictionary/printable/Yooper Dictionary - printable.pdf, 12 Letter pages, made by node yooper-dictionary/make_printable.js, checked by node --test yooper-dictionary/tests/printable.test.js, 9/9 pass, 3 fail on a cut-down copy; Gemini Pro graded B 2026-11-04, fixes done: source lines dropped from the printable, bigger type, da U.P. said YOO-pee; its U.P.'s fix was already right in the file; regrade pending), used as the free gift in Mike's buy-one-get-one deal. Gemini: adds value to close sales without competing with the free page. Mike approves the PDF. Needs from Mike: what the deal is and where it runs.
[ ] 2. Shirts and other print-on-demand items from the funniest words. Gemini: Yooper slang shirts sell well in the U.P. Goes through the normal design rules and Mike's approval.
[ ] 3. Facebook post on the 2BY Page asking fans for more words, linking the page. Gemini: free reach and new words. New kind of post, so Mike sees it first (rulebook overrides Gemini's "no approval").
[ ] 4. Button on 2brokeyoopers.com linking the dictionary. Gemini: steady free traffic. Mike clicks Publish in Carrd (website card rule).
[ ] 5. Sell the printable on its own on Payhip and Etsy at $3.99 (Gemini's price). Gemini ranked it last because the web page is free. Mike approves the listing and price.
Later, not ranked: a suggest-a-word form on the page, real recordings for the Hear it button.

WHAT IS IN THE DICTIONARY FOLDER
- index.html - the page.
- words.js - the word list. Each entry: term, pos, optional say and alt spellings, def (plain meaning), ex (example), source (name and web address).
- dictionary.js - search that forgives misspellings, A to Z sort, random word. Same file runs on the page and in the tests.
- tests/search.test.js - search tests.
- tests/entries.test.js - every entry has a meaning, an example and a source, 150+ words, nothing UNVERIFIED, no repeats, U.P. with periods, family-friendly words, page ends with the 2 Broke Yoopers line.
- tests/broken-words.js - a deliberately broken list used only to prove the entry tests can fail.
- sw.js, manifest.webmanifest, icons - lets the page install on a phone and work offline.

HOW TO RUN THE CHECK (needs Node 18 or newer)
  node --test yooper-dictionary/tests/search.test.js yooper-dictionary/tests/entries.test.js
Prove the entry tests can fail:
  YD_WORDS=yooper-dictionary/tests/broken-words.js node --test yooper-dictionary/tests/entries.test.js
(On Windows cmd: set YD_WORDS=yooper-dictionary\tests\broken-words.js then run the same node line.)

HOW A WORD GETS IN
1. Find the word on a real web page that ties it to the U.P., Yoopers, Upper Michigan or the Keweenaw.
2. Copy an exact quote from that page.
3. A script re-downloads the page and checks the quote and the word are really on it. Pass means the word goes in with the page as its source. Fail means UNVERIFIED and it stays off the page.
4. Meanings are written in our own plain words. Example sentences are our own, short, polite and fun.

DECISIONS (made without asking, as the job asked)
- Slogan line: changed 2026-11-04 to the long-dash wording the rulebook fixes and every other page on this site uses. Test 8 checks it and was shown failing on the old dash.
- "Yeah, no" was on the old page as meaning yes. The source says the last word is the real answer, so "yeah, no" means no. Fixed.
- The old page's 30 entries had no sources. Each was re-checked. Ones a source confirmed stayed (reworded). Ones no checked page confirmed were dropped and are listed below as UNVERIFIED.
- One source per entry: the page that best confirms it, preferring news, university, tourism and Wikipedia pages over personal blogs when both had it.
- A few words are Michigan-wide but used up north (fudgie, have a good one, yeah no, ope, uff da). Kept only when the source ties them to the north or the U.P. dialect.
- Kept out for being not family-friendly or unsafe for kids even with a source: lighter fluid called "girl scout water", drinking words (road pop, roadie), a swear in Finnish, and joke spellings that rely on rude puns.
- Search: ignores capitals, accents and punctuation, knows other spellings (chuke finds chook), allows 1 slip for 4-5 letters, 2 for 6-9, 3 for longer, counts two swapped letters as one slip, and treats "pastie" like "pasty". If nothing is close it also looks inside meanings. Best match first, ties A to Z.
- A to Z ignores capitals and punctuation. Numbers (906) sort first under #.
- Random word never repeats the word just shown.
- Phone layout: search and Random word stay pinned at the top, letter strip scrolls sideways, no sideways page scroll, dark mode follows the phone.
- Offline cache name bumped to v3 so phones pick up the new list.
- README is plain text, not .md, per house rules.

UNVERIFIED - LEFT OFF THE PAGE
These were on the old page or turned up in research, but no page we downloaded confirmed them. They stay off until someone finds a real source.
- side-by-side (the small two-seat off-road vehicle) - old page, no source found
- bait shop - old page, no source tying it to U.P. talk
- tag (hunting license) - old page, no source found
- snirt (snow mixed with dirt) - old page, no U.P. source found
- rock pile (old mine waste heap) - old page, no source found
- finlander - old page, no source found
- Superiorland, below the bridge - quoted from a Smithsonian 1987 program book PDF the checker could not read
- ice shanty - the cited slang page did not contain the word
- mojakka as a stand-alone word - only found as "kala mojaka" (kept that one)

LEFT OUT ON PURPOSE (sourced, but judged out)
- girl scout water (lighter fluid), rip-roaring, road pop, roadie - not right for kids or not really U.P. words
- turdy poiner (thirty-pointer) - sourced, but the spelling reads crude for a family page
- knockers (Cornish mine spirits) - sourced, but the word has a rude second meaning
- Ojibwe wild rice steps (gidasigewin, bawishkam, nooshkaachigewin), Maawanji'iding, Jingle Dress dancers, Anishinaabe - real and sourced, but these are Ojibwe language and ceremony, not Yooper slang; kept manoomin, Boozhoo and Miigwech, which U.P. folks commonly hear
- takka, fathom, coureur de bois, mossel, Sons of St. George, Il Minatore Italiano, Italian Mutual Beneficial Society, Midnight Run, Yooper Loop - history or business names, not everyday words
- went post office, pank it, the Upper Hand, Gichigami, Gichi-gami - repeats of words already in (their spellings are kept as other spellings so search still finds them)

HOW THE LIST WAS CHECKED (2026-11-04)
Every source page was downloaded fresh with curl. A script turned each page into plain text and checked that the exact quote copied from it, and the word itself, are really on the page. 153 entries passed. Anything that failed was left off. The quotes and the script live outside this repo; rerun by repeating the steps under HOW A WORD GETS IN.

WHAT WAS LEFT OUT THAT SHOULD BE IN
- Audio: the Hear it button uses the phone's built-in voice, which says some Finnish and Ojibwe words badly. Real recordings by a Yooper would be better.
- A "suggest a word" form so visitors can send words with a source.
IS THIS THE BEST WE CAN DO
Close. The weakest sources are a few personal blogs (Life in the 906, God's Country, Soles of My Traveling Shoes). Swapping those for newspaper or university pages where possible would make the list stronger.
