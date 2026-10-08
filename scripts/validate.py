#!/usr/bin/env python3
"""
validate.py — enforces the METADATA_SCHEMA.md "Validation rules" against every
chapter and engineering doc listed in manifest.yaml.

Checks (see METADATA_SCHEMA.md "Validation rules"):
  1. id regex, id matches filename prefix, id+path+status exist in manifest.yaml.
  2. prerequisites/related_ids exist in manifest; prerequisite graph is acyclic;
     no self-reference.
  3. title equals the file's single H1; exactly one H1.
  4. summary <= 60 words; keywords has 5-12 lowercase entries.
  5. every inline footnote key `[^slug]` has a matching frontmatter sources[].key
     and vice versa.
  7. last_reviewed is not in the future; overdue-for-review (per volatility
     cadence) is reported as a WARNING, never a failure.

Also (not numbered in METADATA_SCHEMA.md, but required for a usable corpus):
  - every relative .md link in a file resolves to a file that exists on disk,
    or to a path listed in manifest.yaml.

tutor_docs are only checked for existence (METADATA_SCHEMA.md's rules are
scoped to modules/ + engineering/; tutor/ is a derived/compiled layer per
CONVENTIONS.md and its ids don't match the id regex in rule 1).

The BASELINE mechanism (bottom of this file) can park known pre-existing
violations as warnings while a human decides what to do with them. It is
currently empty: every violation found when this script was first run has been
fixed in the content, so any violation now fails the build.

This script never writes to any file. It only reads.

Usage:
  python3 scripts/validate.py
Exit code: 1 if any non-baselined violation is found, 0 otherwise.
"""
import os
import re
import sys
from datetime import date

try:
    import yaml
except ImportError:
    print("ERROR: PyYAML is required (pip install pyyaml)", file=sys.stderr)
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST_PATH = os.path.join(ROOT, "manifest.yaml")
TODAY = date.today()  # wall-clock date; last_reviewed must not be after this

ID_RE = re.compile(r"^(fnd|api|rag|agt|evl|prd|sec|ftn|fro|eng)-\d{2}$")
FRONTMATTER_RE = re.compile(r"^---\n(.*?\n)---\n(.*)$", re.S)
H1_RE = re.compile(r"^#\s+(.+?)\s*$", re.M)
FOOTNOTE_DEF_RE = re.compile(r"(?m)^\[\^([A-Za-z0-9_-]+)\]:")
FOOTNOTE_REF_RE = re.compile(r"\[\^([A-Za-z0-9_-]+)\](?!:)")
FOOTNOTE_TIER_RE = re.compile(r"(?m)^\[\^([A-Za-z0-9_-]+)\]:\s*\[T(\d)")
MD_LINK_RE = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")

CADENCE_DAYS = {"evergreen": 365, "mixed": 182, "volatile": 91}


# ---------------------------------------------------------------- reporting

class Report:
    def __init__(self):
        self.errors = []      # list of (rule, file, message)
        self.warnings = []    # list of (rule, file, message) -- real warnings (rule 7 cadence)
        self.baseline = []    # list of (rule, file, message) -- known pre-existing, downgraded

    def error(self, rule, file, message):
        self.errors.append((rule, file, message))

    def warn(self, rule, file, message):
        self.warnings.append((rule, file, message))

    def baselined(self, rule, file, message):
        self.baseline.append((rule, file, message))


def is_baselined(rule, file, message):
    for brule, bfile, bmsg_prefix in BASELINE:
        if rule == brule and file == bfile and message.startswith(bmsg_prefix):
            return True
    return False


def raise_violation(report, rule, file, message):
    """Route a violation to errors, or to the baseline bucket if it's a known
    pre-existing issue (see BASELINE at the bottom of this file)."""
    if is_baselined(rule, file, message):
        report.baselined(rule, file, message)
    else:
        report.error(rule, file, message)


# ---------------------------------------------------------------- manifest

