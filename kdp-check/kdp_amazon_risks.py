"""kdp_amazon_risks.py - what Amazon KDP may reject or flag in a Word manuscript.

Free-checker part of 2 Broke Yoopers' KDP Quick Formatter. Read-only: it opens
the .docx as a zip and never changes it. Every rule below is one line of the
formatter's AGREED SPEC, PART A (Amazon KDP rules, each with its KDP help page),
and the rule number is printed with every finding so it can be checked.

Each finding says whether Quick Formatter fixes it. That claim is not a hope:
test_amazon_risks.py runs the real paid formatter on a broken book for every
rule and checks the finding is gone from the formatter's output (FIXES) or is
still there (does not fix). A claim that does not match the measurement fails
the test.
"""
from __future__ import annotations

import re
import struct
import zipfile
from html import unescape
from pathlib import Path

RISKS_VERSION = "1.1.0"
KDP_HELP = "https://kdp.amazon.com/en_US/help/topic/"

# KDP US trim sizes in inches (AGREED SPEC A3).
KDP_TRIMS = [
    (5, 8), (5.06, 7.81), (5.25, 8), (5.5, 8.5), (6, 9), (6.14, 9.21),
    (6.69, 9.61), (7, 10), (7.44, 9.69), (7.5, 9.25), (8, 10), (8.25, 6),
    (8.25, 8.25), (8.5, 8.5), (8.5, 11), (8.27, 11.69),
]
TRIM_TOLERANCE = 0.02

# Inside margin by page count (A6).
INSIDE_MARGIN_TABLE = [(150, 0.375), (300, 0.5), (500, 0.625), (700, 0.75), (828, 0.875)]
MIN_OUTER_MARGIN = 0.25          # top, bottom and outside without bleed (A7)
MIN_PAGES, MAX_PAGES = 24, 828   # A1, A2 (white paper, most trims)
MIN_FONT_HALF_POINTS = 14        # 7 pt (A11)
MIN_DPI, LOW_DPI = 300, 200      # A14
MAX_BLANK_PAGES_IN_A_ROW = 4     # A20 (start or middle of the book)
FRONT_MATTER_PAGES = 6           # what the formatter reports for its own front pages
LINES_PER_PAGE = 33              # 11 pt lines on a 6x9 page, for blank-line runs

# KDP's own list of template placeholder text (A25), plus lorem ipsum.
PLACEHOLDERS = [
    "book title", "author name", "insert text here", "insert acknowledgements text here",
    "insert chapter", "insert author bio text here", "type text", "type here",
    "titulo del libro", "nomber del author", "titre du livre", "buchtitel",
    "lorem ipsum",
]

# Fonts every KDP printer and every Word install has. Anything else is flagged
# as a font Amazon may swap (A12, A13). Kept short on purpose.
COMMON_FONTS = {
    "times new roman", "garamond", "georgia", "book antiqua", "palatino linotype",
    "palatino", "cambria", "calibri", "arial", "helvetica", "baskerville",
    "baskerville old face", "caslon", "adobe caslon pro", "minion pro",
    "century schoolbook", "bookman old style", "courier new", "courier", "verdana",
    "tahoma", "trebuchet ms", "segoe ui", "aptos", "liberation serif",
    "liberation sans", "dejavu serif", "dejavu sans", "symbol", "wingdings",
    "ms mincho", "ms gothic", "yu mincho", "yu gothic", "noto serif", "noto sans",
    "ebgaramond", "eb garamond", "crimson text", "libre baskerville",
}

EMU_PER_INCH = 914400
TWIPS_PER_INCH = 1440


def _src(key):
    return KDP_HELP + {
        "SUBMIT": "G201857950", "MARGINS": "GVBQ3CMEQW3W2VL6", "FONTS": "G202145450",
        "IMAGES": "G202169030", "SAVE": "G202145060", "FIX": "G201834260",
        "TEMPLATES": "G201834230", "WORD2PDF": "G202188020", "PRINTOPT": "G201834180",
    }[key]


def _finding(code, rule, level, title, detail, fix, formatter_fixes, source):
    return {
        "code": code, "rule": rule, "level": level, "title": title,
        "detail": detail, "fix": fix, "formatter_fixes": formatter_fixes,
        "source": _src(source),
    }


