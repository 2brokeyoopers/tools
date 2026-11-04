YOOPER GIFT FINDER
Public page once merged: https://2brokeyoopers.github.io/tools/gift-finder/

PROJECT_NAME: Yooper Gift Finder (folder gift-finder)
FINAL_TARGET: https://2brokeyoopers.github.io/tools/gift-finder/ asks who, budget and likes, then shows at least 3 gift ideas from 2 Broke Yoopers, each button opening that product's own page, on a phone, even with no signal
CHECK_COMMAND: node gift-finder\tests\check_all.js   (or double-click gift-finder\CHECK THE GIFT FINDER - double click me.bat). Pass is every line FAIL=0.
SUSPEND_DATE: 2026-12-04
MAX_IDLE_DAYS: 30
STATUS: BUILT 2026-11-04 on branch gift-finder, pull request open for Mike. Not merged. Gemini Pro graded it A, PUBLISH: YES
  (relayed by the Supervisor session), with one fix: a Share this list button. Added the same day.

HOW IT WORKS
- gifts.js holds the gift list and the matching rules. The page and the tests both use this one file.
- index.html is the page. Three questions, then the matches. A "Psst, we have printables too" note shows with every result.
- Share this list (under the results) opens the phone's share sheet with every gift name, price and link. Where there
  is no share sheet it copies the list, and if copying is blocked it shows the list ready to copy by hand.
- sw.js saves the page on the phone after the first visit, so it works at camp with no signal.
- Matching: a gift is a match when it fits the budget AND at least one thing they like. Gifts that fit more likes,
  or suit the person, go higher. If fewer than 3 match, "Close pick" gifts fill the list, so nobody gets an empty page.
- A gift with no single price (shirts and stickers, which come in many styles) only shows as a match for "no limit".

THE CHECKS (each one was seen failing on a broken input before it passed)
- tests/test_gifts.js: no shop front links, every link on tests/confirmed_links.txt, all 12,264 ways to answer give
  3 to 8 ideas, matches always fit the budget and a like, no true crime book shown for a kid, close picks share a like
  when one exists, price lines agree with prices. --selftest feeds a shop front link, a dead link, an empty gift list,
  a too-short list, a wrong price and three broken matchers. All 10 are caught, and 9 shop front addresses are refused.
- tests/test_audit.js: the outside check of 2026-11-04 (see TOOLS AUDIT 2026-11-04.txt at the top of the repo).
  No front page link, no moved Zazzle address, no guessed shirt price, no grown-up printables for a kid, and close
  picks are general Yooper gifts, never a kitchen printable for someone who asked for fishing.
- tests/test_links_live.js: opens every link. A 404, a 410, a "page not found" page, or a missing section on
  2brokeyoopers.com fails. A store that turns a robot away is listed to open by hand, not failed.
  --selftest serves dead pages on this computer. All 5 are caught.
- tests/test_page.js: opens the page in Chromium at phone size (375 px). Checks no sideways scroll, big tap targets,
  polite nudge, 3+ ideas, confirmed links only, the printables note, budget order, labeled close picks for a hard
  answer, Share this list (share sheet and copy both carry every name and link), the slogan as the last line, the start
  page card, and that it works with the internet switched off. --selftest serves a broken copy. All 16 caught.
- Share this list test was run before the button existed: 3 FAIL (PASS=13 FAIL=3). After adding it: PASS=16 FAIL=0.
- First run, before the start page card existed: "FAIL the start page has a card for the gift finder", PASS=10 FAIL=1.
  The gift list check first failed on two printables with no likes (they could never show up). Both fixed.

SECOND OPINION (2026-11-04, a separate Claude reviewer that had not seen the build, told to be harsh): grade B-.
Fixed from it: a true crime book could be shown for a kid, close picks put cheap over relevant, no cap on results
(now 8), weak signal could hang the page (now 3 seconds, then the saved copy), "nothing is tracked" was too strong
(Google Fonts sees a visit, so it now says your answers are never sent anywhere), an unconfirmed Kindle price,
a price check that "$49.99" could fool, a too-light amber, smooth scrolling for people who turn motion off,
and buttons that open a new tab without saying so. The matching and price fixes each got a test that fails without them.
The timeout, colour, motion and new-tab fixes have no test of their own yet.

DECISIONS MADE WITHOUT ASKING (2026-11-04)
1. How links were confirmed. Plain robot downloads were blocked by every store. A page reader (WebFetch) could open
   Amazon, Payhip and Zazzle product pages and read the title, price and our store name. Etsy, TeePublic and
   Redbubble refused it every time, so none of their links are on the page. Shirts and stickers instead link to
   the Apparel section of 2brokeyoopers.com, which does link to those stores.
2. Three books whose Amazon pages would not open for the reader (Fishing Log, Outdoorsman's 3-in-1, The Count of
   Souls) link to the Books section of 2brokeyoopers.com instead. That section exists on the live site.
3. Added a ninth like, "Cooking and an easier home", so the meal plan, sleep guide and free kitchen reset can show up.
4. Prices are what the stores showed on 2026-11-04. Zazzle shows sale prices that change, so the page shows the
   price before any sale.
5. Shirt and sticker prices are left blank ("See price in our shop") because each comes in many styles.
6. No changes to .github, README.txt at the top, or any other tool. The start page index.html got one card.
   The workflow that runs checks on GitHub covers the cover calculator only; adding the gift finder to it means
   touching .github, so that is left for Mike to approve.

LINKS LEFT OFF THE PAGE BECAUSE THEY COULD NOT BE CONFIRMED (all found on 2brokeyoopers.com, 2026-11-04)
Etsy (refused the reader): 4529188790 Yooper Calendar, 4533127844 Deer Camp Calendar, 4583132834 Almanac,
  4592918768 Smokies Journal, 4594637033 Yellowstone Journal, 4520545917 Yooper Sayings SVG, 4519768325 U.P. SVG,
  4522633963 906 SVG, 4527594642 Muscle Mascots, 4535355135 Pet Hair Routine (all www.etsy.com/listing/<number>)
TeePublic (refused): every shirt, hoodie, kids tee, sweatshirt and tank top link on the site, for example
  www.teepublic.com/hoodie/93607501 (Ya Ain't Truly a Yooper) and www.teepublic.com/hoodie/94026673 (Obsessed with Fishing)
Redbubble (refused): every www.redbubble.com/i/... link on the site, including the California Yooper sticker
Amazon (server error 500 twice): B0H679NV2Q Fishing Log, B0H5VH29B4 Outdoorsman's 3-in-1, B0H3LL5CGL Count of Souls,
  B0H6WCXNHS Don't Get Played, B0H67JKNPH Don't Get Fooled by Statistics (all www.amazon.com/dp/<code>)

STILL OPEN
- What has been left out that should be in? Product photos. Each card is text only. Pictures would sell better,
  but they need rights proof per image, so that is a separate job.
- Is this the best we can do? Not yet. Once a person confirms the Etsy, TeePublic and Redbubble links by hand, add
  them to tests/confirmed_links.txt and gifts.js, so shirt buttons go straight to the shirt instead of our shop page.
