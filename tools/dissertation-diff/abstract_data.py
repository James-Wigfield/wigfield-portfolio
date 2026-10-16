"""Assemble the data for the "Abstract options" tab of the red-pen page.

Reads the abstract-options working folder of the dissertation repo and writes
dissertation-diff-data/abstract-options/abstracts.json plus one page render
(SVG) per option. The folder is gitignored and served by the dev server only
(vite.config.js, /__dissertation-diff), like the rest of the red-pen data, so
no abstract text ever reaches src/ or a build.

    python -I tools/dissertation-diff/abstract_data.py [--src <working folder>] [--renders <dir>]

Inputs (all in the working folder unless stated):
  options-meta.json       names, one-line moves, "what it does", "what an examiner
                          might not like", main risk, recommendation, notes
  drafts/option-N-v3.md   the text (## Text) and the sentence fact map (## Fact map:
                          lines "N. ... -- F10, F17")
  final/option-N.tex      the LaTeX body (what goes into frontmatter/abstract.tex)
  facts.md                the fact sheet (table rows "| Fxx | ... |" and the
                          "**F0x. Title**" entries of section A)
  accuracy-summary.json   per-option verdict counts of the two accuracy agents and
                          the re-check, with anything still open
  critic-key.json         the blind labels A-E -> option ids, per critic
  critic-<name>.json      each critic's structured results (blind labels)
  <renders>/option-N.svg  the rendered abstract page from the real LaTeX build
  <renders>/option-N.json the word counts of that render
"""
import argparse
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "dissertation-diff-data" / "abstract-options"
DEFAULT_SRC = Path(r"C:\Users\james\Documents\university\cits4010\honours-dissertation\documents\temp\final-week\oct15\abstract-options")

SENT = re.compile(r"(?<=[.!?])\s+(?=[A-Z\"(])")


def read(p):
    return p.read_text(encoding="utf-8")


def parse_draft(md):
    """The text paragraphs and the fact map of one drafts/option-N-v3.md."""
    m = re.search(r"^## Text\s*$(.*?)^## Fact map", md, re.S | re.M)
    if not m:
        raise SystemExit("no ## Text / ## Fact map in draft")
    text = m.group(1).strip()
    paragraphs = [" ".join(p.split()) for p in re.split(r"\n\s*\n", text) if p.strip()]
    fm = md[md.index("## Fact map"):]
    facts = []
    for line in fm.splitlines():
        mm = re.match(r"^\s*(\d+)\.\s+(.*?)\s+--\s+(.*)$", line)
        if mm:
            ids = re.findall(r"F[0-9][0-9A-Z]+", mm.group(3))
            facts.append({"i": int(mm.group(1)), "ids": ids, "note": mm.group(3).strip()})
    sentences = []
    k = 0
    for pi, para in enumerate(paragraphs):
        for s in SENT.split(para):
            s = s.strip()
            if not s:
                continue
            k += 1
            f = next((x for x in facts if x["i"] == k), None)
            sentences.append({"i": k, "p": pi, "text": s, "facts": f["ids"] if f else [], "note": f["note"] if f else ""})
    if len(sentences) != len(facts):
        raise SystemExit(f"sentence split gives {len(sentences)} sentences but the fact map has {len(facts)} lines")
    return paragraphs, sentences