# ----------------------------------------------------------------- reading
def _text_of(xml):
    return "".join(unescape(t) for t in re.findall(r"<w:t\b[^>]*>([\s\S]*?)</w:t>", xml))


def _paragraphs(xml):
    return re.findall(r"<w:p\b[^>]*/>|<w:p\b[^>]*>[\s\S]*?</w:p>", xml)


def _image_size(data):
    """(width_px, height_px) from PNG, JPEG or GIF bytes, else None."""
    if data[:8] == b"\x89PNG\r\n\x1a\n" and len(data) >= 24:
        return struct.unpack(">II", data[16:24])
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return struct.unpack("<HH", data[6:10])
    if data[:2] == b"\xff\xd8":
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
                i += 2
                continue
            seg_len = struct.unpack(">H", data[i + 2:i + 4])[0]
            if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                h, w = struct.unpack(">HH", data[i + 5:i + 9])
                return w, h
            i += 2 + seg_len
    return None


def estimate_pages(chars, chapters):
    """Rough page count at 6x9, 11 pt (the formatter's own calibration:
    50 characters per square inch of a 33.75 sq in text block, plus 1.5 pages
    per chapter for right-hand starts, plus the title, copyright and contents
    pages). Labelled an estimate everywhere."""
    return int(chars / (50.0 * 33.75) + 1.5 * max(0, chapters)) + FRONT_MATTER_PAGES


def _required_inside(pages):
    for limit, margin in INSIDE_MARGIN_TABLE:
        if pages <= limit:
            return margin
    return INSIDE_MARGIN_TABLE[-1][1]


