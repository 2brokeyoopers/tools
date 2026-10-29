#!/usr/bin/env python3
"""Read-only compatibility gate shared by the free checker and paid formatter.

The rules mirror KDP Compatibility Checker v1.5. This module never edits a DOCX.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from html import unescape
from pathlib import Path
from typing import Any
import re
import zipfile

GATE_VERSION = "1.6.0-chapter-gate"
MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024


class GateError(RuntimeError):
    """The selected file could not be inspected safely."""


class LockedFileError(GateError):
    """A .docx that is really a compound file: locked with a password, or an
    old-style Word file saved under the new name. Its message is complete on
    its own, because the usual "Save As a fresh copy" advice keeps the password
    and leaves the buyer stuck (found 2026-09-22 by the broken-books battery)."""


@dataclass(frozen=True)
class GateResult:
    status: str
    label: str
    summary: str
    reasons: tuple[str, ...]
    notes: tuple[str, ...]
    can_format: bool
    metrics: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["reasons"] = list(self.reasons)
        data["notes"] = list(self.notes)
        data["version"] = GATE_VERSION
        return data


def _max_table_columns(document_xml):
    """Widest table in the file, counted by its grid columns (2026-10-19)."""
    widest = 0
    if "tblGrid" not in (document_xml or ""):
        return 0
    for grid in re.findall(r"<(?:w:)?tblGrid\b.*?</(?:w:)?tblGrid>", document_xml or "", re.S):
        widest = max(widest, len(re.findall(r"<(?:w:)?gridCol\b", grid)))
    return widest


def _nested_tables(document_xml):
    """How many tables sit inside a table cell (2026-10-19)."""
    depth = 0
    nested = 0
    if (document_xml or "").count("<w:tbl>") + (document_xml or "").count("<w:tbl ") < 2:
        return 0
    for m in re.finditer(r"<(/?)(?:w:)?(tbl|tc)\b[^>]*?(/?)>", document_xml or ""):
        closing, tag, selfclose = m.group(1), m.group(2), m.group(3)
        if selfclose:
            continue
        if tag == "tc":
            depth += -1 if closing else 1
        elif tag == "tbl" and not closing and depth > 0:
            nested += 1
    return nested


def _count(text: str, pattern: str) -> int:
    return len(re.findall(pattern, text, flags=re.I | re.S))


def _attr(tag: str, local_name: str) -> str | None:
    match = re.search(rf'(?:\w+:)?{re.escape(local_name)}=["\']([^"\']+)["\']', tag, flags=re.I)
    return match.group(1) if match else None


def _paragraph_text(block: str) -> str:
    pieces = re.findall(
        r'<(?:\w+:)?t\b[^>]*>([\s\S]*?)</(?:\w+:)?t>', block, flags=re.I
    )
    return "".join(unescape(piece) for piece in pieces)


def _parse_paragraphs(document_xml: str) -> dict[str, Any]:
    blocks = re.findall(
        r'<(?:w:)?p\b[^>]*/>|<(?:w:)?p\b[^>]*>[\s\S]*?</(?:w:)?p>',
        document_xml,
        flags=re.I,
    )
    nonempty = 0
    blank = 0
    layout_blank = 0
    all_text: list[str] = []
    control_re = re.compile(
        r'<(?:w:)?(?:drawing|object|pict|sectPr|br|lastRenderedPageBreak)\b|'
        r'<(?:wp:)?(?:inline|anchor)\b',
        flags=re.I,
    )
    for block in blocks:
        text = _paragraph_text(block).strip()
        if text:
            nonempty += 1
            all_text.append(text)
        else:
            blank += 1
            if not control_re.search(block):
                layout_blank += 1
    return {
        "count": len(blocks),
        "nonempty": nonempty,
        "blank": blank,
        "layout_blank": layout_blank,
        "text": " ".join(all_text),
    }


def _to_number(value: str | None) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _inches(value: str | None) -> float | None:
    number = _to_number(value)
    return None if number is None else round(number / 1440.0, 3)


def _parse_sections(document_xml: str, settings_xml: str) -> list[dict[str, Any]]:
    blocks = re.findall(
        r'<(?:w:)?sectPr\b[^>]*>[\s\S]*?</(?:w:)?sectPr>',
        document_xml,
        flags=re.I,
    )
    mirror_margins = bool(re.search(r'<(?:w:)?mirrorMargins\b', settings_xml or "", flags=re.I))
    geometry: list[dict[str, Any]] = []
    for block in blocks:
        def first(pattern: str) -> str:
            match = re.search(pattern, block, flags=re.I)
            return match.group(0) if match else ""

        page_size = first(r'<(?:w:)?pgSz\b[^>]*\/?\s*>')
        page_margins = first(r'<(?:w:)?pgMar\b[^>]*\/?\s*>')
        columns = first(r'<(?:w:)?cols\b[^>]*\/?\s*>')
        section_type = first(r'<(?:w:)?type\b[^>]*\/?\s*>')
        column_count = _to_number(_attr(columns, "num")) or 1
        geometry.append({
            "width_inches": _inches(_attr(page_size, "w")),
            "height_inches": _inches(_attr(page_size, "h")),
            "top_inches": _inches(_attr(page_margins, "top")),
            "bottom_inches": _inches(_attr(page_margins, "bottom")),
            "left_inches": _inches(_attr(page_margins, "left")),
            "right_inches": _inches(_attr(page_margins, "right")),
            "gutter_inches": _inches(_attr(page_margins, "gutter")) or 0,
            "columns": max(1, int(column_count)),
            "start_type": _attr(section_type, "val") or "nextPage",
            "mirror_margins": mirror_margins,
        })
    return geometry


def _word_count(text: str) -> int:
    # Any script counts as words (Cyrillic, Greek, Arabic, CJK...), not just
    # Latin letters - a Russian novel is still a book. (Second review 2026-09-10.)
    return len(re.findall(r"[\w’'-]+", text, flags=re.UNICODE))


def _empty_metrics(path: Path, inspection_limited: bool = False) -> dict[str, Any]:
    return {
        "file_name": path.name,
        "file_size_bytes": path.stat().st_size if path.exists() else 0,
        "inspection_limited": inspection_limited,
        "paragraphs": 0,
        "nonempty_paragraphs": 0,
        "blank_paragraphs": 0,
        "layout_blank_paragraphs": 0,
        "layout_blank_ratio": 0,
        "estimated_words": 0,
        "image_occurrences": 0,
        "inline_images": 0,
        "floating_images": 0,
        "legacy_images": 0,
        "media_files": 0,
        "paragraphs_per_image": None,
        "tables": 0,
        "max_table_columns": 0,
        "nested_tables": 0,
        "merged_cell_controls": 0,
        "sections": 0,
        "section_geometry": [],
        "max_columns": 0,
        "odd_even_section_starts": 0,
        "chapter_headings": 0,
        "explicit_page_breaks": 0,
        "page_break_before": 0,
        "hard_page_controls": 0,
        "column_breaks": 0,
        "text_boxes": 0,
        "embedded_objects": 0,
        "equations": 0,
        "charts": 0,
        "diagrams": 0,
        "linked_toc": False,
        "page_fields": 0,
        "hyperlinks": 0,
        "internal_hyperlinks": 0,
        "bookmarks": 0,
        "headers": 0,
        "footers": 0,
        "footnotes": False,
        "endnotes": False,
        "comments": False,
        "tracked_changes": False,
    }


def oversized_result(path: str | Path) -> GateResult:
    file_path = Path(path)
    size_mb = round(file_path.stat().st_size / (1024 * 1024), 1)
    return GateResult(
        status="NOT_COMPATIBLE",
        label="Not compatible with Quick Formatter",
        summary="This file is too large for the safe Quick Formatter workflow.",
        reasons=(
            f"The DOCX is {size_mb:g} MB. Quick Formatter does not support manuscripts larger than 100 MB.",
        ),
        notes=(
            "The formatter stopped before opening the document.",
            "The original manuscript was not uploaded or changed.",
            "Most of the size is usually pictures. In Word, click a picture, choose Picture Format, then Compress Pictures, pick 220 ppi for all pictures, save, and try again.",
        ),
        can_format=False,
        metrics=_empty_metrics(file_path, inspection_limited=True),
    )


def analyze_docx(path: str | Path) -> dict[str, Any]:
    file_path = Path(path)
    if not file_path.is_file():
        raise GateError(f"File not found: {file_path}")
    if file_path.suffix.lower() != ".docx":
        raise GateError("Choose a Microsoft Word .docx file.")
    if file_path.stat().st_size > MAX_FILE_SIZE_BYTES:
        raise GateError("Oversized files must be handled before analysis.")

    try:
        with zipfile.ZipFile(file_path, "r") as archive:
            names = archive.namelist()
            if "word/document.xml" not in names:
                raise GateError("This file is not a readable Word DOCX manuscript.")
            document_xml = archive.read("word/document.xml").decode("utf-8", "ignore")
            settings_xml = (
                archive.read("word/settings.xml").decode("utf-8", "ignore")
                if "word/settings.xml" in names else ""
            )
            # Tracked changes can live in footnotes, endnotes, headers and
            # footers too, and Word records moves and format changes with
            # their own tags. (Second review 2026-09-10.)
            revision_xml = document_xml + "".join(
                archive.read(name).decode("utf-8", "ignore")
                for name in names
                if re.fullmatch(r"word/(footnotes|endnotes|header\d+|footer\d+)\.xml", name, flags=re.I)
            )
    except zipfile.BadZipFile as exc:
        try:
            with open(file_path, "rb") as _fh:
                _head = _fh.read(8)
        except OSError:
            _head = b""
        if _head == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1":
            raise LockedFileError(
                "This file is locked with a password, or it is an older Word file "
                "saved under the new name. In Word, open it, then click File, then "
                "Info, then Protect Document, then Encrypt with Password. Delete the "
                "password so the box is empty and click OK. Then click File, then "
                "Save As, choose Word Document (.docx), save it, and choose that "
                "new copy here.") from exc
        raise GateError("This is not a valid DOCX file.") from exc
    except (KeyError, OSError) as exc:
        raise GateError(
            "The file could not be read. If it lives in OneDrive, right-click it "
            "and choose 'Always keep on this device', wait for it to download, "
            f"then try again. (Windows said: {exc})") from exc

    paragraphs = _parse_paragraphs(document_xml)
    sections = _parse_sections(document_xml, settings_xml)
    section_count = max(1, len(sections))

    # Only an inline drawing that holds a real picture counts as a picture. A
    # drawn shape such as a horizontal line is not one: LibreOffice writes every
    # horizontal-line scene break that way, and 66 of them in a real novel had
    # the book refused as a picture book (2026-09-24, test T8c).
    inline_images = sum(
        1 for block in re.findall(r'<wp:inline\b.*?</wp:inline>', document_xml, flags=re.S)
        if re.search(r'<pic:pic\b|<a:blip\b', block))
    floating_images = _count(document_xml, r'<(?:wp:)?anchor\b')
    legacy_images = _count(document_xml, r'<(?:v:)?imagedata\b')
    image_occurrences = inline_images + floating_images + legacy_images
    media_files = sum(1 for name in names if re.fullmatch(r"word/media/[^/]+", name, flags=re.I))

    explicit_page_breaks = 0
    column_breaks = 0
    for tag in re.findall(r'<(?:w:)?br\b[^>]*\/?\s*>', document_xml, flags=re.I):
        break_type = (_attr(tag, "type") or "textWrapping").lower()
        if break_type == "page":
            explicit_page_breaks += 1
        elif break_type == "column":
            column_breaks += 1
    page_break_before = _count(document_xml, r'<(?:w:)?pageBreakBefore\b')
    hard_page_controls = explicit_page_breaks + page_break_before

    instructions = [
        unescape(value)
        for value in re.findall(
            r'<(?:w:)?instrText\b[^>]*>([\s\S]*?)</(?:w:)?instrText>',
            document_xml,
            flags=re.I,
        )
    ]
    for tag in re.findall(r'<(?:w:)?fldSimple\b[^>]*>', document_xml, flags=re.I):
        instruction = _attr(tag, "instr")
        if instruction:
            instructions.append(instruction)
    field_blob = " ".join(instructions)

    max_columns = max([1] + [int(section.get("columns") or 1) for section in sections])
    odd_even_section_starts = sum(
        1 for section in sections
        if str(section.get("start_type", "")).lower() in {"oddpage", "evenpage"}
    )
    merged_cell_controls = (
        _count(document_xml, r'<(?:w:)?gridSpan\b')
        + _count(document_xml, r'<(?:w:)?vMerge\b')
    )

    # How many real chapter headings does this file have? A document whose
    # sections line up with actual headings is an ordinary book, not a file
    # whose page design is doing the work. Counted the same way the formatter
    # itself decides what a chapter is: a Heading 1 style, or an outline level
    # of zero. Added 2026-09-09.
    _heading_styles = re.findall(
        r'<(?:w:)?pStyle[^>]*w:val="([^"]+)"', document_xml)
    # Count PARAGRAPHS that are top-level headings: a Heading 1 style, or an
    # outline level of zero - once per paragraph, never both. (A Heading 1
    # paragraph often carries its own outlineLvl 0 as well.)
    chapter_headings = 0
    for _block in re.findall(r'<(?:w:)?p\b[^>]*>[\s\S]*?</(?:w:)?p>', document_xml, flags=re.I):
        _ppr = re.search(r'<(?:w:)?pPr\b[\s\S]*?</(?:w:)?pPr>', _block, flags=re.I)
        if not _ppr:
            continue
        _ppr_xml = _ppr.group(0)
        _style = re.search(r'<(?:w:)?pStyle[^>]*w:val="([^"]+)"', _ppr_xml)
        _is_h1 = bool(_style) and _style.group(1).replace(" ", "").lower() in (
            "heading1", "chaptertitle", "chapterheading", "chapter")
        _is_lvl0 = bool(re.search(r'<(?:w:)?outlineLvl[^>]*w:val="0"', _ppr_xml))
        if _is_h1 or _is_lvl0:
            chapter_headings += 1

    lower_heading_styles = sum(
        1 for _v in _heading_styles
        if re.fullmatch(r"heading[2-9]", _v.replace(" ", "").lower())
    )

    return {
        "file_name": file_path.name,
        "file_size_bytes": file_path.stat().st_size,
        "inspection_limited": False,
        "chapter_headings": chapter_headings,
        "lower_heading_styles": lower_heading_styles,
        "engine_chapters": None,
        "engine_chapter_titles": [],
        "engine_error": "",
        "paragraphs": paragraphs["count"],
        "nonempty_paragraphs": paragraphs["nonempty"],
        "blank_paragraphs": paragraphs["blank"],
        "layout_blank_paragraphs": paragraphs["layout_blank"],
        "layout_blank_ratio": round(paragraphs["layout_blank"] / max(1, paragraphs["count"]), 3),
        "estimated_words": _word_count(paragraphs["text"]),
        "image_occurrences": image_occurrences,
        "inline_images": inline_images,
        "floating_images": floating_images,
        "legacy_images": legacy_images,
        "media_files": media_files,
        "paragraphs_per_image": (
            round(paragraphs["nonempty"] / image_occurrences, 2)
            if image_occurrences else None
        ),
        "tables": _count(document_xml, r'<(?:w:)?tbl\b'),
        "max_table_columns": _max_table_columns(document_xml),
        "nested_tables": _nested_tables(document_xml),
        "merged_cell_controls": merged_cell_controls,
        "sections": section_count,
        "section_geometry": sections,
        "max_columns": max_columns,
        "odd_even_section_starts": odd_even_section_starts,
        "explicit_page_breaks": explicit_page_breaks,
        "page_break_before": page_break_before,
        "hard_page_controls": hard_page_controls,
        "column_breaks": column_breaks,
        "text_boxes": _count(document_xml, r'<(?:w:)?txbxContent\b'),
        "embedded_objects": _count(document_xml, r'<(?:w:)?object\b'),
        # Equations in footnotes and endnotes count too: one there was dropped
        # without a word (second blind audit D1, 2026-09-25).
        "equations": _count(revision_xml, r'<(?:m:)?oMath\b'),
        "charts": sum(1 for name in names if re.fullmatch(r"word/charts/.*\.xml", name, flags=re.I)),
        "diagrams": sum(1 for name in names if re.fullmatch(r"word/diagrams/.*\.xml", name, flags=re.I)),
        "linked_toc": bool(re.search(r'(^|\s)TOC(\s|$)', field_blob, flags=re.I)),
        "page_fields": len(re.findall(r'(^|\s)PAGE(\s|$)', field_blob, flags=re.I)),
        "hyperlinks": _count(document_xml, r'<(?:w:)?hyperlink\b'),
        "internal_hyperlinks": _count(document_xml, r'<(?:w:)?hyperlink\b[^>]*(?:w:)?anchor='),
        "bookmarks": _count(document_xml, r'<(?:w:)?bookmarkStart\b'),
        "headers": sum(1 for name in names if re.fullmatch(r"word/header\d+\.xml", name, flags=re.I)),
        "footers": sum(1 for name in names if re.fullmatch(r"word/footer\d+\.xml", name, flags=re.I)),
        "footnotes": "word/footnotes.xml" in names,
        "endnotes": "word/endnotes.xml" in names,
        "comments": "word/comments.xml" in names,
        "tracked_changes": bool(re.search(
            r'<(?:w:)?(?:ins|del|moveFrom|moveTo|rPrChange|pPrChange)\b', revision_xml, flags=re.I)),
    }


_ENGINE_CACHE: dict[str, Any] = {}


def _load_engine():
    """Find the RC7 formatting engine next to this file (or inside a frozen
    build) and import it read-only, once. Returns (module_or_None, error_text).
    Loaded quietly: a --windowed .exe has no stdout, so any print during the
    import would otherwise crash the load and hide the engine."""
    if "module" in _ENGINE_CACHE:
        return _ENGINE_CACHE["module"], _ENGINE_CACHE["error"]
    import contextlib
    import importlib.util
    import io
    import sys
    candidates = [Path(__file__).resolve().parent]
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        candidates.append(Path(meipass))
    module, error = None, "engine file kdp_format_RC7_safe_candidate.py not found next to the gate"
    for folder in candidates:
        engine_file = folder / "kdp_format_RC7_safe_candidate.py"
        if not engine_file.is_file():
            continue
        try:
            spec = importlib.util.spec_from_file_location("_kdp_gate_engine", engine_file)
            candidate = importlib.util.module_from_spec(spec)
            sys.modules["_kdp_gate_engine"] = candidate
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                spec.loader.exec_module(candidate)
            if not hasattr(candidate, "parse_manuscript"):
                error = "engine loaded but has no parse_manuscript"
            else:
                module, error = candidate, ""
        except Exception as exc:  # noqa: BLE001 - reported, never hidden
            sys.modules.pop("_kdp_gate_engine", None)
            error = f"{type(exc).__name__}: {exc}"
        break
    _ENGINE_CACHE["module"], _ENGINE_CACHE["error"] = module, error
    return module, error


_PART_HEADING = re.compile(
    r"^(part|book|volume)\s+([ivxlcdm]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b", re.I)


def count_engine_chapters(path: str | Path) -> dict[str, Any]:
    """Ask the formatter's OWN parser how many chapters it will find.

    The gate must agree with the engine, so the count comes from the same code
    that will build the book - never from a separate guess. Added 2026-09-10
    after the gate passed a book with zero headings as COMPATIBLE.
    Returns {"available": bool, "chapters": int, "titles": [..]}."""
    engine, error = _load_engine()
    if engine is None:
        return {"available": False, "chapters": 0, "titles": [], "error": error}
    try:
        import contextlib
        import io
        from docx import Document
        doc = Document(str(path))
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            blocks = engine.parse_manuscript(doc)
        titles, empty = [], []
        for block in blocks:
            if not isinstance(block, dict):
                raise TypeError(f"engine block is {type(block).__name__}, not a dict")
            if block.get("type") == "chapter":
                title = str(block.get("title", "")).strip()
                titles.append(title)
                # A heading with no text under it before the next heading opens
                # UNTICKED in the Chapter Outline window (Gemini ruling B,
                # 2026-10-23). A Part heading is the exception: it gets its own
                # Part page, so it stays ticked.
                has_text = any(
                    (str(getattr(p, "text", "") or "").strip() or getattr(p, "images", None))
                    and not getattr(p, "is_scene_break", False)
                    for p in block.get("paragraphs") or [])
                if title and not has_text and not _PART_HEADING.match(title):
                    empty.append(len(titles))
        return {"available": True, "chapters": len(titles), "titles": titles,
                "empty": empty, "error": ""}
    except Exception as exc:  # noqa: BLE001 - reported, never hidden
        return {"available": False, "chapters": 0, "titles": [],
                "error": f"{type(exc).__name__}: {exc}"}


BACK_MATTER_TYPES = ("about the author", "acknowledgments", "acknowledgements",
                    "also by", "epilogue", "afterword")
FRONT_MATTER_TYPES = ("title", "title page", "copyright", "dedication",
                      "table of contents", "contents", "preface",
                      "introduction", "foreword", "prologue")


def preflight_summary_text(path, result=None, pages=None):
    """Say in plain English what the program found in someone's book.

    Gemini ruled on 2026-09-19 that the buyer must see this BEFORE anything is
    built. The test that produced the ruling had a first-time author say the one
    change that would stop her asking for her money back was being shown what
    the program thought her book was, because she could not see it any other
    way until a printed proof landed on her kitchen table.
    Every line here comes from the formatter's OWN reading of the file, so the
    list she is shown is the book she will get.
    """
    found = count_engine_chapters(path)
    lines = []
    if not found.get("available"):
        return ("The program could not read this book well enough to show you "
                "what is in it. Nothing has been created.")

    titles = [t for t in found.get("titles", []) if t]
    # Gemini ruling 2026-10-22: a sure tone, not a timid one (Mike).
    lines.append("Here is the outline of your book.")
    lines.append("")
    lines.append("CHAPTERS I FOUND (%d):" % len(titles))
    for i, title in enumerate(titles, 1):
        lines.append("   %d. %s" % (i, title))
    if not titles:
        lines.append("   (none)")
    lines.append("")
    lines.append("If a chapter is missing, or a line above is not a chapter, press")
    lines.append("Cancel. Open your book in Word, fix that line, save it, and choose")
    lines.append("the file again. A chapter title works best as a short line on its")
    lines.append("own, in bold, in the middle of the line.")

    metrics = getattr(result, "metrics", {}) if result is not None else {}
    already = []
    if metrics.get("linked_toc") or metrics.get("manual_toc"):
        already.append("a contents page")
    if already:
        lines.append("")
        lines.append("ALREADY IN YOUR FILE: " + ", ".join(already) + ".")

    dropping = []
    # A deliberate second font is common: a typed letter in Courier, a diary
    # entry in another face. Every one of them is set in the book font, and
    # until 2026-09-19 nothing said so. Measured that day: Courier New and
    # Georgia both came back as Times New Roman with no word to the author.
    try:
        from docx import Document as _D
        _doc = _D(str(path))
        try:
            _default_font = _doc.styles["Normal"].font.name
        except Exception:
            _default_font = None
        _fonts = set()
        for _p in _doc.paragraphs:
            if _p.style is not None and _p.style.name.startswith("Heading"):
                continue          # a heading is meant to look different
            for _r in _p.runs:
                if _r.font.name and _r.text.strip():
                    _fonts.add(_r.font.name)
        # Two named styles, or one named style that is not the book's own
        # default, both mean the author chose a second look on purpose.
        _extra = {f for f in _fonts if f != _default_font}
        if len(_fonts) > 1 or _extra:
            _n = len(_fonts | ({_default_font} if _default_font else set()))
            dropping.append(
                "your choice of %d different lettering styles. The whole book is "
                "set in one book font, because Amazon needs a font that prints "
                "cleanly at book size" % max(2, _n))
    except Exception:
        pass
    if metrics.get("text_boxes"):
        _n = metrics["text_boxes"]
        dropping.append("the words inside your text box" if _n == 1 else
                        "the words inside your %d text boxes" % _n)
    # Tables are kept as real tables with a line round every cell (fixed
    # 2026-09-22), so nothing about them is dropped. The old line here said
    # the lines were dropped, which was no longer true (2026-10-19).
    if metrics.get("headers") or metrics.get("footers"):
        dropping.append("your own page headers and footers, replaced by the book's own")
    if dropping:
        lines.append("")
        lines.append("WHAT WILL NOT COME THROUGH:")
        for d in dropping:
            lines.append("   - " + d)

    # The square-bracket warning for ticked pages was deleted 2026-10-19
    # (Gemini G7): a ticked page the author never wrote is now skipped and
    # named in the finished window, so no bracket line can be printed.

    lines.append("")
    lines.append("Your own file is never changed, whatever you choose.")
    return "\n".join(lines)


def evaluate_metrics(metrics: dict[str, Any]) -> GateResult:
    refuse: list[str] = []
    review: list[str] = []
    notes: list[str] = []
    # Refusals about the manuscript's STRUCTURE (no chapters, tracked changes,
    # no text) get a plain summary; the "existing page design" summary is only
    # for layout refusals. Found 2026-09-10 when the chapter refusal printed
    # "appears to depend on its existing page design", which was untrue.
    structural: list[str] = []

    def add(target: list[str], condition: bool, message: str) -> None:
        if condition and message not in target:
            target.append(message)

    hard_controls = metrics["hard_page_controls"]
    sections = metrics["sections"]
    # TRUE when the sections are simply chapters. Every rule that treats "many
    # sections" as suspicious is switched off for these files, because that is
    # what every already-formatted paperback in the world looks like -- this
    # formatter's own output included. Without this the tool refused its own
    # finished books and two of the five real trial manuscripts.
    looks_like_a_book = (
        metrics.get("chapter_headings", 0) >= 2
        and metrics.get("chapter_headings", 0) >= sections - 3
        and metrics["text_boxes"] == 0
        and metrics["floating_images"] == 0
        and metrics["max_columns"] <= 1
    )
    estimated_words = metrics["estimated_words"]
    words_per_page_control = estimated_words / hard_controls if hard_controls else None
    words_per_section = estimated_words / sections if sections else None

    # Empty or unreadable text: nothing to format. Ruled by Gemini 2026-09-10.
    add(structural,
        metrics["nonempty_paragraphs"] == 0 or estimated_words == 0,
        "No readable text was found in this file. Open it in Word and check that "
        "the manuscript is really there, then save it again as a .docx file.")
    # Chapters. The formatter needs at least two chapters to number the body
    # from Chapter 1 and to start every chapter on a right-hand page - both
    # HARD rules in the AGREED SPEC. One heading alone cannot be told apart
    # from a title page or a dedication. Ruled by Gemini and a second model
    # 2026-09-10. The count comes from the engine's own parser when it is
    # available, so the gate and the book never disagree.
    # Only the engine's own count may REFUSE. The XML count sees styled
    # headings only (never a bold centred line), so if the engine could not
    # run, or the two counts disagree by more than one, the buyer gets REVIEW
    # with a plain note - never a refusal built on a guess. (Second review,
    # 2026-09-10.)
    engine_chapters = metrics.get("engine_chapters")
    xml_chapters = metrics.get("chapter_headings", 0)
    chapter_count_uncertain: str | None = None
    # A file the program cannot even OPEN is not an uncertain book, it is an
    # unusable file, and it must be refused. Until 2026-09-19 a password
    # protected or damaged file came back as "Formats, with a warning" and told
    # the buyer to carry on, with the raw words "BadZipFile: Bad magic number
    # for file header" printed on screen. Measured that day on a real file.
    _err = str(metrics.get("engine_error") or "")
    _unopenable = any(w in _err for w in (
        "BadZipFile", "Bad magic number", "not a zip file", "File is not a zip",
        "PackageNotFoundError", "Package not found", "password", "Password",
        "encrypt", "Encrypt",
        # A damaged inside, such as a stray "&nbsp;" (blind audit B6,
        # 2026-09-25): the gate said "Formats" and the run then died.
        "XMLSyntaxError", "not defined", "not well-formed", "mismatched tag",
        "Opening and ending tag", "Premature end", "invalid token", "ParseError"))
    if engine_chapters is None and _unopenable:
        refuse.append(
            "This file could not be opened. If you put a password on it, remove "
            "the password in Word under File, then Info, then Protect Document, "
            "and save. Otherwise open it in Word and use File, then Save As, to "
            "save a fresh copy, and choose that copy.")
    elif engine_chapters is None:
        chapter_count_uncertain = (
            "The chapter count could not be confirmed. Check that every chapter "
            "starts on its own page in the finished book before you upload it.")
    elif engine_chapters < 2 <= xml_chapters:
        chapter_count_uncertain = (
            f"The formatter found {engine_chapters} chapter(s) but the file has "
            f"{xml_chapters} Heading 1 paragraphs. Check the finished book's chapter "
            "starts before uploading.")
    if estimated_words > 0 and engine_chapters is not None and engine_chapters < 2 \
            and chapter_count_uncertain is None:
        if engine_chapters == 0:
            chapter_line = "No chapter headings were found."
        else:
            chapter_line = "Only one chapter was found, and one is not enough."
        if xml_chapters == 0 and metrics.get("lower_heading_styles", 0) > 0:
            fix_line = (
                "Your chapter titles use Heading 2 or a lower heading style. Change "
                "each chapter title to Heading 1 and re-upload.")
        else:
            fix_line = (
                "Make every chapter title either a paragraph styled Heading 1, or a "
                "short line that is bold and centred, then re-upload. The book needs at "
                "least two chapters.")
        add(structural, True, f"{chapter_line} {fix_line}")
    # TRACKED CHANGES ARE ACCEPTED, NOT REFUSED (R7, second audit 2026-09-22).
    # The gate used to send the buyer back to Word, although the engine's own
    # accept_tracked_changes() already handles them: measured on the same file,
    # it kept all eight insertions and built a clean 22-page book with nothing
    # unaccounted. Refusing a file the program formats correctly is a dead end
    # for no reason, so the buyer is told what was done instead.
    add(notes, bool(metrics["tracked_changes"]),
        "This file has tracked changes in it. They are treated as accepted, "
        "exactly as Word's Review > Accept All Changes would, so the edited "
        "wording is what goes into your book. If you wanted the original "
        "wording instead, reject the changes in Word first and choose the "
        "file again.")
    add(refuse, metrics["text_boxes"] > 0,
        f'{metrics["text_boxes"]} text box(es) in the file. Words inside a box '
        "are not carried over. In Word, cut the words out of each box, paste "
        "them into the ordinary text, delete the box, and save.")
    add(refuse, metrics["max_columns"] > 1 or metrics["column_breaks"] > 0,
        "Your text is laid out in columns. In Word, select the text, go to "
        "Layout > Columns > One, then save and choose the file again.")
    add(refuse, metrics["floating_images"] > 0,
        "A picture is floating on the page instead of sitting in the text. "
        "Right-click each picture in Word, choose Wrap Text, then In Line with "
        "Text, and save.")
    add(refuse,
        metrics["embedded_objects"] > 0 or metrics["charts"] > 0 or metrics["diagrams"] > 0,
        "The file holds a chart, a drawing or an embedded object. Those cannot "
        "be carried into a paperback. In Word, replace each one with an "
        "ordinary picture (right-click it, Copy, then Paste Special as a "
        "Picture), and save.")
    add(refuse, metrics["equations"] > 0,
        "The file holds Word equations, which cannot be carried into a "
        "paperback. Replace each one with an ordinary picture of it and save.")
    add(refuse, metrics["image_occurrences"] >= 12,
        f'Too many pictures for this tool: {metrics["image_occurrences"]}. '
        "Remove the extra pictures, or lay this book out in Word yourself.")
    # Gemini ruling 2026-10-19: the old limit of three tables refused Mike's
    # own Count of Souls draft (six simple tables). Simple tables are kept up
    # to 25; only a table too wide for a paperback page, or a table inside a
    # table, is refused.
    add(refuse, metrics["tables"] > 25,
        f'Too many tables for this tool: {metrics["tables"]}. This tool '
        "handles up to 25 simple tables. Remove the "
        "extra tables, or lay this book out in Word yourself.")
    add(refuse, metrics.get("max_table_columns", 0) > 8,
        f'A table has {metrics.get("max_table_columns", 0)} columns, too wide for a '
        "paperback page. Split it into narrower tables, or turn it into a picture, and save.")
    add(refuse, metrics.get("nested_tables", 0) >= 1,
        "A table sits inside another table, which cannot be carried over. In Word, "
        "take the inner table out and put it after the outer one, and save.")
    add(refuse, metrics["merged_cell_controls"] >= 1,
        "A table has merged cells, which cannot be carried over. In Word, "
        "unmerge them (select the cells, then Layout > Merge > Split Cells) or "
        "retype that table as ordinary paragraphs, and save.")
    # Odd/even page starts on their own are NOT a reason to refuse. They are
    # the most ordinary thing in a book that has already been formatted for
    # print once - including a book this very formatter produced. Refusing them
    # meant the tool rejected its own output, so an author who formatted at
    # 6x9 and then wanted the same book in large print was turned away. That is
    # the exact customer this product is sold to. Found 2026-09-09 by running
    # the tool's own finished book back through its own safety check.
    # They only matter alongside the things that really do risk losing content:
    # hand-placed pictures, tables, or dense forced page controls.
    add(refuse,
        metrics["odd_even_section_starts"] >= 4 and (
            metrics["image_occurrences"] >= 3
            or metrics["tables"] >= 2
            or hard_controls >= 10
        ),
        f'{metrics["odd_even_section_starts"]} odd/even-page section starts, together with '
        f'hand-placed pictures, tables or forced page breaks, mean this file depends on its '
        f'existing page design.')
    # A NOTE, not a review stop. Review blocks the file from being formatted at
    # all, and "your book was already laid out once" is not a reason to refuse
    # to work: this formatter throws every old section and footer away and
    # builds new ones. The buyer is simply told what happened.
    add(notes,
        metrics["odd_even_section_starts"] >= 4 and not (
            metrics["image_occurrences"] >= 3
            or metrics["tables"] >= 2
            or hard_controls >= 10
        ),
        "This book has already been laid out for print once. It will be rebuilt "
        "from scratch, so check the finished file before uploading.")

    add(refuse,
        hard_controls >= 20 and words_per_page_control is not None and words_per_page_control < 800,
        f"There are {hard_controls} forced page breaks for very little text, "
        "so these pages look hand-built. In Word, turn on Show/Hide, remove "
        "the page breaks you do not need, and save.")
    add(refuse,
        (not looks_like_a_book) and sections >= 8 and (
            metrics["image_occurrences"] >= 3
            or hard_controls >= 8
            or (words_per_section is not None and words_per_section < 800)
        ),
        f"This book is built with {sections} section breaks that set up its "
        "pages. Quick Formatter builds the pages itself, so those fight it. In "
        "Word, turn on Show/Hide, delete the Section Breaks, use an ordinary "
        "Page Break where you want a new page, and save.")
    add(refuse,
        metrics["image_occurrences"] >= 6 and hard_controls >= 6,
        "Pictures in this book are placed on purpose, page by page. Quick "
        "Formatter moves text around and would break that. Lay a book like "
        "this out in Word yourself.")
    add(refuse,
        metrics["image_occurrences"] >= 4 and metrics["layout_blank_paragraphs"] >= 20,
        "Pictures here are positioned with blank lines, so the pages are "
        "hand-built. Quick Formatter reflows the text and would break them. "
        "Lay a book like this out in Word yourself.")
    add(refuse,
        (not looks_like_a_book) and sections >= 4 and hard_controls >= 10 and (
            metrics["image_occurrences"] >= 2
            or (words_per_page_control is not None and words_per_page_control < 1000)
        ),
        "The pages of this book are hand-built with section and page breaks. "
        "Quick Formatter builds the pages itself, so it would break yours. "
        "Lay a book like this out in Word yourself.")
    add(refuse,
        metrics["linked_toc"] and (
            metrics["image_occurrences"] >= 3
            or (sections >= 4 and hard_controls >= 6)
            or (metrics["bookmarks"] >= 8 and metrics["image_occurrences"] >= 2)
        ),
        "This book has a clickable contents page tied to a hand-built layout. "
        "Quick Formatter makes its own contents page and would break the "
        "links. Lay a book like this out in Word yourself.")
    add(refuse,
        metrics["image_occurrences"] >= 5
        and metrics["paragraphs_per_image"] is not None
        and metrics["paragraphs_per_image"] < 12,
        "This is mostly pictures with little text - a picture book, not a "
        "novel. Quick Formatter lays out running text. Lay a book like this "
        "out in Word yourself.")
    add(refuse,
        metrics["layout_blank_paragraphs"] >= 30
        and metrics["layout_blank_ratio"] >= 0.25
        and (
            metrics["image_occurrences"] >= 3
            or (hard_controls >= 5 and words_per_page_control is not None and words_per_page_control < 1000)
        ),
        "Blank lines are being used to push things around the page, so these "
        "pages are hand-built. Quick Formatter reflows the text and would "
        "break them. Lay a book like this out in Word yourself.")

    if not refuse and not structural:
        add(review, chapter_count_uncertain is not None and estimated_words > 0,
            chapter_count_uncertain or "")
        add(review, metrics["image_occurrences"] >= 6,
            f'This book has {metrics["image_occurrences"]} pictures. Look at every '
            "picture in the finished book before you upload it.")
        add(review,
            hard_controls >= 10 and words_per_page_control is not None and words_per_page_control < 1200,
            f"{hard_controls} forced page controls are fairly dense for the amount of text.")
        # One section per chapter is what an already-formatted book looks like,
        # and this formatter rebuilds every section anyway. A single picture
        # used to be enough to stop the job; it is not a risk on its own.
        add(review,
            (not looks_like_a_book) and sections >= 5 and (
                metrics["image_occurrences"] >= 3
                or (words_per_section is not None and words_per_section < 1500)
            ),
            f"{sections} sections need review.")
        add(review, metrics["tables"] >= 2,
            f'{metrics["tables"]} tables. Each is kept as a real table with a line '
            "round every cell - look at those pages in the finished book.")
        add(review,
            estimated_words >= 1500 and metrics["nonempty_paragraphs"] <= 3,
            "There is a lot of text in very few paragraphs. Look at those pages "
            "in the finished book before you upload it.")

    # Footnotes and endnotes used to be thrown away, and this line used to say
    # so. Since 2026-09-21 they are carried into the finished book, so it says
    # what actually happens to them.
    add(notes, bool(metrics["footnotes"] or metrics["endnotes"]),
        "This book has footnotes or endnotes. Every word of them is kept: they "
        "are printed as numbered notes under a \"Notes\" heading at the back of "
        "the book, and a small raised number is left in the text where each one "
        "was. They no longer sit at the foot of the page - nothing for you to do.")
    add(notes, bool(metrics["comments"]),
        "Comments were found. They are never printed, so they are left out of "
        "the finished book - nothing for you to do.")
    add(notes, metrics["headers"] > 0 or metrics["footers"] > 0,
        "Your headers and footers will be replaced with the paperback's own "
        "page numbers. If a header held something you need, move it into the "
        "body in Word first.")
    add(notes, metrics["hyperlinks"] > 0,
        f'{metrics["hyperlinks"]} web link(s). The words stay, but the link '
        "itself is removed - paper cannot be clicked.")
    add(notes, 1 <= metrics["image_occurrences"] <= 5,
        f'{metrics["image_occurrences"]} picture(s) sit in the text and will be '
        "kept.")
    add(notes, metrics["tables"] == 1,
        "One table. It is kept as a real table with a line round every cell. "
        "Look at those pages in the finished book.")
    add(notes, metrics["linked_toc"],
        "Your clickable contents page will be replaced with a fresh one. Check "
        "it in Word once the book is made.")
    add(notes,
        hard_controls >= 10 and words_per_page_control is not None and words_per_page_control >= 1200,
        "Your chapter page breaks look normal for the amount of text, so they "
        "will be rebuilt as proper chapter starts.")

    if structural or refuse:
        # A file that cannot be opened gets its own plain summary. It was
        # borrowing "your pages are already laid out by hand", which says
        # nothing about a locked or damaged file (2026-09-19).
        if any("could not be opened" in r for r in refuse):
            summary = ("This file could not be opened, so nothing could be read "
                       "from it yet.")
        elif structural and not refuse:
            summary = "This manuscript cannot be formatted yet. Fix the item below and try again."
        elif refuse and not structural:
            summary = ("This book's pages are already laid out by hand, so Quick "
                       "Formatter cannot rebuild them safely.")
        else:
            summary = ("This manuscript cannot be formatted yet. There is something to "
                       "fix in Word, and its pages are also already laid out by hand.")
        return GateResult(
            status="NOT_COMPATIBLE",
            label="Not compatible with Quick Formatter",
            summary=summary,
            reasons=tuple(structural + refuse),
            notes=tuple(notes),
            can_format=False,
            metrics=metrics,
        )
    if review:
        # REVIEW lets the buyer go ahead. Blocking under a softer name was the
        # same dead end as a refusal. Ruled by Gemini 2026-09-10.
        return GateResult(
            status="REVIEW",
            label="Formats, with a warning",
            summary=("This file can be formatted, but it has features that need a careful "
                     "look in the finished book before you upload it to Amazon."),
            reasons=tuple(review),
            notes=tuple(notes),
            can_format=True,
            metrics=metrics,
        )
    return GateResult(
        status="COMPATIBLE",
        label="File structure is compatible",
        summary="The document structure appears suitable for Quick Formatter.",
        reasons=(),
        notes=tuple(notes),
        can_format=True,
        metrics=metrics,
    )


def check_manuscript_path(path: str | Path) -> GateResult:
    file_path = Path(path)
    if not file_path.is_file():
        raise GateError(f"File not found: {file_path}")
    if file_path.suffix.lower() != ".docx":
        raise GateError("Choose a Microsoft Word .docx file.")
    if file_path.stat().st_size > MAX_FILE_SIZE_BYTES:
        return oversized_result(file_path)
    try:
        metrics = analyze_docx(file_path)
    except GateError as exc:
        # An unreadable file is a verdict, not a crash. Ruled by Gemini 2026-09-10.
        return GateResult(
            status="NOT_COMPATIBLE",
            label="Not compatible with Quick Formatter",
            summary="This file could not be read as a Word document.",
            reasons=(
                (str(exc),) if isinstance(exc, LockedFileError) else
                (f"{exc} Open the manuscript in Microsoft Word and use File > Save As "
                 "to save a fresh .docx copy, then choose that copy.",)
            ),
            notes=("The original file was not changed.",),
            can_format=False,
            metrics=_empty_metrics(file_path, inspection_limited=True),
        )
    engine_count = count_engine_chapters(file_path)
    if engine_count["available"]:
        metrics["engine_chapters"] = engine_count["chapters"]
        metrics["engine_chapter_titles"] = engine_count["titles"]
    else:
        metrics["engine_error"] = engine_count.get("error", "")
    return evaluate_metrics(metrics)


SUPPORT_EMAIL = "2brokeyoopers@gmail.com"

# A short reference for each kind of refusal, so a buyer's email says which one
# they hit without them having to describe it. Added 2026-09-18 on Gemini's
# ruling G3-3: a refusal with no way to reach a human is a refund, and one with
# a reference is a bug report.
_REASON_CODES = (
    ("larger than 100 mb", "ERR_TOO_LARGE"),
    ("no chapter headings", "ERR_NO_CHAPTERS"),
    ("only one chapter", "ERR_ONE_CHAPTER"),
    ("heading 2", "ERR_HEADING_LEVEL"),
    ("tracked changes", "ERR_TRACKED_CHANGES"),
    ("columns", "ERR_COLUMNS"),
    ("floating on the page", "ERR_FLOATING_IMAGE"),
    ("too many pictures", "ERR_TOO_MANY_PICTURES"),
    ("mostly pictures", "ERR_PICTURE_BOOK"),
    ("positioned with blank lines", "ERR_BLANK_POSITIONING"),
    ("section breaks", "ERR_SECTION_BREAKS"),
    ("forced page breaks", "ERR_PAGE_BREAKS"),
    ("merged cells", "ERR_MERGED_TABLE"),
    ("extra tables", "ERR_TOO_MANY_TABLES"),
    ("equations", "ERR_EQUATIONS"),
    ("text box", "ERR_TEXTBOX"),
    ("not a valid docx", "ERR_NOT_DOCX"),
    ("locked with a password", "ERR_PASSWORD"),
    ("a chart, a drawing", "ERR_EMBEDDED_OBJECT"),
    ("no readable text", "ERR_NO_TEXT"),
    ("could not be opened", "ERR_CANNOT_OPEN"),
)


def reason_code(reason: str) -> str:
    """The short reference printed with a refusal, so support knows which one."""
    low = (reason or "").lower()
    for phrase, code in _REASON_CODES:
        if phrase in low:
            return code
    return "ERR_OTHER"


def paid_result_text(result: GateResult) -> str:
    lines = [result.label, result.summary]
    if result.reasons:
        lines.extend(["", "Why:"] + [f"- {reason}" for reason in result.reasons])
    if result.notes:
        lines.extend(["", "Notes:"] + [f"- {note}" for note in result.notes])
    if not result.can_format:
        lines.extend(["", "No formatted file was created. The original was not changed."])
        codes = list(dict.fromkeys(reason_code(r) for r in result.reasons)) or ["ERR_OTHER"]
        lines.extend([
            "",
            f"Stuck, or think this is wrong? Email {SUPPORT_EMAIL} and we will",
            "help you get it working, or refund your $19.99. Copy this whole",
            "message into the email, including this reference: " + ", ".join(codes),
        ])
    elif result.status == "REVIEW":
        lines.extend(["", "You can continue. Open the finished file and check every page before uploading."])
    return "\n".join(lines)


def print_paid_gate_result(result: GateResult) -> None:
    print("\nKDP Quick Formatter safety check")
    print("=" * 38)
    print(paid_result_text(result))
    if result.can_format:
        print("\nSafety gate passed. Formatting may continue.")


if __name__ == "__main__":
    import argparse
    import json
    parser = argparse.ArgumentParser(description="Read-only KDP formatter compatibility gate")
    parser.add_argument("docx")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    try:
        gate_result = check_manuscript_path(args.docx)
    except GateError as exc:
        print(f"ERROR: {exc}")
        raise SystemExit(2)
    if args.json:
        print(json.dumps(gate_result.to_dict(), indent=2))
    else:
        print_paid_gate_result(gate_result)
    raise SystemExit(0 if gate_result.can_format else 3)
