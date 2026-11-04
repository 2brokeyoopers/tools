FREE TOOLS FROM 2 BROKE YOOPERS
Public site: https://2brokeyoopers.github.io/tools/ (GitHub Pages, served from the main branch)

PROJECT_NAME: KDP Cover Size Calculator (folder cover-calculator)
FINAL_TARGET: https://2brokeyoopers.github.io/tools/cover-calculator/ shows the full cover size, spine width, safe zones and spine text answer, and downloads a 300 DPI template
CHECK_COMMAND: node cover-calculator\tests\check_all.js   (or double-click cover-calculator\CHECK THE COVER CALCULATOR - double click me.bat). Pass is every line FAIL=0.
SUSPEND_DATE: 2026-12-04
MAX_IDLE_DAYS: 30
STATUS: BUILT on branch cover-calculator, waiting for Mike to look at it and merge. Not public until merged.

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
- Mike looks at the page and the template by eye, then merges the pull request to make it public.
- What has been left out that should be in? Millimeter input and a hardcover option. Both are easy adds.
- Is this the best we can do? A PDF template would suit people using Canva or Word. Worth a later look.