def parse_facts(md):
    """ID -> {fact, source, where} from facts.md."""
    out = {}
    # section A: **F0x. Title** (where) then a blockquote
    for m in re.finditer(r"^\*\*(F0[0-9A-Z])\.\s+([^*]+)\*\*\s*(\([^)]*\))?[^\n]*\n((?:>.*\n?)*)", md, re.M):
        fid, title, where, quote = m.group(1), m.group(2).strip(), (m.group(3) or "").strip("() "), m.group(4)
        q = " ".join(l.lstrip("> ").strip() for l in quote.splitlines() if l.strip())
        out[fid] = {"fact": f"{title}: {q}" if q else title, "source": where, "where": ""}
    for line in md.splitlines():
        if not line.startswith("| F"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 3:
            continue
        fid = cells[0]
        if not re.fullmatch(r"F[0-9][0-9A-Z]+", fid):
            continue
        fact, source = cells[1], cells[2]
        where = " / ".join(c for c in cells[3:] if c)
        out[fid] = {"fact": fact, "source": source, "where": where}
    return out


def parse_critic_texts(md):
    """{label: {sentence number: text}} from a critic-texts-<role>.md (the numbered v2 texts)."""
    out = {}
    for m in re.finditer(r"^## Abstract ([A-E])\s*$(.*?)(?=^## Abstract|\Z)", md, re.S | re.M):
        body = m.group(2)
        sents = {}
        for mm in re.finditer(r"\[(\d+)\]\s*(.*?)(?=\s*\[\d+\]|\n\n|\Z)", body, re.S):
            sents[int(mm.group(1))] = " ".join(mm.group(2).split())
        out[m.group(1)] = sents
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=str(DEFAULT_SRC))
    ap.add_argument("--renders", default=None, help="folder with option-N.svg and option-N.json (default <src>/renders/final)")
    ap.add_argument("--draft-version", default="v3", help="which drafts/option-N-<version>.md to read (default v3)")
    ap.add_argument("--tex-dir", default=None, help="folder with option-N.tex bodies (default <src>/final)")
    args = ap.parse_args()
    src = Path(args.src)
    renders = Path(args.renders) if args.renders else src / "renders" / "final"
    tex_dir = Path(args.tex_dir) if args.tex_dir else src / "final"

    meta = json.loads(read(src / "options-meta.json"))
    facts = parse_facts(read(src / "facts.md"))
    accuracy = json.loads(read(src / "accuracy-summary.json")) if (src / "accuracy-summary.json").exists() else {}
    key = json.loads(read(src / "critic-key.json")) if (src / "critic-key.json").exists() else {}
    critics = {}
    read_texts = {}
    for c in meta.get("critics", []):
        p = src / f"critic-{c['id']}.json"
        if p.exists():
            critics[c["id"]] = json.loads(read(p))
        t = src / f"critic-texts-{c['id']}.md"
        if t.exists():
            read_texts[c["id"]] = parse_critic_texts(read(t))

    OUT.mkdir(parents=True, exist_ok=True)
    options = []
    used = set()
    for o in meta["options"]:
        n = o["n"]
        oid = f"option-{n}"
        draft = src / "drafts" / f"{oid}-{args.draft_version}.md"
        paragraphs, sentences = parse_draft(read(draft))
        latex = read(tex_dir / f"{oid}.tex")
        counts = json.loads(read(renders / f"{oid}.json"))
        svg = renders / f"{oid}.svg"
        shutil.copy2(svg, OUT / f"{oid}.svg")
        for s in sentences:
            used.update(s["facts"])
        # The critics read an earlier draft; its sentence numbers map onto the final text
        # through options-meta.json "readMap" (read-draft number -> final number, null if the
        # sentence was removed or merged). Identity when absent.
        read_map = {int(k): v for k, v in (o.get("readMap") or {}).items()}
        crit = {}
        for cid, cj in critics.items():
            label = next((l for l, v in key.get(cid, {}).items() if v == oid), None)
            entry = cj.get("abstracts", {}).get(label) if label else None
            if entry is None:
                continue
            rank = next((r.get("rank") for r in cj.get("ranking", []) if r.get("label") == label), None)
            texts = read_texts.get(cid, {}).get(label, {})
            entry = json.loads(json.dumps(entry))  # copy
            for e in entry.get("log", []):
                k = e.get("sentence")
                e["text"] = texts.get(k, "")
                e["final"] = read_map.get(k, k) if read_map else k
            for fld in ("best", "weakest"):
                b = entry.get(fld)
                if isinstance(b, dict) and b.get("sentence") is not None:
                    k = b["sentence"]
                    b["text"] = texts.get(k, "")
                    b["final"] = read_map.get(k, k) if read_map else k
            crit[cid] = {**entry, "label": label, "rank": rank}
        options.append({
            "id": oid, "n": n, "name": o["name"], "move": o["move"], "lane": o.get("lane", ""),
            "voice": o.get("voice", ""),
            "does": o["does"], "risk": o["risk"], "mainRisk": o["mainRisk"],
            "words": {"printed": counts["printed_words"], "texcount": counts["texcount_adjusted"], "record": counts["count_of_record"]},
            "onePage": bool(counts["one_page"]) and bool(counts["keywords_on_page"]),
            "svg": f"abstract-options/{oid}.svg",
            "paragraphs": paragraphs, "sentences": sentences, "latex": latex,
            "accuracy": accuracy.get(oid, {}),
            "critics": crit,
            "readVersion": meta.get("readVersion", ""),
            "readChanged": bool(read_map) and any(v != k for k, v in read_map.items()),
        })

    data = {
        "built": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "ceiling": meta.get("ceiling", 300),
        "keywordsNote": meta.get("keywordsNote", ""),
        "intro": meta.get("intro", ""),
        "critics": meta.get("critics", []),
        "criticRankings": {cid: cj.get("ranking", []) for cid, cj in critics.items()},
        "recommendation": meta.get("recommendation", {}),
        "facts": {fid: facts[fid] for fid in sorted(used) if fid in facts},
        "missingFacts": sorted(f for f in used if f not in facts),
        "options": options,
    }
    (OUT / "abstracts.json").write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {OUT / 'abstracts.json'}: {len(options)} options, {len(data['facts'])} facts, critics {sorted(critics)}")
    if data["missingFacts"]:
        print("WARNING fact IDs not found in facts.md:", data["missingFacts"], file=sys.stderr)


if __name__ == "__main__":
    main()