def load_manifest():
    with open(MANIFEST_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data


def rel(path):
    return os.path.relpath(path, ROOT)


# ---------------------------------------------------------------- frontmatter

def split_frontmatter(text, filepath, report):
    m = FRONTMATTER_RE.match(text)
    if not m:
        report.error("frontmatter", rel(filepath), "file has no --- frontmatter block")
        return None, text
    fm_text, body = m.group(1), m.group(2)
    try:
        fm = yaml.safe_load(fm_text)
    except yaml.YAMLError as e:
        report.error("frontmatter", rel(filepath), f"frontmatter is not valid YAML: {e}")
        return None, body
    if not isinstance(fm, dict):
        report.error("frontmatter", rel(filepath), "frontmatter did not parse to a mapping")
        return None, body
    return fm, body


# ---------------------------------------------------------------- rule checks

def check_rule1(doc_id, entry_path, entry_status, filepath, fm, report):
    """id regex, id matches filename prefix, id/path/status match manifest."""
    fp = rel(filepath)
    if not ID_RE.match(doc_id):
        raise_violation(report, "rule1", fp, f"manifest id '{doc_id}' does not match {ID_RE.pattern}")

    basename = os.path.basename(entry_path)
    if not basename.startswith(doc_id + "-"):
        raise_violation(report, "rule1", fp,
                         f"filename '{basename}' does not start with id prefix '{doc_id}-'")

    if fm is None:
        return
    fm_id = fm.get("id")
    if fm_id != doc_id:
        raise_violation(report, "rule1", fp,
                         f"frontmatter id '{fm_id}' does not match manifest id '{doc_id}'")
    fm_status = fm.get("status")
    if fm_status != entry_status:
        raise_violation(report, "rule1", fp,
                         f"frontmatter status '{fm_status}' does not match manifest status '{entry_status}'")


def check_rule2(doc_id, fm, all_ids, report, filepath):
    """prerequisites/related_ids exist in manifest; no self-reference.
    (Acyclic check happens globally in check_acyclic.)"""
    fp = rel(filepath)
    if fm is None:
        return
    for field in ("prerequisites", "related_ids"):
        ids = fm.get(field) or []
        if not isinstance(ids, list):
            raise_violation(report, "rule2", fp, f"'{field}' is not a list")
            continue
        for pid in ids:
            if pid == doc_id:
                raise_violation(report, "rule2", fp, f"'{field}' lists itself ('{pid}')")
            elif pid not in all_ids:
                raise_violation(report, "rule2", fp, f"'{field}' references unknown id '{pid}'")


def check_acyclic(prereq_graph, report):
    """DFS cycle detection over the prerequisite graph (manifest-wide, once)."""
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {node: WHITE for node in prereq_graph}
    cycle_found = []

    def dfs(node, stack):
        color[node] = GRAY
        stack.append(node)
        for nxt in prereq_graph.get(node, []):
            if nxt not in color:
                continue  # unknown id already reported by check_rule2
            if color[nxt] == GRAY:
                idx = stack.index(nxt)
                cycle_found.append(stack[idx:] + [nxt])
                return True
            if color[nxt] == WHITE:
                if dfs(nxt, stack):
                    return True
        stack.pop()
        color[node] = BLACK
        return False

    for node in list(prereq_graph):
        if color[node] == WHITE:
            if dfs(node, []):
                break

    if cycle_found:
        cycle = cycle_found[0]
        raise_violation(report, "rule2", "manifest.yaml",
                         "prerequisite cycle detected: " + " -> ".join(cycle))


def check_rule3(fm, body, filepath, report):
    """title equals the single H1; exactly one H1."""
    fp = rel(filepath)
    h1s = H1_RE.findall(body)
    if len(h1s) == 0:
        raise_violation(report, "rule3", fp, "no H1 (# heading) found in body")
        return
    if len(h1s) > 1:
        raise_violation(report, "rule3", fp, f"{len(h1s)} H1 headings found, expected exactly 1")
    if fm is not None:
        title = fm.get("title")
        if h1s[0] != title:
            raise_violation(report, "rule3", fp,
                             f"H1 '{h1s[0]}' does not match frontmatter title '{title}'")


def check_rule4(fm, filepath, report):
    """summary <= 60 words; keywords 5-12 entries, lowercase."""
    fp = rel(filepath)
    if fm is None:
        return
    summary = fm.get("summary") or ""
    word_count = len(summary.split())
    if word_count > 60:
        raise_violation(report, "rule4", fp, f"summary is {word_count} words, must be <= 60")

    keywords = fm.get("keywords")
    if not isinstance(keywords, list):
        raise_violation(report, "rule4", fp, "keywords is missing or not a list")
        return
    if not (5 <= len(keywords) <= 12):
        raise_violation(report, "rule4", fp, f"keywords has {len(keywords)} entries, must be 5-12")
    for kw in keywords:
        if not isinstance(kw, str) or kw != kw.lower():
            raise_violation(report, "rule4", fp, f"keyword '{kw}' is not lowercase")


def check_rule5(fm, body, filepath, report):
    """every inline [^key] has a matching frontmatter sources[].key, and vice versa."""
    fp = rel(filepath)
    inline_keys = set(FOOTNOTE_REF_RE.findall(body))
    def_keys = set(FOOTNOTE_DEF_RE.findall(body))

    if fm is None:
        return
    sources = fm.get("sources") or []
    source_keys = set()
    for s in sources:
        if isinstance(s, dict) and "key" in s:
            source_keys.add(s["key"])

    for k in sorted(inline_keys - source_keys):
        raise_violation(report, "rule5", fp, f"inline footnote '[^{k}]' has no matching sources[].key")
    for k in sorted(source_keys - inline_keys):
        raise_violation(report, "rule5", fp, f"sources[].key '{k}' is never referenced inline as [^{k}]")

    # Definitions under ## Sources should also line up with frontmatter, since
    # CONVENTIONS §5 says the frontmatter list mirrors the footnote definitions.
    for k in sorted(def_keys - source_keys):
        raise_violation(report, "rule5", fp, f"footnote definition '[^{k}]:' has no matching sources[].key")
    for k in sorted(source_keys - def_keys):
        raise_violation(report, "rule5", fp, f"sources[].key '{k}' has no footnote definition under ## Sources")

    # The [T#] tag on each definition must match the frontmatter tier.
    tiers = {s["key"]: s.get("tier") for s in sources if isinstance(s, dict) and "key" in s}
    for k, t in FOOTNOTE_TIER_RE.findall(body):
        if k in tiers and tiers[k] is not None and str(tiers[k]) != t:
            raise_violation(report, "rule5", fp, f"footnote '[^{k}]' is tagged [T{t}] but frontmatter says tier {tiers[k]}")


def check_rule7(fm, filepath, report):
    """last_reviewed not in the future (error); overdue per cadence (warning)."""
    fp = rel(filepath)
    if fm is None:
        return
    lr = fm.get("last_reviewed")
    if lr is None:
        raise_violation(report, "rule7", fp, "last_reviewed is missing")
        return
    if not isinstance(lr, date):
        raise_violation(report, "rule7", fp, f"last_reviewed '{lr}' is not a valid ISO date")
        return
    if lr > TODAY:
        raise_violation(report, "rule7", fp, f"last_reviewed '{lr}' is in the future")
        return

    volatility = fm.get("volatility")
    cadence = CADENCE_DAYS.get(volatility)
    if cadence is None:
        raise_violation(report, "rule7", fp, f"volatility '{volatility}' is not evergreen/mixed/volatile")
        return
    age_days = (TODAY - lr).days
    if age_days > cadence:
        report.warn("rule7-cadence", fp,
                     f"overdue for review: last_reviewed {lr} is {age_days}d old "
                     f"(cadence for volatility={volatility} is {cadence}d)")


def check_links(body, filepath, all_paths, report):
    """Every relative .md link resolves to a file on disk or a manifest path."""
    fp = rel(filepath)
    file_dir = os.path.dirname(filepath)
    seen = set()  # dedupe repeated occurrences of the same broken target in one file
    for target in MD_LINK_RE.findall(body):
        if target.startswith(("http://", "https://", "mailto:", "#")):
            continue
        path_part = target.split("#", 1)[0]
        if not path_part.endswith(".md"):
            continue
        resolved = os.path.normpath(os.path.join(file_dir, path_part))
        resolved_rel = rel(resolved)
        if os.path.isfile(resolved) or resolved_rel.replace(os.sep, "/") in all_paths:
            continue
        if target in seen:
            continue
        seen.add(target)
        raise_violation(report, "links", fp, f"broken link target '{target}' -> resolves to '{resolved_rel}' which does not exist")


# ---------------------------------------------------------------- main

def main():
    report = Report()
    manifest = load_manifest()

    chapters = manifest.get("chapters") or []
    eng_docs = manifest.get("engineering_docs") or []
    tutor_docs = manifest.get("tutor_docs") or []

    validated_entries = chapters + eng_docs
    all_ids = {e["id"] for e in validated_entries}
    all_paths = {e["path"] for e in validated_entries} | {e["path"] for e in tutor_docs}

    prereq_graph = {}
    fm_cache = {}  # id -> (fm, body, filepath)

    for entry in validated_entries:
        doc_id = entry["id"]
        entry_path = entry["path"]
        entry_status = entry["status"]
        filepath = os.path.join(ROOT, entry_path)

        if not os.path.isfile(filepath):
            report.error("rule1", entry_path, "path listed in manifest.yaml does not exist on disk")
            continue

        with open(filepath, encoding="utf-8") as f:
            text = f.read()
        fm, body = split_frontmatter(text, filepath, report)

        check_rule1(doc_id, entry_path, entry_status, filepath, fm, report)
        check_rule2(doc_id, fm, all_ids, report, filepath)
        check_rule3(fm, body, filepath, report)
        check_rule4(fm, filepath, report)
        check_rule5(fm, body, filepath, report)
        check_rule7(fm, filepath, report)
        check_links(body, filepath, all_paths, report)

        prereq_graph[doc_id] = (fm.get("prerequisites") or []) if fm else []
        fm_cache[doc_id] = (fm, body, filepath)

    check_acyclic(prereq_graph, report)

    # tutor_docs: existence only, per task scope.
    for entry in tutor_docs:
        filepath = os.path.join(ROOT, entry["path"])
        if not os.path.isfile(filepath):
            report.error("tutor-exists", entry["path"], "tutor doc listed in manifest.yaml does not exist on disk")

    print_report(report, len(validated_entries), len(tutor_docs))
    return 1 if report.errors else 0


def print_report(report, n_validated, n_tutor):
    print(f"Validated {n_validated} chapters/engineering docs + checked {n_tutor} tutor docs for existence.\n")

    if report.errors:
        print(f"ERRORS ({len(report.errors)}):")
        for rule, f, msg in report.errors:
            print(f"  [{rule}] {f}: {msg}")
        print()
    else:
        print("ERRORS: none\n")

    if report.warnings:
        print(f"WARNINGS ({len(report.warnings)}):")
        for rule, f, msg in report.warnings:
            print(f"  [{rule}] {f}: {msg}")
        print()

    if report.baseline:
        print(f"PRE-EXISTING (WARNING) ({len(report.baseline)}) -- known violations in the corpus, "
              f"not failing CI, see BASELINE in scripts/validate.py:")
        for rule, f, msg in report.baseline:
            print(f"  [{rule}] {f}: {msg}")
        print()

    if report.errors:
        print(f"FAIL: {len(report.errors)} error(s).")
    else:
        print("PASS")


# ---------------------------------------------------------------- baseline
#
# Violations that already existed in the corpus the first time this validator
# was written and run (2026-09-17). Each entry downgrades ONE specific
# (rule, file, message-prefix) violation to "pre-existing (warning)" so CI
# stays green without weakening the rule itself: any NEW violation of the
# same rule, in any file, still fails the build. A human should look at these
# and either fix the content or decide it's fine, then remove the entry here.
#
# Format: (rule, file-relative-to-repo-root, message-prefix-to-match)
BASELINE = []  # emptied 2026-10-08: every pre-existing violation was fixed in the content, so CI is now strict

if __name__ == "__main__":
    sys.exit(main())
