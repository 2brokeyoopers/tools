YOOPER TRIVIA
Public page once merged: https://2brokeyoopers.github.io/tools/yooper-trivia/

PROJECT_NAME: Yooper Trivia (folder yooper-trivia)
FINAL_TARGET: https://2brokeyoopers.github.io/tools/yooper-trivia/ plays a random 10-question U.P. quiz on a phone, shows the score, shares it, and links to 2brokeyoopers.com and the Yooper Dictionary
CHECK_COMMAND: node yooper-trivia\tests\check_all.js   (or double-click yooper-trivia\CHECK YOOPER TRIVIA - double click me.bat). Pass is every line FAIL=0.
SUSPEND_DATE: 2026-12-04
MAX_IDLE_DAYS: 30
STATUS: BUILT 2026-11-04 on branch yooper-trivia, pull request open for Mike. Not merged, not live. Gemini has not graded it yet.

WHAT IS IN THIS FOLDER
- index.html: the quiz page. Start, ten questions, score, share button, links to the store and the dictionary.
- questions.js: every question, its four answers, the right answer, the exact words from the source that prove it, and the source link.
- sw.js and manifest.webmanifest: make the quiz work offline and install on a phone, the same way the Yooper Dictionary does.
  The icons are the Yooper Dictionary's own U.P. icons, used from that folder so there is only one copy.
- tests/test_questions.js: refuses a wrong answer key, a duplicate question, a missing or unlisted source, a missing quote,
  a quote that does not prove the answer, a question without exactly four answers, and fewer than 60 questions.
  Its --selftest breaks the questions nine ways and each break must be caught by its own rule.
- tests/test_page.js: checks the page's promises (slogan last, store and dictionary links, share button, ten per round,
  offline files, start page card, no .md files). Its --selftest breaks each promise and every check must fail.
- tests/test_play.js: plays real rounds in Chromium at phone size, checks ten different questions, the score, the share text,
  no sideways scrolling, and that the quiz still starts with the internet switched off. Its --selftest runs the same checks on
  a broken copy (nine questions per round, questions left out of the offline files) and they must fail.
- tests/verify_sources_online.js: reads every source page on the internet and checks each quote is on it word for word.
  It needs the internet, so it is not in the double-click check. Run it after changing any question.
- tests/check_all.js: runs every offline check and writes CHECK RESULTS.txt.

HOW A QUESTION IS CHECKED
1. The fact was read on the source page on 2026-11-04 and the proving words copied exactly into the question's quote.
2. verify_sources_online.js fetched every page again and found every quote word for word. Run 2026-11-04: PASS=83 FAIL=0.
3. test_questions.js then checks the right answer's words are in the quote and no wrong answer's words are in it.
   That is how a wrong answer key gets caught without a person rereading every page.
4. Any question that could not be proved this way was dropped (see DROPPED below).

DROPPED, COULD NOT VERIFY FROM A SOURCE PAGE
- Michigan Pasty Day (May 24): no source page found that we could read.
- "Yooper" added to the Merriam-Webster dictionary: not on the pages we read.
- Brook trout as the state fish, and other state symbols: the list page did not give readable text.
- The year Lake Superior State first won the NCAA hockey title: the page text did not tie the year to the sentence.
- "Win one for the Gipper": the George Gipp question keeps only his Laurium hometown, which the page states.
- Seney refuge year and the U.P. 200 sled dog race: pages not found or not clear enough.

DECISIONS MADE WITHOUT ASKING (2026-11-04)
1. Branch. The brief said a new branch named yooper-trivia, so the work is there, not on the session's default branch.
2. Source. Every fact comes from Wikipedia, because one source type let a program recheck all 83 quotes word for word.
   Each answer shows its quote and links its page, so a player can check it too.
3. Count. 83 questions, so a player sees fresh questions for several rounds. Each round picks 10 at random, no repeats
   inside a round, and the four answers are shuffled each time.
4. Tone. Wrong answers get a thank-you and the right answer, never a scolding. The Italian Hall question is worded gently.
5. Offline. The page loads fresh from the internet when it can, so a corrected question reaches people right away, and
   uses the saved copy when there is no internet.
6. Share. Phones get the normal share menu. Computers copy the score and a link to paste anywhere.
7. Slogan. The long dash is used, the same as every other page on this site.

STILL OPEN
- What has been left out that should be in? A daily question and a harder "expert" round. Both are easy adds.
- Is this the best we can do? More sources than Wikipedia (state park and National Park Service pages) would make the
  facts stronger. Gemini should grade the real page before Mike sees it.

