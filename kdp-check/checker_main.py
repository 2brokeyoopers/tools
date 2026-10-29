"""checker_main.py - the free KDP check, run in the reader's own browser.

It joins two read-only parts:
  kdp_preflight_gate.py  - the paid KDP Quick Formatter's own safety check,
                           byte for byte, with engine_reader.py standing in for
                           the engine so chapters are found exactly as the paid
                           program finds them;
  kdp_amazon_risks.py    - what Amazon KDP may reject or flag.
Nothing here writes to the manuscript, and nothing is sent anywhere.
"""
import json
import kdp_preflight_gate as gate
import kdp_amazon_risks as risks

FORMATTER_URL = "https://payhip.com/b/16Nra"


def check(path, display_name=None):
    try:
        result = gate.check_manuscript_path(path)
    except gate.GateError as exc:
        return json.dumps({"ok": False, "error": str(exc)})
    data = result.to_dict()
    metrics = data.pop("metrics")
    chapters = metrics.get("engine_chapters") or 0
    out = {
        "ok": True,
        "file_name": display_name or metrics.get("file_name"),
        "formatter": {
            "status": data["status"], "label": data["label"], "summary": data["summary"],
            "reasons": data["reasons"], "notes": data["notes"], "can_format": data["can_format"],
            "codes": sorted({gate.reason_code(r) for r in data["reasons"]}) if not data["can_format"] else [],
        },
        "book": {
            "chapters": metrics.get("engine_chapters"),
            "chapter_titles": metrics.get("engine_chapter_titles") or [],
            "words": metrics.get("estimated_words", 0),
            "pictures": metrics.get("image_occurrences", 0),
            "tables": metrics.get("tables", 0),
        },
        "amazon": {"pages_estimate": 0, "findings": []},
        "versions": {"gate": gate.GATE_VERSION, "risks": risks.RISKS_VERSION},
        "formatter_url": FORMATTER_URL,
    }
    if not metrics.get("inspection_limited"):
        try:
            amazon = risks.amazon_risks(path, chapters)
            # The file name check must see the reader's own file name, not the
            # temporary name it was saved under inside the browser.
            if display_name and display_name != path.split("/")[-1]:
                amazon["findings"] = [f for f in amazon["findings"] if f["code"] != "KDP_FILE_NAME"]
                import re
                if re.search(r"[^\x20-\x7E]", display_name):
                    amazon["findings"].append(risks._finding(
                        "KDP_FILE_NAME", "A18", "WARN", "The file name has unusual characters",
                        "Amazon rejects file names with emoji or unsupported characters.",
                        "Rename the file using only plain letters, numbers, spaces and dashes.",
                        False, "SAVE"))
            out["amazon"] = amazon
        except Exception as exc:  # noqa: BLE001 - shown to the reader, never hidden
            out["amazon"] = {"pages_estimate": 0, "findings": [], "error": f"{type(exc).__name__}: {exc}"}
    return json.dumps(out, ensure_ascii=False)
