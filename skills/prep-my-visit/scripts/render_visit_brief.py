#!/usr/bin/env python3
"""
prep-my-visit: render an IPS visit-prep package into print-ready PDFs.

Takes one IPS Bundle JSON (FHIR R4 document Bundle with a Composition first
entry) and one lab-opportunities JSON, and writes two typeset PDFs:

  1. provider.pdf - a clinician-grade pre-visit summary. Dense, high-signal,
     1-2 pages. Structurally modeled after an Epic After-Visit-Summary /
     Visit-Snapshot document: a branded header band, solid section header
     bars, striped clinical tables (problems, medications, allergies,
     vitals), and a footer band. Burgundy is the single accent color.
  2. patient.pdf - a patient-facing visit-prep companion. Same clinical
     document language, looser density, plain-language goals, what-to-bring
     checklist, discuss-with-doctor lab questions, and optional portal
     snippet drafts marked "review before sending".

Branding is My Aria, not Epic. The wordmark renders as uniform styled text
("My Aria", single ink color - no two-tone). Burgundy is reserved for the
header accent rule, "High" pills, the patient-story rule, and the review
callout. No Epic logo, no MyChart logo, no Epic blue, no text suggesting an
Epic-affiliated origin. This is defensible structural homage to a familiar
clinical document, not a copy.

Typesetting is HTML + CSS rendered by WeasyPrint (no headless browser).
Type is a sans-serif clinical stack (the same family the Aria app uses):
ui-sans-serif / system-ui / Segoe UI / Roboto / Helvetica Neue / Arial,
resolved by WeasyPrint to the best available host font. No serif body type.

Privacy: this script reads PHI from the bundle and writes it into the PDFs
only. On any failure it prints a generic, PHI-free error to stderr and
never echoes bundle or lab contents - PHI must not leak into logs.

License: Apache-2.0 (inherited from the Tula repository).

Usage:
    python3 render_visit_brief.py --bundle <ips-bundle.json> \
        --labs <lab-opportunities.json> --out <dir>
    python3 render_visit_brief.py --bundle <b.json> --out <dir> --provider-only
    python3 render_visit_brief.py --bundle <b.json> --labs <l.json> \
        --out <dir> --patient-only

Stdout: a JSON report {status, files[], notes[]}. Exit 0 on success.
On failure: JSON error on stderr (no PHI), exit 1.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import html
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

WORDMARK_FIRST = "My"
WORDMARK_SECOND = "Aria"
DOC_VERSION = "v1.0"

# Aria brand palette, resolved from apps/my-aria/app/globals.css light-mode
# tokens to print-safe hex (WeasyPrint 61 oklch support is uneven; hex is
# exact and portable). Burgundy is the single accent.
BURGUNDY = "#9B1C2C"        # --color-accent  oklch(0.46 0.16 18). SPARING:
                            # only the header accent rule, lab High pill,
                            # patient-story left-rule, and review callout.
INFO_BLUE = "#2F6FB0"       # --color-info, appointment metadata only
INK = "#1E2227"             # --color-fg  oklch(0.20 0.010 264)
MUTED = "#646A72"           # --color-fg-muted
SUBTLE = "#8A9099"          # --color-fg-subtle
HAIR = "#E3E5E8"            # --color-border oklch(0.91 0.005 264)
STRIPE = "#F5F6F7"          # table zebra row
BAND_GRAY = "#F4F4F6"       # header / section-bar / footer band (achromatic)
RULE_GRAY = "#C9CCD1"       # section-bar edge + table header underline
MONO = ('"DejaVu Sans Mono", ui-monospace, SFMono-Regular, Menlo, '
        'Consolas, "Liberation Mono", monospace')


# --------------------------------------------------------------------------
# small helpers
# --------------------------------------------------------------------------

def esc(value) -> str:
    if value is None:
        return ""
    return html.escape(str(value))


def _get(node, *path, default=None):
    for part in path:
        if isinstance(node, dict):
            node = node.get(part)
        elif isinstance(node, list) and isinstance(part, int) and 0 <= part < len(node):
            node = node[part]
        else:
            return default
        if node is None:
            return default
    return node


def _fmt_date(value) -> str:
    """ISO date or datetime -> 'June 9, 2026'. Falls back to raw string."""
    if not value:
        return ""
    raw = str(value).replace("Z", "")
    try:
        if "T" in raw:
            d = _dt.datetime.fromisoformat(raw).date()
        else:
            d = _dt.date.fromisoformat(raw[:10])
        return d.strftime("%B %-d, %Y")
    except (ValueError, TypeError):
        return str(value)


def _fmt_datetime(value) -> str:
    """ISO datetime -> 'Tuesday, June 9, 2026 at 10:30 AM'."""
    if not value:
        return ""
    raw = str(value).replace("Z", "")
    try:
        if "T" in raw:
            dt = _dt.datetime.fromisoformat(raw)
            return dt.strftime("%A, %B %-d, %Y at %-I:%M %p")
        return _fmt_date(value)
    except (ValueError, TypeError):
        return str(value)


def _age_on(birth, ref) -> str:
    try:
        b = _dt.date.fromisoformat(str(birth)[:10])
    except (ValueError, TypeError):
        return ""
    try:
        r = _dt.date.fromisoformat(str(ref)[:10])
    except (ValueError, TypeError):
        r = _dt.date.today()
    years = r.year - b.year - ((r.month, r.day) < (b.month, b.day))
    return f"{years}y" if years >= 0 else ""


def _strip_ns(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


# --------------------------------------------------------------------------
# IPS Bundle parsing
# --------------------------------------------------------------------------

class Brief:
    """Flattened, render-ready view of an IPS Bundle + lab opportunities."""

    def __init__(self, bundle: dict, labs: dict | None):
        entries = [e.get("resource", {}) for e in bundle.get("entry", []) if isinstance(e, dict)]
        self.by_type: dict[str, list] = {}
        for r in entries:
            self.by_type.setdefault(r.get("resourceType"), []).append(r)

        self.composition = self._first("Composition")
        self.patient = self._first("Patient")
        self.encounter = self._first("Encounter")
        self.practitioner = self._first("Practitioner")
        self.labs = labs or {}
        self.sections = self._index_sections()

    def _first(self, rtype: str) -> dict:
        items = self.by_type.get(rtype, [])
        return items[0] if items else {}

    def _all(self, rtype: str) -> list:
        return self.by_type.get(rtype, [])

    # -- composition narrative -------------------------------------------

    def _index_sections(self) -> dict:
        out = {}
        for sec in self.composition.get("section", []) or []:
            title = (sec.get("title") or _get(sec, "code", "text") or "").strip()
            if title:
                out[title.lower()] = sec
        return out

    def section_items(self, title: str) -> list[str]:
        """Return <li> texts (or <p> texts if no list) for a named section."""
        sec = self.sections.get(title.lower())
        if not sec:
            return []
        div = _get(sec, "text", "div")
        if not div:
            return []
        items_li, items_p = [], []
        try:
            root = ET.fromstring(div)
        except ET.ParseError:
            plain = re.sub("<[^>]+>", " ", div)
            plain = html.unescape(re.sub(r"\s+", " ", plain)).strip()
            return [plain] if plain else []
        for el in root.iter():
            tag = _strip_ns(el.tag)
            text = "".join(el.itertext()).strip()
            if not text:
                continue
            if tag == "li":
                items_li.append(text)
            elif tag == "p":
                items_p.append(text)
        return items_li if items_li else items_p

    def section_text(self, title: str) -> str:
        return " ".join(self.section_items(title)).strip()

    # -- patient / visit identity ----------------------------------------

    def patient_name(self) -> str:
        names = self.patient.get("name", [])
        if names:
            n = names[0]
            if n.get("text"):
                return n["text"]
            given = " ".join(n.get("given", []))
            return f"{given} {n.get('family', '')}".strip()
        return ""

    def patient_dob(self) -> str:
        return _fmt_date(self.patient.get("birthDate"))

    def patient_age(self) -> str:
        birth = self.patient.get("birthDate")
        if not birth:
            return ""
        return _age_on(birth, _get(self.encounter, "period", "start"))

    def patient_id(self) -> str:
        for ident in self.patient.get("identifier", []):
            if ident.get("value"):
                return ident["value"]
        return ""

    def visit_type(self) -> str:
        return _get(self.encounter, "type", 0, "text") or "Office visit"

    def visit_when(self) -> str:
        return _fmt_datetime(_get(self.encounter, "period", "start"))

    def visit_location(self) -> str:
        return _get(self.encounter, "location", 0, "location", "display") or ""

    def clinician(self) -> str:
        names = self.practitioner.get("name", []) if self.practitioner else []
        if names:
            n = names[0]
            if n.get("text"):
                return n["text"]
            return f"{' '.join(n.get('prefix', []))} {n.get('family', '')}".strip()
        return ""

    def clinician_specialty(self) -> str:
        return _get(self.practitioner, "qualification", 0, "code", "text") or ""

    # -- structured clinical tables (with narrative fallback) ------------

    @staticmethod
    def _active(resource: dict) -> bool:
        codes = _get(resource, "clinicalStatus", "coding", default=[]) or []
        if not codes:
            return True
        return any(c.get("code") == "active" for c in codes)

    def problems(self) -> list[dict]:
        rows = []
        for c in self._all("Condition"):
            if not self._active(c):
                continue
            rows.append({
                "name": _get(c, "code", "text") or "Condition",
                "confirmed": c.get("recordedDate") or c.get("onsetDateTime") or "",
            })
        rows.sort(key=lambda r: str(r["confirmed"]), reverse=True)
        return rows

    def medications(self) -> list[dict]:
        rows = []
        for m in self._all("MedicationStatement"):
            if m.get("status") and m["status"] not in ("active", "intended", "unknown"):
                continue
            full = _get(m, "medicationCodeableConcept", "text") or "Medication"
            strength = ""
            mm = re.search(r"\b\d[\d.]*\s?(?:mg|mcg|g|ml|units?|%)\b", full, re.I)
            if mm:
                strength = mm.group(0)
                name = full[:mm.start()].strip(" ,-")
            else:
                name = full
            rows.append({
                "name": name or full,
                "strength": strength,
                "sig": _get(m, "dosage", 0, "text") or "",
                "indication": _get(m, "reasonCode", 0, "text") or "",
                "started": _fmt_date(_get(m, "effectivePeriod", "start")),
            })
        return rows

    def medication_names(self) -> list[str]:
        out = []
        for r in self.medications():
            label = r["name"]
            if r["strength"]:
                label = f"{label} {r['strength']}"
            out.append(label)
        if not out:
            # narrative fallback (sparse bundle)
            return [t for t in self.section_items("Medication Summary")]
        return out

    def allergies(self) -> list[dict]:
        rows = []
        for a in self._all("AllergyIntolerance"):
            rows.append({
                "substance": _get(a, "code", "text") or "Substance",
                "reaction": _get(a, "reaction", 0, "manifestation", 0, "text") or "",
                "severity": _get(a, "reaction", 0, "severity") or a.get("criticality") or "",
            })
        return rows

    def vitals(self) -> list[dict]:
        """Collapse vital-sign Observations into per-date rows."""
        by_date: dict[str, dict] = {}
        for o in self._all("Observation"):
            cats = _get(o, "category", 0, "coding", default=[]) or []
            if cats and not any(c.get("code") == "vital-signs" for c in cats):
                continue
            day = str(o.get("effectiveDateTime") or o.get("effectiveInstant") or "")[:10]
            row = by_date.setdefault(day, {"date": _fmt_date(day)})
            label = (_get(o, "code", "text") or "").lower()
            comps = o.get("component", [])
            if comps:
                vals = {}
                for c in comps:
                    cl = (_get(c, "code", "text") or "").lower()
                    v = _get(c, "valueQuantity", "value")
                    if v is not None:
                        vals[cl] = v
                if "systolic" in vals and "diastolic" in vals:
                    row["bp"] = f"{vals['systolic']:g}/{vals['diastolic']:g}"
            else:
                v = _get(o, "valueQuantity", "value")
                unit = _get(o, "valueQuantity", "unit") or ""
                if v is None:
                    continue
                if "heart" in label or "pulse" in label:
                    row["hr"] = f"{v:g} {unit}".strip()
                elif "weight" in label:
                    row["weight"] = f"{v:g} {unit}".strip()
        rows = [by_date[d] for d in sorted(by_date, reverse=True)]
        return [r for r in rows if len(r) > 1][:3]

    # -- lab opportunities -----------------------------------------------

    def category_a(self) -> list[dict]:
        return self.labs.get("categoryA", []) or []

    def category_b(self) -> list[dict]:
        return self.labs.get("categoryB", []) or []

    def snippets(self) -> list[str]:
        out = []
        for item in self.category_b():
            if item.get("snippet"):
                out.append(item["snippet"])
        for s in self.labs.get("snippets", []) or []:
            if isinstance(s, str):
                out.append(s)
            elif isinstance(s, dict) and s.get("text"):
                out.append(s["text"])
        return out


# --------------------------------------------------------------------------
# shared stylesheet
# --------------------------------------------------------------------------

def base_css(band_h: str, side: str, foot_h: str, body_size: str, gap: str) -> str:
    return f"""
