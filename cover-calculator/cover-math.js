// KDP paperback cover math. Used by the page and by the tests.
// Every number here comes from Amazon's KDP help pages:
//   Create a Paperback Cover        https://kdp.amazon.com/en_US/help/topic/G201953020
//   Paperback Submission Guidelines https://kdp.amazon.com/en_US/help/topic/G201857950
//   Barcodes                        https://kdp.amazon.com/en_US/help/topic/G5HDYGP4BXLX4RUW
// The math runs in millionths of an inch, as whole numbers, so nothing drifts.
(function (root) {
  "use strict";
  const MICRO = 1000000;

  // Spine thickness per page, in millionths of an inch (help page G201953020).
  const PAPERS = {
    white:    { name: "White paper (black ink)",       perPage: 2252, rule: "page count x 0.002252\"" },
    cream:    { name: "Cream paper (black ink)",       perPage: 2500, rule: "page count x 0.0025\"" },
    standard: { name: "Standard color (white paper)",  perPage: 2252, rule: "page count x 0.002252\"" },
    premium:  { name: "Premium color (white paper)",   perPage: 2347, rule: "page count x 0.002347\"" },
  };

  const BLEED = 125000;          // 0.125" added to top, bottom and outside edges
  const TEXT_MARGIN = 125000;    // text at least 0.125" inside the trim lines
  const SPINE_MARGIN = 62500;    // 0.0625" between spine text and each spine edge
  const BARCODE_MARGIN = 250000; // Amazon's calculator: barcode margin 0.25"
  const BARCODE_W = 2000000, BARCODE_H = 1200000; // suggested barcode box 2" x 1.2"
  const SPINE_TEXT_MIN_PAGES = 80; // "We only print spine text on books with more than 79 pages."
  const DPI = 300;

  // Page count limits per trim size, [min, max], or null where Amazon says Not available.
  // From the trim size table on help page G201857950.
  const L = (white, cream, standard, premium) => ({ white: [24, white], cream: [24, cream], standard: standard ? [72, standard] : null, premium: [24, premium] });
  const REG = L(828, 776, 600, 828);
  const TRIMS = [
    { w: "5", h: "8", limits: REG, group: "us" },
    { w: "5.06", h: "7.81", limits: REG, group: "us" },
    { w: "5.25", h: "8", limits: REG, group: "us" },
    { w: "5.5", h: "8.5", limits: REG, group: "us" },
    { w: "6", h: "9", limits: REG, group: "us" },
    { w: "6.14", h: "9.21", limits: REG, group: "us" },
    { w: "6.69", h: "9.61", limits: REG, group: "us" },
    { w: "7", h: "10", limits: REG, group: "us" },
    { w: "7.44", h: "9.69", limits: REG, group: "us" },
    { w: "7.5", h: "9.25", limits: REG, group: "us" },
    { w: "8", h: "10", limits: REG, group: "us" },
    { w: "8.25", h: "6", limits: L(800, 750, 600, 800), group: "us" },
    { w: "8.25", h: "8.25", limits: L(800, 750, 600, 800), group: "us" },
    { w: "8.27", h: "11.69", limits: L(780, 730, null, 590), group: "us" },
    { w: "8.5", h: "8.5", limits: L(590, 550, 600, 590), group: "us" },
    { w: "8.5", h: "11", limits: L(590, 550, 600, 590), group: "us" },
    // Sizes sold through Amazon Japan (kdp.amazon.co.jp table on the same help page).
    { w: "4.06", h: "7.17", limits: REG, group: "jp" },
    { w: "4.13", h: "6.81", limits: REG, group: "jp" },
    { w: "4.41", h: "6.85", limits: REG, group: "jp" },
    { w: "5", h: "7.4", limits: REG, group: "jp" },
    { w: "5.04", h: "7.17", limits: REG, group: "jp" },
    { w: "5.83", h: "8.27", limits: REG, group: "jp" },
    { w: "5.98", h: "8.58", limits: REG, group: "jp" },
    { w: "5.98", h: "8.94", limits: REG, group: "jp" },
    { w: "7.17", h: "8.11", limits: REG, group: "jp" },
    { w: "7.17", h: "10.12", limits: REG, group: "jp" },
    { w: "8.27", h: "10.12", limits: L(780, 730, 600, 780), group: "jp" },
  ];
  TRIMS.forEach((t) => { t.id = t.w + " x " + t.h; });
  // Custom sizes: width 4" to 8.5", height 6" to 11.69" (help page G201834180).
  const CUSTOM = { minW: 4, maxW: 8.5, minH: 6, maxH: 11.69, limits: REG };

  const toMicro = (inches) => Math.round(Number(inches) * MICRO);
  // Round half up to three decimals, the way Amazon's calculator shows sizes.
  const in3 = (micro) => Math.floor((micro + 500) / 1000) / 1000;

  function findTrim(id) {
    const clean = String(id).replace(/["in\s]/g, "").replace(/[×X]/g, "x");
    return TRIMS.find((t) => (t.w + "x" + t.h) === clean) || null;
  }

  // opts: { trim: "6 x 9" | {w, h}, paper: "white"|"cream"|"standard"|"premium", pages: number, bleed: true|false }
  function coverSize(opts) {
    const paper = PAPERS[opts.paper];
    if (!paper) throw new Error("Unknown paper type: " + opts.paper);
    let w, h, limits, preset = null;
    if (typeof opts.trim === "object" && opts.trim) {
      w = Number(opts.trim.w); h = Number(opts.trim.h); limits = CUSTOM.limits;
    } else {
      preset = findTrim(opts.trim);
      if (!preset) throw new Error("Unknown trim size: " + opts.trim);
      w = Number(preset.w); h = Number(preset.h); limits = preset.limits;
    }
    const pages = Math.floor(Number(opts.pages));
    const bleedOn = opts.bleed !== false;

    const W = toMicro(w), H = toMicro(h), B = bleedOn ? BLEED : 0;
    const spine = pages * paper.perPage;
    // Cover Width = Bleed + Back Cover Width + Spine Width + Front Cover Width + Bleed
    const fullW = B + W + spine + W + B;
    // Cover Height = Bleed + Trim Height + Bleed
    const fullH = B + H + B;

    const fullWidth = in3(fullW), fullHeight = in3(fullH);
    const problems = [];
    const range = limits[opts.paper];
    if (!range) problems.push("Amazon does not offer " + paper.name.toLowerCase() + " at this trim size.");
    else if (!(pages >= range[0] && pages <= range[1])) problems.push("For this size and paper, KDP takes " + range[0] + " to " + range[1] + " pages.");
    if (!preset && !(w >= CUSTOM.minW && w <= CUSTOM.maxW && h >= CUSTOM.minH && h <= CUSTOM.maxH)) {
      problems.push("A custom size must be 4 to 8.5 inches wide and 6 to 11.69 inches tall.");
    }

    return {
      trimWidth: in3(W), trimHeight: in3(H), pages, paper: opts.paper, paperName: paper.name, paperRule: paper.rule,
      bleed: in3(B),
      spineWidth: in3(spine),
      fullWidth, fullHeight,
      // Pixels at 300 DPI: the inches times 300, rounded up so the picture is never short.
      pixelWidth: Math.ceil(fullWidth * DPI - 1e-9), pixelHeight: Math.ceil(fullHeight * DPI - 1e-9),
      dpi: DPI,
      // Keep words and faces this far inside the trim lines and the spine folds.
      textMargin: in3(TEXT_MARGIN),
      safeWidth: in3(W - 2 * TEXT_MARGIN), safeHeight: in3(H - 2 * TEXT_MARGIN),
      spineMargin: in3(SPINE_MARGIN),
      spineSafeWidth: in3(Math.max(0, spine - 2 * SPINE_MARGIN)), spineSafeHeight: in3(H - 2 * TEXT_MARGIN),
      barcodeMargin: in3(BARCODE_MARGIN), barcodeWidth: in3(BARCODE_W), barcodeHeight: in3(BARCODE_H),
      spineTextAllowed: pages >= SPINE_TEXT_MIN_PAGES,
      evenPagesNote: pages % 2 === 1,
      problems,
      // Exact sizes in millionths of an inch, for drawing the template.
      micro: { W, H, B, spine, fullW, fullH, text: TEXT_MARGIN, spineMargin: SPINE_MARGIN, barcodeMargin: BARCODE_MARGIN, barcodeW: BARCODE_W, barcodeH: BARCODE_H },
    };
  }

  const api = { PAPERS, TRIMS, CUSTOM, coverSize, findTrim, SPINE_TEXT_MIN_PAGES, DPI };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CoverMath = api;
})(this);
