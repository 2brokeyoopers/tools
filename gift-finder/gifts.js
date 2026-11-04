// Yooper Gift Finder: the gift list and the matching rules.
// The page and the tests both use this one file, so they can never disagree.
// Every link was opened and read on 2026-11-04. See tests/confirmed_links.txt for how.
// A link that could not be confirmed is NOT in this file. Those are listed in README.txt.
(function (root) {
  "use strict";

  // likes: hunting, fishing, cabin, kids, books, puzzles, humor, pride, home
  // who:   dad, mom, kid, friend, self, away   (a small nudge up the list)
  // notFor: people a gift must never be shown to (no true crime for a kid)
  // price: dollars as read on 2026-11-04, or null when the store shows many prices
  const GIFTS = [
    // ---- Printables (instant downloads) ----
    { id: "almanac", kind: "Printable", name: "U.P. County Almanac, Jan 2027 to Mar 2028", price: 4, priceText: "$4.00",
      store: "Payhip", url: "https://payhip.com/b/doPfn",
      blurb: "A 15-month calendar with a different U.P. county each month: stories, photos, events, moon phases and a bucket list. Print it tonight, wrap it tomorrow.",
      likes: ["cabin", "pride", "books"], who: ["mom", "dad", "away", "friend"] },
    { id: "almanac-fall", kind: "Printable", name: "U.P. County Almanac, Fall Start Edition (Oct 2026 to Dec 2027)", price: 4, priceText: "$4.00",
      store: "Payhip", url: "https://payhip.com/b/Ia3VN",
      blurb: "The same almanac, starting this fall, so nobody has to wait for January to use it.",
      likes: ["cabin", "pride"], who: ["mom", "dad", "away"] },
    { id: "yooper-calendar", kind: "Printable", name: "Da Yooper Calendar 2027", price: 2.99, priceText: "$2.99",
      store: "2brokeyoopers.com", url: "https://2brokeyoopers.com/#yooper-calendar",
      blurb: "A printable 2027 calendar stuffed with Yooper humor, camp wisdom and a daily U.P.-style line. Cheaper than a pasty, and lasts longer.",
      likes: ["humor", "pride", "cabin"], who: ["friend", "away", "dad", "mom", "self"] },
    { id: "deer-camp-calendar", kind: "Printable", name: "Da Yooper Deer Camp Calendar 2027", price: 2.99, priceText: "$2.99",
      store: "2brokeyoopers.com", url: "https://2brokeyoopers.com/#deer-camp-calendar",
      blurb: "365 deer camp lines: cold mornings, trail cams, pasties and stories by the stove. Camp humor, not a rulebook.",
      likes: ["hunting", "humor", "cabin"], who: ["dad", "friend", "self"] },
    { id: "smokies-journal", kind: "Printable", name: "Great Smoky Mountains Travel Journal", price: 4, priceText: "$4.00",
      store: "Payhip", url: "https://payhip.com/b/uVoqT",
      blurb: "A 44-page printable hiking log and cabin trip planner, for the friend who is already packing.",
      likes: ["cabin"], who: ["friend", "mom", "self"] },
    { id: "yellowstone-journal", kind: "Printable", name: "Yellowstone Travel Journal", price: 4, priceText: "$4.00",
      store: "Payhip", url: "https://payhip.com/b/NRdr4",
      blurb: "A printable cabin and trail logbook with a hiking tracker and a wildlife tally. Bison count as wildlife, not as company.",
      likes: ["cabin"], who: ["friend", "self", "mom"] },
    { id: "meal-plan", kind: "Printable", name: "Easy for the Exasperated: Simple Meal Plan", price: 2.99, priceText: "$2.99",
      store: "Payhip", url: "https://payhip.com/b/HZEL2",
      blurb: "Five weekday dinners, three sizes, zero decisions. A kind gift for anyone who is tired of asking what's for supper.",
      likes: ["home", "humor"], who: ["mom", "friend", "self"] },
    { id: "sleep-guide", kind: "Printable", name: "Easy for the Exasperated: Simple Back-to-Sleep Guide", price: 1.99, priceText: "$1.99",
      store: "Payhip", url: "https://payhip.com/b/4peIG",
      blurb: "A short guide for the 3 a.m. ceiling stare. Small price, big yawn.",
      likes: ["home"], who: ["mom", "friend", "self"] },
    { id: "kitchen-reset", kind: "Printable", name: "Easy for the Exasperated: Simple Kitchen Reset", price: 0, priceText: "Free (pay what you want)",
      store: "Payhip", url: "https://payhip.com/b/gdQXM",
      blurb: "A free printable for a calmer kitchen. Pay what you want, and zero is just fine.",
      likes: ["home"], who: ["mom", "self", "friend"] },

    // ---- Books (paperbacks on Amazon) ----
    { id: "deer-logbook", kind: "Book", name: "U.P. Deer Camp Logbook", price: 5.5, priceText: "$5.50 paperback",
      store: "Amazon", url: "https://www.amazon.com/dp/B0H6TTWFWT",
      blurb: "A 120-page hunting log for deer camp: stand, wind, moon, deer seen, and the ones that got away.",
      likes: ["hunting", "cabin"], who: ["dad", "friend", "self"] },
    { id: "word-search", kind: "Book", name: "Yooper Word Search", price: 8, priceText: "$8.00 paperback",
      store: "Amazon", url: "https://www.amazon.com/dp/B0H5W1VFZ6",
      blurb: "100 big-grid word searches of U.P. towns, pasties, slang and wildlife, with answer keys for the impatient.",
      likes: ["puzzles", "pride", "books"], who: ["mom", "dad", "away", "friend"] },
    { id: "word-search-large", kind: "Book", name: "Yooper Word Search, Large Print", price: null, priceText: "See price on Amazon",
      store: "Amazon", url: "https://www.amazon.com/dp/B0H5W61XYL",
      blurb: "The same 100 U.P. puzzles in big print. Easy on the eyes, hard on the pencil.",
      likes: ["puzzles", "pride"], who: ["mom", "dad", "away"] },
    { id: "yooper-kids", kind: "Book", name: "Yooper Kids", price: 14.99, priceText: "$14.99 paperback",
      store: "Amazon", url: "https://www.amazon.com/dp/B0G4RPRRVF",
      blurb: "Wonders and adventures from all 15 U.P. counties, written for young Yoopers and the ones who wish they were.",
      likes: ["kids", "books", "pride"], who: ["kid", "away"] },
    { id: "birding", kind: "Book", name: "Upper Peninsula Birding Life List", price: 6.99, priceText: "$6.99 paperback",
      store: "Amazon", url: "https://www.amazon.com/dp/B0H5BFNWMH",
      blurb: "A U.P. bird watching log for sightings, species and seasons. For the person who already owns three feeders.",
      likes: ["cabin", "books"], who: ["mom", "dad", "self"] },
    { id: "atv-log", kind: "Book", name: "U.P. ATV, UTV & ORV Trip Log", price: 6.99, priceText: "$6.99 paperback",
      store: "Amazon", url: "https://www.amazon.com/dp/B0H4STXGN6",
      blurb: "Log every trail, mile and mud hole. The mud stays on the machine, the memories go in the book.",
      likes: ["cabin", "hunting"], who: ["dad", "friend", "self"] },
    { id: "killers", kind: "Book", name: "Conversations With Killers", price: 9.99, priceText: "$9.99 paperback",
      store: "Amazon", url: "https://www.amazon.com/dp/B0GS5V1BDX",
      blurb: "Criminal profiling and real case studies, for the reader who finishes every true crime show. Not light reading, but a page-turner.",
      likes: ["books"], who: ["friend", "mom", "self"], notFor: ["kid"] },

    // These three are on our Books page. Their Amazon pages would not open for our robot on 2026-11-04,
    // so the button goes to our own Books page, which links to Amazon.
    { id: "fishing-log", kind: "Book", name: "Upper Peninsula Fishing Log", price: 5.5, priceText: "$5.50 paperback",
      store: "2brokeyoopers.com", url: "https://2brokeyoopers.com/#books",
      blurb: "Record every cast, catch and lake. Finally, written proof of the one that didn't get away. Find it on our Books page.",
      likes: ["fishing", "cabin", "books"], who: ["dad", "friend", "self"] },
    { id: "outdoorsman-log", kind: "Book", name: "U.P. Outdoorsman's 3-in-1 Logbook", price: 6.5, priceText: "$6.50 paperback",
      store: "2brokeyoopers.com", url: "https://2brokeyoopers.com/#books",
      blurb: "Deer camp, trail cam and snowmobile logs in one book, because one book is easier to find in the truck. Find it on our Books page.",
      likes: ["hunting", "cabin"], who: ["dad", "friend", "self"] },
    { id: "count-of-souls", kind: "Book", name: "The Count of Souls", price: 13.99, priceText: "$13.99 paperback",
      store: "2brokeyoopers.com", url: "https://2brokeyoopers.com/#books",
      blurb: "Our historical shipwreck novel. A good one for a reader and a long winter night. Find it on our Books page.",
      likes: ["books"], who: ["mom", "dad", "friend", "away", "self"], notFor: ["kid"] },

    // ---- Mugs, tumblers and hats (Zazzle) ----
    { id: "wisconsin-mug", kind: "Mug", name: "Wisconsin Yooper Two-Tone Mug", price: 17.8, priceText: "$17.80 before any sale",
      store: "Zazzle", url: "https://www.zazzle.com/wisconsin_yooper_grade_eh_cheese_funny_cow_two_tone_coffee_mug-256944135514556276",
      blurb: "A funny cow, some cheese and a grade of Eh. For the Yooper who crossed into Wisconsin and kept the accent.",
      likes: ["humor", "pride"], who: ["away", "friend", "dad"] },
    { id: "aliens-mug", kind: "Mug", name: "Aliens Always Have to Come to Me Mug", price: 17.8, priceText: "$17.80 before any sale",
      store: "Zazzle", url: "https://www.zazzle.com/aliens_always_have_to_come_to_me_funny_ufo_two_tone_coffee_mug-256948969999876979",
      blurb: "A two-tone mug for the person everyone (and everything) seems to find. Coffee not included, abductions not guaranteed.",
      likes: ["humor"], who: ["friend", "dad", "self"] },
    { id: "onto-you-tumbler", kind: "Mug", name: "I'm Onto You Insulated Tumbler", price: 34.35, priceText: "$34.35 before any sale",
      store: "Zazzle", url: "https://www.zazzle.com/im_onto_you_pointing_finger_playfully_fun_insulated_tumbler-256785691398492249",
      blurb: "An insulated tumbler with a pointing finger, for the one who always knows who ate the last pasty.",
      likes: ["humor"], who: ["mom", "friend"] },
    { id: "smell-em-hat", kind: "Hat", name: "I Can Smell 'Em! Morel Hunting Dog Trucker Hat", price: 16.5, priceText: "$16.50 before any sale",
      store: "Zazzle", url: "https://www.zazzle.com/happy_dog_smelling_morel_mushrooms_nature_love_trucker_hat-256130430391358261",
      blurb: "A happy dog on the trail of morels. For the mushroom hunter who will not tell you where the spot is.",
      likes: ["cabin", "humor", "hunting"], who: ["dad", "friend", "self"] },

    // ---- Shirts and stickers (shown on our own website) ----
    { id: "truly-yooper-tee", kind: "Shirt", name: "Ya Ain't Truly a Yooper T-Shirt", price: 24, priceText: "From $24",
      store: "2brokeyoopers.com", url: "https://2brokeyoopers.com/",
      blurb: "Our best seller. White pines and the line every Yooper knows. 18 colors, sizes S to 5XL. It is the first shirt under Shop Our Best Sellers.",
      likes: ["pride", "cabin", "hunting"], who: ["dad", "mom", "friend", "away", "self"] },
    { id: "fishing-hoodie", kind: "Shirt", name: "Obsessed with Fishing Hoodie", price: null, priceText: "See price in our shop",
      store: "2brokeyoopers.com", url: "https://2brokeyoopers.com/#merch",
      blurb: "For the angler who calls it a hobby while everyone else calls it a lifestyle. Find it under Dogs, Euchre and the Outdoors.",
      likes: ["fishing", "humor"], who: ["dad", "friend", "self"] },
    { id: "euchre-hoodie", kind: "Shirt", name: "Let the Euchre Reckoning Begin Hoodie", price: null, priceText: "See price in our shop",
      store: "2brokeyoopers.com", url: "https://2brokeyoopers.com/#merch",
      blurb: "For the card table trash talker. Find it under Dogs, Euchre and the Outdoors.",
      likes: ["humor", "pride", "cabin"], who: ["dad", "mom", "friend"] },
    { id: "kids-tees", kind: "Shirt", name: "Florida Yooper and California Yooper Kids Tees", price: null, priceText: "See price in our shop",
      store: "2brokeyoopers.com", url: "https://2brokeyoopers.com/#merch",
      blurb: "Kids tees for little Yoopers raised far from home. Find them under Yoopers Far From Home.",
      likes: ["kids", "pride", "humor"], who: ["kid", "away"] },
    { id: "dad-wise-kids-tee", kind: "Shirt", name: "Dad Wise Enough Kids Tee", price: null, priceText: "See price in our shop",
      store: "2brokeyoopers.com", url: "https://2brokeyoopers.com/#merch",
      blurb: "A kids tee that compliments Dad, which is rare and should be framed. Find it under Aliens, Dads and Laughs.",
      likes: ["kids", "humor"], who: ["kid", "dad"] },
    { id: "california-sticker", kind: "Sticker", name: "California Yooper Sticker", price: null, priceText: "See price in our shop",
      store: "2brokeyoopers.com", url: "https://2brokeyoopers.com/#merch",
      blurb: "A sticker for the Yooper enriching the lives of Californians. Find it under Yoopers Far From Home.",
      likes: ["pride", "humor"], who: ["away", "friend", "kid"] },
  ];

  const LIKES = { hunting: "Hunting", fishing: "Fishing", cabin: "Cabin life and the outdoors", kids: "Kids stuff", books: "Books", puzzles: "Puzzles", humor: "A good laugh", pride: "Yooper pride", home: "Cooking and an easier home" };
  const WHO = { dad: "Dad or Grandpa", mom: "Mom or Grandma", kid: "A kid", friend: "A friend or coworker", self: "Me (we won't tell)", away: "A Yooper living far away" };
  const BUDGETS = { 10: "Under $10", 25: "Up to $25", 50: "Up to $50", 0: "Price is no object (within reason, eh)" };
  const MIN_RESULTS = 3;
  const MAX_RESULTS = 8;

  // budget 0 means no limit. A gift with no single price fits only "no limit".
  function fitsBudget(g, budget) {
    if (!budget) return true;
    return g.price !== null && g.price <= budget;
  }

  // Returns { picks, nearby }. picks match the budget and at least one like.
  // nearby fills up to MIN_RESULTS so nobody ever gets an empty page. They still fit the budget when possible.
  function findGifts(answers, list) {
    list = (list || GIFTS).filter((g) => !(g.notFor || []).includes(answers.who));
    const likes = answers.likes || [];
    const score = (g) => g.likes.filter((l) => likes.includes(l)).length * 10 + (g.who.includes(answers.who) ? 3 : 0);
    const order = (a, b) => score(b) - score(a) || (a.price ?? 999) - (b.price ?? 999);
    const picks = list.filter((g) => fitsBudget(g, answers.budget) && g.likes.some((l) => likes.includes(l))).sort(order).slice(0, MAX_RESULTS);
    const nearby = [];
    if (picks.length < MIN_RESULTS) {
      // Close picks: something they like comes first, even a little over budget, then whatever fits the budget.
      const rest = list.filter((g) => !picks.includes(g))
        .sort((a, b) => score(b) - score(a) || fitsBudget(b, answers.budget) - fitsBudget(a, answers.budget) || (a.price ?? 999) - (b.price ?? 999));
      nearby.push(...rest.slice(0, MIN_RESULTS - picks.length));
    }
    return { picks, nearby };
  }

  const api = { GIFTS, LIKES, WHO, BUDGETS, MIN_RESULTS, MAX_RESULTS, findGifts, fitsBudget };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.GiftFinder = api;
})(typeof self !== "undefined" ? self : this);