@page {{
  size: Letter;
  margin: {band_h} 0 {foot_h} 0;
  @bottom-center {{
    content: "Page " counter(page) " of " counter(pages);
    font-family: {MONO};
    font-size: 6.8pt;
    letter-spacing: 0.01em;
    color: {SUBTLE};
    vertical-align: middle;
  }}
}}
* {{ box-sizing: border-box; }}
html {{ -weasy-hyphens: none; }}
body {{
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  color: {INK};
  font-size: {body_size};
  line-height: 1.4;
  margin: 0;
  orphans: 3;
  widows: 3;
}}

/* --- repeating header / footer bands (running elements) ------------ */
.band {{
  background: {BAND_GRAY};
  padding: 0 {side};
  box-sizing: border-box;
}}
.band-top {{
  position: fixed;
  top: -{band_h};          /* rise into the reserved top margin */
  left: 0; right: 0;       /* L/R page margins are 0 -> full bleed */
  height: {band_h};
  border-bottom: 2.5pt solid {BURGUNDY};   /* the single accent rule */
}}
.band-top table {{ width: 100%; height: {band_h}; border-collapse: collapse; }}
.band-top td {{ vertical-align: middle; }}
.band-bottom {{
  position: fixed;
  bottom: -{foot_h};       /* drop into the reserved bottom margin */
  left: 0; right: 0;
  height: {foot_h};
  border-top: 0.75pt solid {HAIR};
  font-family: {MONO};
  font-size: 6.8pt;
  letter-spacing: 0.01em;
  color: {SUBTLE};
}}
.band-bottom table {{ width: 100%; height: {foot_h}; border-collapse: collapse; }}
.band-bottom td {{ vertical-align: middle; }}
.wordmark {{
  font-size: 20pt;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1;
}}
.wordmark .one {{ color: {INK}; font-weight: 700; }}
.wordmark .two {{ color: {INK}; font-weight: 700; }}  /* uniform wordmark */
.doc-subtitle {{
  font-family: {MONO};
  font-size: 7.5pt;
  letter-spacing: 0.04em;
  color: {MUTED};
  margin-top: 5pt;
}}
.idblock {{ text-align: right; font-size: 8.5pt; line-height: 1.5; color: {INK}; }}
.idblock .pname {{ font-weight: 700; font-size: 11pt; }}
.idblock .muted {{ color: {MUTED}; }}
.idblock .appt {{ color: {INFO_BLUE}; font-weight: 600; }}
.foot-right {{ text-align: right; white-space: nowrap; }}