# ----------------------------------------------------------------- checks
def amazon_risks(path, chapters=0):
    """List what Amazon KDP may reject or flag in this .docx.

    chapters: the chapter count the formatter found (for the page estimate).
    Returns {"pages_estimate": int, "findings": [...]}.
    """
    p = Path(path)
    findings = []
    with zipfile.ZipFile(p) as z:
        names = z.namelist()
        doc = z.read("word/document.xml").decode("utf-8", "ignore")
        settings = z.read("word/settings.xml").decode("utf-8", "ignore") if "word/settings.xml" in names else ""
        styles = z.read("word/styles.xml").decode("utf-8", "ignore") if "word/styles.xml" in names else ""
        rels = z.read("word/_rels/document.xml.rels").decode("utf-8", "ignore") if "word/_rels/document.xml.rels" in names else ""
        rel_target = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
        rel_target.update({k: v for v, k in re.findall(r'Target="([^"]+)"[^>]*Id="([^"]+)"', rels)})

        body_text = _text_of(doc)
        chars = len(body_text)
        pages = estimate_pages(chars, chapters)

        # A1 / A2 - length.
        if 0 < pages < MIN_PAGES:
            findings.append(_finding(
                "KDP_TOO_SHORT", "A1", "STOP", "Probably too short for a paperback",
                f"This book comes to about {pages} pages at 6x9 (an estimate). Amazon needs at least {MIN_PAGES} pages.",
                "Add more of the book, or choose a smaller trim size such as 5x8 so it runs to more pages.",
                False, "SUBMIT"))
        if pages > MAX_PAGES:
            findings.append(_finding(
                "KDP_TOO_LONG", "A2", "STOP", "Probably too long for one paperback",
                f"This book comes to about {pages} pages at 6x9 (an estimate). Amazon allows at most {MAX_PAGES} pages on white paper.",
                "Choose a larger trim size such as 8.5x11, or split the book into two volumes.",
                False, "PRINTOPT"))

        # A3 / A6 / A7 - page size and margins, from every section.
        mirror = bool(re.search(r"<w:mirrorMargins\b", settings))
        sections = re.findall(r"<w:sectPr\b[\s\S]*?</w:sectPr>", doc)
        bad_size, bad_margin = set(), []
        for sec in sections:
            sz = re.search(r"<w:pgSz\b[^>]*>", sec)
            mar = re.search(r"<w:pgMar\b[^>]*>", sec)
            def num(tag, attr):
                if not tag:
                    return None
                m = re.search(rf'w:{attr}="(-?\d+)"', tag.group(0))
                return int(m.group(1)) / TWIPS_PER_INCH if m else None
            w, h = num(sz, "w"), num(sz, "h")
            if w and h and not any(abs(w - tw) <= TRIM_TOLERANCE and abs(h - th) <= TRIM_TOLERANCE
                                   for tw, th in KDP_TRIMS):
                bad_size.add(f"{w:.2f} x {h:.2f} in")
            top, bottom = num(mar, "top"), num(mar, "bottom")
            left, right, gutter = num(mar, "left"), num(mar, "right"), num(mar, "gutter") or 0
            if None not in (top, bottom, left, right):
                inside = (left + gutter)
                outside = right
                need_in = _required_inside(max(pages, MIN_PAGES))
                if min(abs(top), abs(bottom), outside) < MIN_OUTER_MARGIN or inside < need_in:
                    bad_margin.append((round(inside, 3), round(outside, 3), round(abs(top), 3), round(abs(bottom), 3), need_in))
        if bad_size:
            findings.append(_finding(
                "KDP_PAGE_SIZE", "A3", "STOP", "Page size is not an Amazon paperback size",
                "Your Word page is " + ", ".join(sorted(bad_size)) + ". Amazon only prints set sizes such as 5x8, 5.5x8.5 and 6x9, and the file's page must match the size you pick.",
                "In Word, go to Layout, then Size, and pick your book's trim size, or let Quick Formatter set it.",
                True, "MARGINS"))
        if bad_margin:
            i, o, t, b, need = bad_margin[0]
            findings.append(_finding(
                "KDP_MARGINS", "A6/A7", "STOP", "Margins are too small for Amazon",
                f"Inside {i} in, outside {o} in, top {t} in, bottom {b} in. For a book of about {max(pages, MIN_PAGES)} pages Amazon needs at least {need} in inside and {MIN_OUTER_MARGIN} in on the other three sides.",
                "Widen the margins in Word under Layout, then Margins, or let Quick Formatter set them.",
                True, "MARGINS"))

        # A11 - type under 7 pt, in the text or in a style the text uses.
        tiny_styles = set()
        for st in re.findall(r"<w:style\b[\s\S]*?</w:style>", styles):
            sid = re.search(r'w:styleId="([^"]+)"', st)
            szm = re.search(r'<w:sz w:val="(\d+)"', st)
            if sid and szm and int(szm.group(1)) < MIN_FONT_HALF_POINTS:
                tiny_styles.add(sid.group(1))
        tiny_runs = 0
        for run in re.findall(r"<w:r\b[^>]*>[\s\S]*?</w:r>", doc):
            if not _text_of(run).strip():
                continue
            szm = re.search(r'<w:sz w:val="(\d+)"', run)
            stm = re.search(r'<w:rStyle w:val="([^"]+)"', run)
            if (szm and int(szm.group(1)) < MIN_FONT_HALF_POINTS) or (stm and stm.group(1) in tiny_styles):
                tiny_runs += 1
        for para in _paragraphs(doc):
            stm = re.search(r'<w:pStyle w:val="([^"]+)"', para)
            if stm and stm.group(1) in tiny_styles and _text_of(para).strip():
                tiny_runs += 1
        if tiny_runs:
            findings.append(_finding(
                "KDP_TINY_TYPE", "A11", "STOP", "Some words are smaller than 7 point",
                ("One piece of text is" if tiny_runs == 1 else f"{tiny_runs} pieces of text are") + " set under 7 pt. Amazon rejects any text smaller than 7 pt.",
                "Select that text in Word and make it at least 7 pt, or let Quick Formatter reset the type.",
                True, "FONTS"))

        # A12 / A13 - fonts Amazon's printers may not have.
        # Only fonts that print: a run with words in it, or the default
        # (Normal) style. A font named only in an unused style never prints.
        used = set()
        for run in re.findall(r"<w:r\b[^>]*>[\s\S]*?</w:r>", doc):
            m = re.search(r'<w:rFonts\b[^>]*w:ascii="([^"]+)"', run)
            if m and _text_of(run).strip():
                used.add(m.group(1))
        normal = re.search(r'<w:style\b[^>]*w:styleId="Normal"[\s\S]*?</w:style>', styles)
        defaults = re.search(r"<w:docDefaults\b[\s\S]*?</w:docDefaults>", styles)
        for block in (normal, defaults):
            if block:
                m = re.search(r'<w:rFonts\b[^>]*w:ascii="([^"]+)"', block.group(0))
                if m:
                    used.add(m.group(1))
        used = {f for f in used if not f.startswith("+")}
        unusual = sorted(f for f in used if f.strip().lower() not in COMMON_FONTS)
        if unusual and not re.search(r"<w:embedTrueTypeFonts\b", settings):
            findings.append(_finding(
                "KDP_FONT", "A12/A13", "WARN", "A font Amazon may not have",
                "Your file uses " + ", ".join(unusual[:5]) + (" and more" if len(unusual) > 5 else "") +
                ", and the fonts are not embedded in the file. Amazon may swap them, which moves words and pages.",
                "Use a common book font such as Garamond or Times New Roman, or in Word turn on File, Options, Save, Embed fonts in the file.",
                True, "FONTS"))

        # A14 - picture resolution: pixels divided by the size it is placed at.
        low, very_low = [], []
        for block in re.findall(r"<wp:(?:inline|anchor)\b[\s\S]*?</wp:(?:inline|anchor)>", doc):
            ext = re.search(r'<wp:extent cx="(\d+)" cy="(\d+)"', block)
            emb = re.search(r'r:embed="([^"]+)"', block)
            if not (ext and emb):
                continue
            target = rel_target.get(emb.group(1), "")
            part = "word/" + target.lstrip("/") if not target.startswith("word/") else target
            part = part.replace("word//", "word/").replace("word/../", "")
            if part not in names:
                continue
            size = _image_size(z.read(part)[:65536])
            if not size:
                continue
            w_in = int(ext.group(1)) / EMU_PER_INCH
            if w_in <= 0:
                continue
            dpi = size[0] / w_in
            if dpi < LOW_DPI:
                very_low.append(int(dpi))
            elif dpi < MIN_DPI:
                low.append(int(dpi))
        if very_low or low:
            worst = min(very_low + low)
            findings.append(_finding(
                "KDP_LOW_DPI", "A14", "STOP" if very_low else "WARN", "Pictures may print blurry",
                f"{len(very_low) + len(low)} picture(s) are under 300 DPI at the size they are placed (the worst is about {worst} DPI). Amazon asks for 300 DPI and calls anything under 200 low resolution.",
                "Replace each one with a larger copy of the picture, or place it smaller on the page.",
                False, "IMAGES"))

        # A17 - comments and hidden text must not be in a print file.
        if "word/comments.xml" in names and re.search(r"<w:commentReference\b", doc):
            findings.append(_finding(
                "KDP_COMMENTS", "A17", "WARN", "Comments are still in the file",
                "Amazon asks for a print file with no comments in it.",
                "In Word, go to Review, then Delete, then Delete All Comments in Document, or let Quick Formatter leave them out.",
                True, "SAVE"))
        hidden = sum(1 for run in re.findall(r"<w:r\b[^>]*>[\s\S]*?</w:r>", doc)
                     if re.search(r"<w:vanish\b(?![^>]*w:val=\"(?:0|false)\")", run) and _text_of(run).strip())
        if hidden:
            findings.append(_finding(
                "KDP_HIDDEN_TEXT", "A17", "WARN", "Hidden text is in the file",
                ("One piece of text is" if hidden == 1 else f"{hidden} pieces of text are") + " set to Hidden. Amazon asks for no invisible content, and hidden words can print.",
                "In Word, turn on Show/Hide, find the hidden words, and delete them or un-hide them, or let Quick Formatter leave them out.",
                True, "SAVE"))

        # A25 - template placeholder text.
        low_text = body_text.lower()
        hits = {ph for ph in PLACEHOLDERS if ph in low_text}
        hits |= {m.group(0) for m in re.finditer(r"\[(?:insert|type|add|your)\b[^\]]{0,60}\]", low_text)}
        hits = sorted(hits)
        if hits:
            findings.append(_finding(
                "KDP_PLACEHOLDER", "A25", "STOP", "Template placeholder text is still in the book",
                "Found: " + ", ".join(f'"{h}"' for h in hits) + ". Amazon rejects books that still carry template text.",
                "Replace that text with your own words, or delete it.",
                False, "FIX"))

        # A20 - more than four blank pages in a row (start or middle).
        run_of_breaks, worst_run = 0, 0
        for para in _paragraphs(doc):
            breaks = len(re.findall(r'<w:br w:type="page"\s*/>', para)) + (1 if re.search(r"<w:pageBreakBefore\b(?![^>]*w:val=\"(?:0|false)\")", para) else 0)
            if _text_of(para).strip() or re.search(r"<w:drawing\b|<w:pict\b", para):
                run_of_breaks = breaks
            else:
                run_of_breaks += breaks
            worst_run = max(worst_run, run_of_breaks)
        empty_run, worst_empty = 0, 0
        for para in _paragraphs(doc):
            if _text_of(para).strip() or re.search(r"<w:drawing\b|<w:pict\b|<w:br w:type=\"page\"", para):
                empty_run = 0
            else:
                empty_run += 1
            worst_empty = max(worst_empty, empty_run)
        if worst_empty >= LINES_PER_PAGE and worst_run - 1 <= MAX_BLANK_PAGES_IN_A_ROW:
            findings.append(_finding(
                "KDP_BLANK_LINES", "A20", "WARN", "Empty lines are making a blank page",
                f"{worst_empty} empty lines sit together, about {worst_empty // LINES_PER_PAGE} blank page(s). Amazon's reviewers flag unexpected blank pages.",
                "In Word, turn on Show/Hide and delete the empty lines, or let Quick Formatter rebuild the pages.",
                True, "FIX"))
        if worst_run - 1 > MAX_BLANK_PAGES_IN_A_ROW:
            findings.append(_finding(
                "KDP_BLANK_PAGES", "A20", "STOP", "Too many blank pages in a row",
                f"About {worst_run - 1} empty pages sit together. Amazon allows at most {MAX_BLANK_PAGES_IN_A_ROW} blank pages in a row at the start or middle of a book.",
                "In Word, turn on Show/Hide and delete the extra page breaks, or let Quick Formatter rebuild the pages.",
                True, "FIX"))

        # A21 - odd or even page section breaks make hidden blank pages.
        # One or two (title page, Chapter 1 on the right) are normal and pass
        # Amazon's previewer; many of them stack up hidden blanks. Same line
        # the formatter's own gate draws (4 or more).
        odd_even = len(re.findall(r'<w:type w:val="(?:oddPage|evenPage)"', doc))
        if odd_even >= 4:
            findings.append(_finding(
                "KDP_ODD_EVEN", "A21", "WARN", "Odd or even page breaks add hidden blank pages",
                f"{odd_even} section break(s) start on an odd or even page. Word adds blank pages for these that only show up in the print file.",
                "Change them to Next Page section breaks, or let Quick Formatter rebuild the chapter starts.",
                True, "WORD2PDF"))

        # A5 / A18 - scripts that must be uploaded as PDF.
        if re.search(r"[֐-׿぀-ヿ]", body_text):
            findings.append(_finding(
                "KDP_PDF_ONLY", "A5", "WARN", "This language must be uploaded as a PDF",
                "Your book has Hebrew, Yiddish or Japanese text. Amazon only takes those books as a PDF, not as a Word file.",
                "Save the finished book as a PDF (File, Save As, PDF) and upload that.",
                False, "SAVE"))

    # A18 - file name characters.
    if re.search(r"[^\x20-\x7E]", p.name):
        findings.append(_finding(
            "KDP_FILE_NAME", "A18", "WARN", "The file name has unusual characters",
            "Amazon rejects file names with emoji or unsupported characters.",
            "Rename the file using only plain letters, numbers, spaces and dashes.",
            False, "SAVE"))

    order = {"STOP": 0, "WARN": 1}
    findings.sort(key=lambda f: order[f["level"]])
    return {"version": RISKS_VERSION, "pages_estimate": pages, "findings": findings}


if __name__ == "__main__":
    import json, sys
    print(json.dumps(amazon_risks(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 0), indent=1))