SOURCES (each page read on 2026-11-04; the number is how many questions use it)
- https://en.wikipedia.org/wiki/Anatomy_of_a_Murder  (1)
- https://en.wikipedia.org/wiki/Big_Two-Hearted_River  (1)
- https://en.wikipedia.org/wiki/Calumet,_Michigan  (1)
- https://en.wikipedia.org/wiki/Chlorastrolite  (1)
- https://en.wikipedia.org/wiki/Christmas,_Michigan  (1)
- https://en.wikipedia.org/wiki/Copper_Harbor,_Michigan  (1)
- https://en.wikipedia.org/wiki/Cudighi  (1)
- https://en.wikipedia.org/wiki/Da_Yoopers  (1)
- https://en.wikipedia.org/wiki/Fort_Wilkins_Historic_State_Park  (1)
- https://en.wikipedia.org/wiki/George_Gipp  (1)
- https://en.wikipedia.org/wiki/Gitche_Gumee  (1)
- https://en.wikipedia.org/wiki/Gogebic_Range  (1)
- https://en.wikipedia.org/wiki/Grand_Hotel_(Mackinac_Island)  (1)
- https://en.wikipedia.org/wiki/Houghton,_Michigan  (1)
- https://en.wikipedia.org/wiki/Ironwood,_Michigan  (1)
- https://en.wikipedia.org/wiki/Ishpeming,_Michigan  (2)
- https://en.wikipedia.org/wiki/Isle_Royale  (2)
- https://en.wikipedia.org/wiki/Isle_Royale_National_Park  (1)
- https://en.wikipedia.org/wiki/Italian_Hall_disaster  (1)
- https://en.wikipedia.org/wiki/Keweenaw_Peninsula  (1)
- https://en.wikipedia.org/wiki/Kitch-iti-kipi  (2)
- https://en.wikipedia.org/wiki/Lake_Superior  (2)
- https://en.wikipedia.org/wiki/Lake_Superior_State_University  (1)
- https://en.wikipedia.org/wiki/Lake_of_the_Clouds  (1)
- https://en.wikipedia.org/wiki/Mackinac_Bridge  (5)
- https://en.wikipedia.org/wiki/Mackinac_Island  (2)
- https://en.wikipedia.org/wiki/Marquette,_Michigan  (1)
- https://en.wikipedia.org/wiki/Michigan_Tech_Huskies_men's_ice_hockey  (1)
- https://en.wikipedia.org/wiki/Michigan_Technological_University  (1)
- https://en.wikipedia.org/wiki/Mount_Arvon  (2)
- https://en.wikipedia.org/wiki/Newberry,_Michigan  (1)
- https://en.wikipedia.org/wiki/North-Central_American_English  (5)
- https://en.wikipedia.org/wiki/Northern_Michigan_University  (1)
- https://en.wikipedia.org/wiki/Paradise,_Michigan  (1)
- https://en.wikipedia.org/wiki/Pasty  (4)
- https://en.wikipedia.org/wiki/Paulding_Light  (1)
- https://en.wikipedia.org/wiki/Pictured_Rocks_National_Lakeshore  (2)
- https://en.wikipedia.org/wiki/Pine_Mountain_Ski_Jump  (1)
- https://en.wikipedia.org/wiki/Porcupine_Mountains  (1)
- https://en.wikipedia.org/wiki/Quincy_Mine  (1)
- https://en.wikipedia.org/wiki/Rubus_parviflorus  (1)
- https://en.wikipedia.org/wiki/SS_Edmund_Fitzgerald  (2)
- https://en.wikipedia.org/wiki/Sault_Ste._Marie,_Michigan  (1)
- https://en.wikipedia.org/wiki/Soo_Locks  (3)
- https://en.wikipedia.org/wiki/St._Ignace,_Michigan  (1)
- https://en.wikipedia.org/wiki/Stamp_sand  (1)
- https://en.wikipedia.org/wiki/Superior_Dome  (1)
- https://en.wikipedia.org/wiki/Tahquamenon_Falls  (3)
- https://en.wikipedia.org/wiki/The_Wreck_of_the_Edmund_Fitzgerald  (1)
- https://en.wikipedia.org/wiki/Toledo_War  (1)
- https://en.wikipedia.org/wiki/Tom_Izzo  (1)
- https://en.wikipedia.org/wiki/Trenary,_Michigan  (1)
- https://en.wikipedia.org/wiki/Upper_Peninsula_of_Michigan  (5)
- https://en.wikipedia.org/wiki/Whitefish_Point  (2)
- https://en.wikipedia.org/wiki/Wolves_and_moose_on_Isle_Royale  (1)