/* --- content frame -------------------------------------------------- */
.content {{
  padding: 16pt {side} 14pt {side};
}}

/* --- section header bars -------------------------------------------- */
.sec {{ break-inside: avoid; margin-top: {gap}; }}
.sec.first {{ margin-top: 0; }}
.bar {{
  background: {BAND_GRAY};
  color: {INK};
  border-left: 3pt solid {RULE_GRAY};
  font-size: 8.5pt;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 4pt 9pt;
}}
.sec-body {{ padding: 8pt 1pt 0 1pt; }}

/* context strip + patient story */
.strip-label {{
  font-size: 7.5pt; font-weight: 700; letter-spacing: 0.14em;
  text-transform: uppercase; color: {MUTED}; margin-bottom: 5pt;
}}
.goals-strip {{
  background: {STRIPE};
  border-left: 3pt solid {RULE_GRAY};
  padding: 9pt 14pt;
}}
.goals-strip ul {{ margin: 0; padding-left: 16pt; }}
.goals-strip li {{ margin: 3pt 0; }}
.story {{
  border-left: 3pt solid {BURGUNDY};
  padding: 3pt 0 3pt 13pt;
  margin: {gap} 0 0 0;
  line-height: 1.5;
}}

/* --- clinical tables ------------------------------------------------ */
table.clin {{
  width: 100%; border-collapse: collapse;
  font-size: 9pt; border: 1pt solid {HAIR};
}}
table.clin th {{
  background: #fff; text-align: left;
  font-size: 7.5pt; letter-spacing: 0.07em; text-transform: uppercase;
  color: {MUTED}; font-weight: 700;
  padding: 5pt 8pt; border-bottom: 1pt solid {RULE_GRAY};
}}
table.clin td {{
  padding: 5pt 8pt; border-bottom: 0.5pt solid {HAIR}; vertical-align: top;
}}
table.clin tr:nth-child(even) td {{ background: {STRIPE}; }}
table.clin tr:last-child td {{ border-bottom: none; }}
td.med-name {{ font-weight: 600; }}
.nowrap {{ white-space: nowrap; }}

/* --- lists ---------------------------------------------------------- */
ul.tight {{ margin: 0; padding-left: 16pt; }}
ul.tight li {{ margin: 4pt 0; line-height: 1.4; }}
.lab-cat {{
  font-size: 7.5pt; font-weight: 700; letter-spacing: 0.10em;
  text-transform: uppercase; color: {MUTED}; margin: 0 0 5pt 0;
}}
.pill {{
  display: inline-block; background: {BURGUNDY}; color: #fff;
  font-size: 6.5pt; font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase; padding: 1pt 5pt; border-radius: 7pt;
  margin-left: 5pt; vertical-align: middle;
}}
.lab-cat.b {{ margin-top: 9pt; }}
.cite {{ color: {MUTED}; font-size: 8pt; }}
.lab-item {{ margin: 0 0 7pt 0; line-height: 1.4; }}
.lab-item .q {{ font-weight: 600; }}

/* --- patient-facing extras ----------------------------------------- */
.snippet {{
  border: 1pt solid {HAIR};
  background: {STRIPE}; padding: 9pt 12pt; margin: 8pt 0;
  font-size: 9.5pt; line-height: 1.5;
}}
.review-flag {{
  color: {BURGUNDY}; font-size: 7.5pt; font-weight: 700;
  letter-spacing: 0.10em; text-transform: uppercase; margin-bottom: 4pt;
}}
.note {{ color: {MUTED}; font-size: 9pt; margin: 0 0 6pt 0; }}
"""


# --------------------------------------------------------------------------
# HTML fragments
# --------------------------------------------------------------------------

def _wordmark(subtitle: str) -> str:
    return (
        '<div class="brandblock">'
        f'<div class="wordmark"><span class="one">{esc(WORDMARK_FIRST)}</span> '
        f'<span class="two">{esc(WORDMARK_SECOND)}</span></div>'
        f'<div class="doc-subtitle">{esc(subtitle)}</div>'
        '</div>'
    )


def _header_band(subtitle: str, id_rows: list[str]) -> str:
    return (
        '<div class="band band-top"><table><tr>'
        f'<td>{_wordmark(subtitle)}</td>'
        f'<td class="idblock">{"".join(id_rows)}</td>'
        '</tr></table></div>'
    )


def _footer_band(left: str, right: str) -> str:
    return (
        '<div class="band band-bottom"><table><tr>'
        f'<td>{esc(left)}</td>'
        f'<td class="foot-right">{esc(right)}</td>'
        '</tr></table></div>'
    )


def _section(title: str, body_html: str, first: bool = False) -> str:
    if not body_html:
        return ""
    cls = "sec first" if first else "sec"
    return (
        f'<div class="{cls}"><div class="bar">{esc(title)}</div>'
        f'<div class="sec-body">{body_html}</div></div>'
    )


def _ul(items: list[str], cls: str = "tight") -> str:
    if not items:
        return ""
    lis = "".join(f"<li>{esc(i)}</li>" for i in items)
    return f'<ul class="{cls}">{lis}</ul>'


def _lab_item(x: dict) -> str:
    cite = x.get("citation", {})
    cite_s = ""
    if cite.get("guideline"):
        cite_s = f' <span class="cite">({esc(cite["guideline"])}'
        if cite.get("version"):
            cite_s += f", {esc(cite['version'])}"
        cite_s += ")</span>"
    q = x.get("guidance") or x.get("rationale") or x.get("test", "")
    pill = f'<span class="pill">{esc(x["flag"])}</span>' if x.get("flag") else ""
    return f'<div class="lab-item"><span class="q">{esc(q)}</span>{pill}{cite_s}</div>'


# --------------------------------------------------------------------------
# provider PDF
# --------------------------------------------------------------------------

def build_provider_html(b: Brief, generated: str) -> str:
    css = base_css(band_h="108pt", side="46pt", foot_h="30pt", body_size="10pt", gap="13pt")

    clin = b.clinician()
    if clin and b.clinician_specialty():
        clin = f"{clin} · {b.clinician_specialty()}"

    id_rows = [f'<div class="pname">{esc(b.patient_name())}</div>']
    meta = []
    if b.patient_dob():
        dob = b.patient_dob()
        if b.patient_age():
            dob += f" ({b.patient_age()})"
        meta.append(f"DOB {esc(dob)}")
    if b.patient_id():
        meta.append(f"ID {esc(b.patient_id())}")
    if meta:
        id_rows.append(f'<div class="muted">{" &nbsp;·&nbsp; ".join(meta)}</div>')
    if b.visit_when():
        id_rows.append(f'<div class="appt">{esc(b.visit_when())}</div>')
    line2 = [x for x in [b.visit_type(), b.visit_location()] if x]
    if line2:
        id_rows.append(f'<div class="muted">{esc(" · ".join(line2))}</div>')
    if clin:
        id_rows.append(f'<div class="muted">{esc(clin)}</div>')

    header = _header_band("Pre-Visit Summary", id_rows)
    parts = []
    first = True

    goals = b.section_items("Goals for this visit")
    if goals:
        parts.append(
            f'<div class="sec {"first" if first else ""}">'
            '<div class="strip-label">Visit Reason / Goals</div>'
            f'<div class="goals-strip">{_ul(goals)}</div></div>'
        )
        first = False

    story = b.section_text("Patient Story")
    if story:
        parts.append(f'<div class="story">{esc(story)}</div>')
        first = False

    probs = b.problems()
    if probs:
        body = ['<table class="clin"><thead><tr><th>Problem</th>'
                '<th class="nowrap">Last confirmed</th></tr></thead><tbody>']
        for p in probs:
            body.append(
                f'<tr><td class="med-name">{esc(p["name"])}</td>'
                f'<td class="nowrap">{esc(_fmt_date(p["confirmed"]))}</td></tr>'
            )
        body.append("</tbody></table>")
        parts.append(_section("Problem List", "".join(body), first))
        first = False
    elif b.section_items("Problem List"):
        parts.append(_section("Problem List", _ul(b.section_items("Problem List")), first))
        first = False

    meds = b.medications()
    if meds:
        body = ['<table class="clin"><thead><tr><th>Medication</th><th>Strength</th>'
                '<th>Sig</th><th>Indication</th><th class="nowrap">Started</th>'
                '</tr></thead><tbody>']
        for m in meds:
            body.append(
                f'<tr><td class="med-name">{esc(m["name"])}</td>'
                f'<td class="nowrap">{esc(m["strength"])}</td>'
                f'<td>{esc(m["sig"])}</td>'
                f'<td>{esc(m["indication"])}</td>'
                f'<td class="nowrap">{esc(m["started"])}</td></tr>'
            )
        body.append("</tbody></table>")
        parts.append(_section("Medications", "".join(body)))
    elif b.section_items("Medication Summary"):
        parts.append(_section("Medications", _ul(b.section_items("Medication Summary"))))

    allergies = b.allergies()
    if allergies:
        body = ['<table class="clin"><thead><tr><th>Substance</th><th>Reaction</th>'
                '<th>Severity</th></tr></thead><tbody>']
        for a in allergies:
            body.append(
                f'<tr><td class="med-name">{esc(a["substance"])}</td>'
                f'<td>{esc(a["reaction"])}</td>'
                f'<td>{esc((a["severity"] or "").title())}</td></tr>'
            )
        body.append("</tbody></table>")
        parts.append(_section("Allergies", "".join(body)))
    elif b.section_items("Allergies and Intolerances"):
        parts.append(_section("Allergies", _ul(b.section_items("Allergies and Intolerances"))))

    lab_html = []
    cat_a = b.category_a()
    if cat_a:
        lab_html.append('<div class="lab-cat">Category A · standing orders pending</div>')
        a_items = []
        for x in cat_a:
            line = x.get("test", "Lab")
            tail = []
            if x.get("orderingProvider"):
                tail.append(f"ordered by {x['orderingProvider']}")
            if x.get("orderDate"):
                tail.append(_fmt_date(x["orderDate"]))
            if tail:
                line += f" ({'; '.join(tail)})"
            if x.get("action"):
                line += f" - {x['action']}"
            pill = f'  <span class="pill">{esc(x["flag"])}</span>' if x.get("flag") else ""
            a_items.append(esc(line) + pill)
        # a_items hold escaped text plus trusted pill markup; emit raw <li>.
        lab_html.append(
            '<ul class="tight">' + "".join(f"<li>{i}</li>" for i in a_items) + "</ul>"
        )
    cat_b = b.category_b()
    if cat_b:
        cls = "lab-cat b" if cat_a else "lab-cat"
        lab_html.append(f'<div class="{cls}">Category B · discuss with doctor</div>')
        for x in cat_b:
            lab_html.append(_lab_item(x))
    if lab_html:
        parts.append(_section("Pre-Visit Lab Opportunities", "".join(lab_html)))

    delta = b.section_items("Delta Since Last Visit With This Provider")
    if delta:
        parts.append(_section("Delta Since Last Visit", _ul(delta)))

    vitals = b.vitals()
    if vitals:
        body = ['<table class="clin"><thead><tr><th class="nowrap">Date</th>'
                '<th>BP (mmHg)</th><th>HR</th><th>Weight</th></tr></thead><tbody>']
        for v in vitals:
            body.append(
                f'<tr><td class="nowrap">{esc(v.get("date", ""))}</td>'
                f'<td>{esc(v.get("bp", "—"))}</td>'
                f'<td>{esc(v.get("hr", "—"))}</td>'
                f'<td>{esc(v.get("weight", "—"))}</td></tr>'
            )
        body.append("</tbody></table>")
        parts.append(_section("Recent Vitals", "".join(body)))

    disc = b.section_items("Top Discussion Items")
    if disc:
        parts.append(_section("Top Discussion Items", _ul(disc)))

    footer = _footer_band(
        "Generated by Tula - for clinician pre-visit context, not a clinical document of record.",
        f"Pre-Visit Summary · {generated} · {DOC_VERSION}",
    )
    return _doc(css, header + f'<div class="content">{"".join(parts)}</div>' + footer)


# --------------------------------------------------------------------------
# patient PDF
# --------------------------------------------------------------------------

def build_patient_html(b: Brief, generated: str) -> str:
    css = base_css(band_h="94pt", side="54pt", foot_h="30pt", body_size="10.5pt", gap="16pt")

    id_rows = [f'<div class="pname">For {esc(b.patient_name())}</div>']
    if b.visit_when():
        id_rows.append(f'<div class="appt">{esc(b.visit_when())}</div>')
    if b.clinician():
        id_rows.append(f'<div class="muted">Seeing {esc(b.clinician())}</div>')
    if b.visit_location():
        id_rows.append(f'<div class="muted">{esc(b.visit_location())}</div>')

    header = _header_band("Your Visit Prep", id_rows)
    parts = []
    first = True

    goals = b.section_items("Goals for this visit")
    if goals:
        parts.append(_section("Your Goals For This Visit",
                              f'<div class="goals-strip">{_ul(goals)}</div>', first))
        first = False

    bring = ["Your insurance card and a photo ID", "A list of any questions you want to ask"]
    med_names = b.medication_names()
    if med_names:
        bring.append("Your current medication list: " + ", ".join(med_names))
    disc_items = b.section_items("Top Discussion Items")
    if disc_items:
        bring.append("Any notes or a symptom log about what you'd like to discuss")
    parts.append(_section("What To Bring", _ul(bring), first))
    first = False

    if disc_items:
        parts.append(_section("Things To Mention To Your Doctor", _ul(disc_items)))

    cat_b = b.category_b()
    if cat_b:
        parts.append(_section("Lab Questions To Consider Asking",
                              "".join(_lab_item(x) for x in cat_b)))

    snips = b.snippets()
    if snips:
        body = ['<div class="review-flag">Review before sending - not auto-sent</div>']
        for s in snips:
            body.append(f'<div class="snippet">{esc(s)}</div>')
        parts.append(_section("Optional Portal Snippets", "".join(body)))

    footer = _footer_band(
        "Tula prep for your visit - this is not medical advice, just a way to walk in prepared.",
        f"Your Visit Prep · {generated}",
    )
    return _doc(css, header + f'<div class="content">{"".join(parts)}</div>' + footer)


def _doc(css: str, body: str) -> str:
    return (
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
        f'<style>{css}</style></head><body>{body}</body></html>'
    )


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Render an IPS visit-prep package into provider/patient PDFs."
    )
    parser.add_argument("--bundle", required=True, help="Path to IPS Bundle JSON")
    parser.add_argument("--labs", default=None, help="Path to lab-opportunities JSON")
    parser.add_argument("--out", required=True, help="Output directory for PDFs")
    parser.add_argument("--provider-only", action="store_true", help="Render only provider.pdf")
    parser.add_argument("--patient-only", action="store_true", help="Render only patient.pdf")
    args = parser.parse_args()

    try:
        from weasyprint import HTML
    except Exception:
        print(json.dumps({
            "status": "error",
            "error": "weasyprint is not installed. Install with: pip install --user weasyprint",
        }), file=sys.stderr)
        return 1

    try:
        try:
            bundle = json.loads(Path(args.bundle).read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            raise ValueError("bundle is not valid JSON")
        if not isinstance(bundle, dict) or bundle.get("resourceType") != "Bundle":
            raise ValueError("bundle must be a FHIR Bundle resource")

        labs = None
        if args.labs:
            try:
                labs = json.loads(Path(args.labs).read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                raise ValueError("labs is not valid JSON")
            if not isinstance(labs, dict):
                raise ValueError("labs file must be a JSON object")

        brief = Brief(bundle, labs)
        if not brief.composition:
            raise ValueError("bundle has no Composition entry")
        if not brief.patient_name():
            raise ValueError("bundle is missing a Patient name")

        out_dir = Path(args.out)
        out_dir.mkdir(parents=True, exist_ok=True)
        generated = _dt.datetime.now().strftime("%b %-d, %Y %-I:%M %p")

        files = []
        if not args.patient_only:
            p = out_dir / "provider.pdf"
            HTML(string=build_provider_html(brief, generated), base_url=".").write_pdf(str(p))
            files.append(str(p))
        if not args.provider_only:
            p = out_dir / "patient.pdf"
            HTML(string=build_patient_html(brief, generated), base_url=".").write_pdf(str(p))
            files.append(str(p))

    except ValueError as exc:
        print(json.dumps({"status": "error", "error": str(exc)}), file=sys.stderr)
        return 1
    except Exception as exc:
        print(json.dumps({
            "status": "error",
            "error": f"rendering failed ({type(exc).__name__})",
        }), file=sys.stderr)
        return 1

    print(json.dumps({"status": "ok", "files": files, "notes": []}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
