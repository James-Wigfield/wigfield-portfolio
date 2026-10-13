"""Dissertation red pen: the honours dissertation before and after the word cuts.

Builds the data for the portal's University -> "Dissertation · Red Pen" page
(src/components/portal/modules/dissertation-diff/). Everything is written to the
gitignored dissertation-diff-data/ folder, which only the dev server serves
(vite.config.js, apply: 'serve'), so the draft is never bundled or deployed.

    python tools/dissertation-diff/build.py                  # 9875224 -> 2e0a5b3 (the cuts)
    python tools/dissertation-diff/build.py --new WORKTREE   # edited = the working tree
    python tools/dissertation-diff/build.py --old HEAD --new HEAD \
        --overlay <dir> --tags <file.json>                   # a proposal: edited copies laid over HEAD

--overlay copies each file of <dir> over the file of the same name in the edited tree
(chapters/, appendices/ or the root), so a proposal can be shown before it is applied.
Lines "% REV <ID>" in those files become margin tags: build.py turns each into
\\DIFrevtag{<ID>} (difstyle.tex), which records where TeX put it, and the page draws
the ID there. --tags gives the page's wording and each ID's metadata (see the
revision folder's tools/redpen_tags.py).

Both columns are real pdflatex builds of the dissertation, so typography, numbering,
equations, citations and figures are exactly what the PDF shows:

  1. Export the original (git archive of --old) and the edited version (git archive
     of --new, or the working tree). Line endings are normalised to LF.
  2. Build each with the repo's own latexmk settings. The original's PDF is the left
     column; the edited build supplies the final bibliography and float numbers.
  3. latexdiff --flatten, then post-process its output:
       - the spacing in and around every change is put back to what each version
         has (latexdiff takes it from the new text, so struck text read "casesand"
         or "labels , and");
       - floats removed entirely are rebuilt from the original source, crossed out,
         with an unnumbered caption, so the edited column keeps the final numbering;
       - figures whose file changed under the same name get old + new (difstyle.tex);
       - List of Figures / Tables entries are diffed word by word when a short
         caption changed, since latexdiff does not mark the optional argument.
  4. pdflatex the marked-up file against the edited build's .bbl (so citation numbers
     are the final ones), until the cross-references settle. A float that the markup
     makes taller than the page is scaled down just enough to fit (display only).
  5. Check it: build the marked-up file twice more, once with every addition dropped
     and every removal printed plainly, once the other way round, and compare their
     text word by word with the original and the final PDFs (figures in draft mode,
     so text inside figure files stays out). Both must match.
  6. Export every page of both PDFs as SVG, and write manifest.json: page sizes, the
     shared section anchors (for synced scrolling), the change positions, the floats
     that were removed, added, changed or renumbered, and the check's result.

Needs MiKTeX (latexmk, pdflatex, latexdiff-so, pdftocairo, pdfinfo, pdftotext) and a Perl.
"""

import argparse
import concurrent.futures as cf
import datetime as dt
import difflib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
OUT = REPO / "dissertation-diff-data"
WORK = OUT / ".work"
DISS = Path(r"C:\Users\james\Documents\university\cits4010\honours-dissertation")
OLD_REV = "9875224"  # "word cut analysis": the last commit before the cuts were applied
NEW_REV = "2e0a5b3"  # "post cut and figure updates": the cuts and figure changes, committed

# What a build needs from the dissertation repo (documents/ and build/ are left out).
KEEP = ["main.tex", ".latexmkrc", "cshonours.cls", "IEEEtran.bst", "references.bib",
        "preamble", "frontmatter", "chapters", "appendices", "figures"]
FLOAT_ENVS = ("figure", "table")
PT_PER_SP = 1 / 65536


# --------------------------------------------------------------------------- tools
def find_perl():
    for cand in (shutil.which("perl"), r"C:\Program Files\Git\usr\bin\perl.exe"):
        if cand and Path(cand).exists():
            return cand
    sys.exit("No Perl found (latexdiff needs one). Git for Windows ships one.")


def find_latexdiff():
    env = os.environ.get("LATEXDIFF_SO")
    if env:
        return env
    exe = shutil.which("latexdiff")
    if exe:
        # MiKTeX: miktex/bin/x64/latexdiff -> scripts/latexdiff/latexdiff-so, which
        # carries its own Algorithm::Diff.
        so = Path(exe).resolve().parents[3] / "scripts" / "latexdiff" / "latexdiff-so"
        if so.exists():
            return str(so)
    sys.exit("latexdiff-so not found; set LATEXDIFF_SO to its path.")


def run(cmd, cwd, log=None, check=True):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    if log:
        Path(log).write_text(r.stdout + "\n--- stderr ---\n" + r.stderr, encoding="utf-8")
    if check and r.returncode != 0:
        sys.exit(f"{' '.join(map(str, cmd))} failed (exit {r.returncode}); see {log}")
    return r


# --------------------------------------------------------------------------- trees
def export_rev(rev, dst):
    data = subprocess.run(["git", "-C", str(DISS), "archive", rev] + KEEP,
                          capture_output=True, check=True).stdout
    with tarfile.open(fileobj=io.BytesIO(data)) as t:
        t.extractall(dst, filter="data")


def copy_worktree(dst):
    for k in KEEP:
        s = DISS / k
        if s.is_dir():
            shutil.copytree(s, dst / k, ignore=shutil.ignore_patterns("archive"))
        else:
            shutil.copy2(s, dst / k)


def apply_overlay(tree, overlay):
    """Copy each file of `overlay` over the file of the same name in the tree."""
    done = []
    for src in sorted(p for p in Path(overlay).iterdir() if p.is_file()):
        hits = [d / src.name for d in (tree, tree / "chapters", tree / "appendices") if (d / src.name).exists()]
        if len(hits) != 1:
            sys.exit(f"overlay file {src.name}: {len(hits)} matches in the edited tree")
        shutil.copy2(src, hits[0])
        done.append(hits[0].relative_to(tree).as_posix())
    return done


def to_lf(root):
    for p in root.rglob("*.tex"):
        b = p.read_bytes()
        if b"\r\n" in b:
            p.write_bytes(b.replace(b"\r\n", b"\n"))


def rev_label(rev):
    r = subprocess.run(["git", "-C", str(DISS), "log", "-1", "--format=%h|%s|%cs", rev],
                       capture_output=True, text=True, check=True).stdout.strip()
    h, s, d = r.split("|", 2)
    return {"kind": "commit", "rev": h, "subject": s, "date": d}


# --------------------------------------------------------------------------- TeX parsing
def strip_comments(s):
    """Drop % comments (not \\%), keeping the line structure."""
    return re.sub(r"(?<!\\)%[^\n]*", "", s)


def read_group(s, i, open_="{", close="}"):
    """s[i] == open_; return (inner, index after the closing delimiter)."""
    depth, j = 0, i
    while j < len(s):
        c = s[j]
        if c == "\\":
            j += 2
            continue
        if c == open_ or (open_ == "[" and c == "{"):
            depth += 1
        elif c == close or (open_ == "[" and c == "}"):
            depth -= 1
            if depth == 0:
                return s[i + 1:j], j + 1
        j += 1
    raise ValueError(f"unbalanced group at {i}")


def parse_caption(s, start):
    """s[start:] begins with \\caption; return (short or None, long, end index)."""
    i = start + len("\\caption")
    short = None
    while s[i].isspace():
        i += 1
    if s[i] == "[":
        short, i = read_group(s, i, "[", "]")
        while s[i].isspace():
            i += 1
    long_, i = read_group(s, i)
    return short, long_, i


def squash(s):
    return re.sub(r"\s+", " ", s).strip()


def parse_floats(tree):
    """label -> float info, from the comment-stripped chapters and appendices."""
    floats = {}
    for f in sorted((tree / "chapters").glob("*.tex")) + sorted((tree / "appendices").glob("*.tex")):
        text = strip_comments(f.read_text(encoding="utf-8"))
        for m in re.finditer(r"\\begin\{(figure|table)\}(\[[^\]]*\])?(.*?)\\end\{\1\}", text, re.S):
            body = m.group(3)
            lab = re.search(r"\\label\{([^}]*)\}", body)
            cap = re.search(r"\\caption(?=\s*[\[{])", body)
            if not lab or not cap:
                continue
            short, long_, cap_end = parse_caption(body, cap.start())
            floats[lab.group(1)] = {
                "env": m.group(1), "place": m.group(2) or "", "body": body,
                "cap": (cap.start(), cap_end), "short": short, "long": long_,
                "entry": squash(short if short is not None else long_),
                "graphics": re.findall(r"\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}", body),
            }
    return floats


def parse_aux(aux):
    """label -> (number, page) from \\newlabel lines (skipping the @cref twins)."""
    out, raw = {}, {}
    for line in aux.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line.startswith("\\newlabel{"):
            continue
        name, i = read_group(line, len("\\newlabel"))
        raw.setdefault(name.removesuffix("@cref"), []).append(line)
        if name.endswith("@cref"):
            continue
        outer, _ = read_group(line, i)
        num, j = read_group(outer, 0)
        page, _ = read_group(outer, j)
        out[name] = (num, page)
    return out, raw


# --------------------------------------------------------------------------- markup
TOKEN = re.compile(r"\\[A-Za-z]+\*?(?:\{\})?|\\.|\$[^$]*\$|[A-Za-z0-9]+|\s+|.", re.S)


def balanced(s):
    d = 0
    for t in TOKEN.findall(s):
        d += (t == "{") - (t == "}")
        if d < 0:
            return False
    return d == 0


def word_diff(a, b):
    """Word-level \\DIFdel/\\DIFadd markup turning a into b."""
    ta, tb = TOKEN.findall(a), TOKEN.findall(b)
    sm = difflib.SequenceMatcher(None, ta, tb, autojunk=False)
    ops = [[op, "".join(ta[i1:i2]), "".join(tb[j1:j2])] for op, i1, i2, j1, j2 in sm.get_opcodes()]
    # A lone shared space between two changes joins them, so "pooled lesion F1"
    # -> "the five pre-registered" reads as one struck run and one written run.
    k = 1
    while k < len(ops) - 1:
        if ops[k][0] == "equal" and not ops[k][1].strip() and ops[k - 1][0] != "equal" != ops[k + 1][0]:
            ops[k - 1:k + 2] = [["replace", ops[k - 1][1] + ops[k][1] + ops[k + 1][1],
                                 ops[k - 1][2] + ops[k][2] + ops[k + 1][2]]]
        else:
            k += 1
    out = []
    for op, old, new in ops:
        if op == "equal":
            out.append(old)
            continue
        if not (balanced(old) and balanced(new)):
            return f"\\DIFdel{{{a}}}\\DIFadd{{{b}}}"
        if old.strip():
            out.append(f"\\DIFdel{{{old}}}")
        elif old:
            out.append(old)
        if new.strip():
            out.append(f"\\DIFadd{{{new}}}")
        elif new and not old:
            out.append(new)
    return "".join(out)


def protect_refs(s):
    """ulem cannot strike through \\cite and friends unless they are boxed."""
    return re.sub(r"\\(?:cite|cref|Cref|ref|eqref)(?:\[[^\]]*\])?\{[^}]*\}",
                  lambda m: "\\mbox{" + m.group(0) + "}", s)


def active(s, i):
    """True if position i of s is not inside a % comment."""
    line_start = s.rfind("\n", 0, i) + 1
    return re.search(r"(?<!\\)%", s[line_start:i]) is None


def find_active(s, needle, start=0):
    i = s.find(needle, start)
    while i != -1 and not active(s, i):
        i = s.find(needle, i + 1)
    return i


def rebuild_removed_float(fl, number, label):
    """The original float, crossed out, with an unnumbered struck caption. Its label
    comes back only in the check build that reads the original (\\DIFoldlabel), where
    the float is numbered again and the edited version of a moved or rebuilt one is
    left out."""
    env = fl["env"]
    kind, lst = ("Figure", "lof") if env == "figure" else ("Table", "lot")
    body = re.sub(r"\\label\{[^}]*\}", "", fl["body"])
    c0, c1 = fl["cap"]
    scale = "0.6" if env == "figure" else "1"

    def visual(seg):
        seg = re.sub(r"\n\s*\n", "\n", seg).replace("\\includegraphics", "\\DIFOincludegraphics")
        if re.search(r"\\DIFOincludegraphics|\\begin\{tabular|\\figureplaceholder", seg):
            return f"\\DIFcrossbox{{{scale}}}{{%\n{seg.strip()}%\n}}\n"
        return seg.strip() + "\n" if seg.strip() else ""

    long_ = protect_refs(squash(fl["long"]))
    entry = protect_refs(fl["entry"])
    cap = (f"\\DIFdelcaption{{{lst}}}{{{env}}}{{{kind}~{number}}}{{{number}}}"
           f"{{{long_}}}{{{entry}}}\\DIFoldlabel{{{label}}}\n")
    return (f"\\ifDIFshowremoved\n\\begin{{{env}}}{fl['place']}\n" + visual(body[:c0]) + cap
            + visual(body[c1:]) + f"\\end{{{env}}}\n\\fi\n")


def replace_restructured(diff, old_floats, new_floats, old_nums, notes):
    """Tables kept under the same label whose rows or columns changed (latexdiff had to
    comment out a removed & or \\\\, or the column spec): the old table crossed out, then
    the new one from the edited source, framed, with its caption in handwriting."""
    out, pos = [], 0
    for m in re.finditer(r"\\begin\{table\}", diff):
        if m.start() < pos or not active(diff, m.start()):
            continue
        e = find_active(diff, "\\end{table}", m.end())
        if e < 0:
            continue
        end = e + len("\\end{table}")
        body = diff[m.start():end]
        labels = [x.group(1) for x in re.finditer(r"\\label\{([^}]*)\}", body) if active(body, x.start())]
        if len(labels) != 1 or labels[0] not in old_floats or labels[0] not in new_floats:
            continue
        if not re.search(r"%DIFDELCMD <[^\n]*?(?:(?<!\\)&|\\\\|\\begin\{tabular)", body):
            continue
        label = labels[0]
        nf = new_floats[label]
        notes["replaced"].append({"label": label, "kind": "table", "number": old_nums[label][0],
                                  "title": squash(old_floats[label]["entry"])})

        def framed(seg):
            return re.sub(r"\\begin\{(tabular\*?|tabularx)\}.*?\\end\{\1\}",
                          lambda t: "\\DIFnewtable{%\n" + t.group(0) + "%\n}", seg, flags=re.S)
        c0, c1 = nf["cap"]
        cap = f"\\caption[\\DIFadd{{{nf['entry']}}}]{{\\DIFadd{{{squash(nf['long'])}}}}}"
        tags = "".join(f"%DIF >  REV {t}\n" for t in REVTAG.findall(body))
        new = (f"\\ifDIFshowadded\n\\begin{{table}}{nf['place']}\n" + tags + framed(nf["body"][:c0]) + cap
               + framed(nf["body"][c1:]) + "\\end{table}\n\\fi\n")
        out += [diff[pos:m.start()], rebuild_removed_float(old_floats[label], old_nums[label][0], label), new]
        pos = end
    return "".join(out) + diff[pos:]


def vis(s):
    """Roughly what TeX shows of a stretch of source: comments (with their line
    ends) and the zero-width \\hskip0pt that latexdiff adds are dropped."""
    return re.sub(r"(?<!\\)%[^\n]*\n?", "", s).replace("\\hskip0pt", "")


class Source:
    """One version's printed text (from its PDF, so labels and file names in the
    source do not count), for asking whether a run of characters is a word of it."""

    def __init__(self, pdf):
        self.text = " " + " ".join(words(pdf)) + " "
        self.words = set(re.findall(r"[A-Za-z]+", self.text))

    def has(self, s, whole=True):
        """s printed as a word of its own (whole=False: at least starting one),
        so "run6" in a file name like "2026-09-26_run6_cnn" does not count."""
        end = r"(?=[\s,.;:)\]'’]|\Z)" if whole else ""
        return re.search(r"(?<![^\s(\[])" + re.escape(s) + end, self.text) is not None


BLOCK = re.compile(r"\\DIF(del|add)begin(FL)? ")
GROUP = re.compile(r"\\DIF(?:del|add)(?:FL)?\{")
TAIL = re.compile(r"((?:\\hskip0pt)?(?:(?<!\\)%[^\n]*\n)?)\Z")


def reading(s, kind):
    """A stretch of marked-up source as one version reads it ("del": the original,
    "add": the final): the other version's groups dropped, this one's unwrapped,
    markers removed. The stretch may start or end inside a group; that part is
    just unwrapped."""
    s = re.sub(r"\\DIF(?:add|del)(?:begin|end)(?:FL)?(?![A-Za-z]) ?|\\DIFgap", "", s)
    out, i = [], 0
    for m in re.finditer(r"\\DIF(add|del)(?:FL)?\{", s):
        if m.start() < i:
            continue
        out.append(s[i:m.start()])
        try:
            inner, end = read_group(s, m.end() - 1)
        except ValueError:
            inner, end = s[m.end():], len(s)
        if m.group(1) == kind:
            out.append(inner)
        i = end
    out.append(s[i:])
    return vis("".join(out))


def need(before, after, src):
    """1 if a space must separate the visible texts `before` and `after`, 0 if none
    may, None if either is fine (or it cannot be told)."""
    if before is None or after is None:
        return None
    before, after = before.rstrip(), after.lstrip(" \t")
    p, n = before[-1:], after[:1]
    if not p or not n or n == "\n":
        return None
    # the printed text decides when it can: "TP/FP" + "/FN", "48" + "/ 50"
    head, tail = re.search(r"\S+\Z", before).group(0), re.match(r"\S+", after).group(0)
    joined, spaced = head + tail, head + " " + tail
    if (joined in src.text) != (spaced in src.text):
        return 0 if joined in src.text else 1
    if n in ",.;:)]'!?~" or p in "([~":
        return 0
    head = re.search(r"[A-Za-z0-9]+[,.]?\Z", before)
    tail = re.match(r"[A-Za-z0-9]+", after)
    # (unless the spaced form is printed too: "patient-bootstrap" hyphenated at a line
    # end reads back as "patientbootstrap", next to a plain "patient bootstrap")
    if head and tail and src.has(head.group(0) + tail.group(0)) \
            and not src.has(head.group(0) + " " + tail.group(0), whole=False):
        return 0  # one word split across the change ("scan" + "s", "10," + "000")
    if (p.isalnum() or p in ",.;:)]}'!?$%") and (n.isalnum() or n in "(\\$`"):
        return 1
    return None


def group_span(diff, cs):
    """(content start, content end) of the brace group whose { is at cs - 1."""
    _, ce = read_group(diff, cs - 1)
    return cs, ce - 1


def block_info(diff, b):
    """Visible start and end of a block, and where its edge spaces sit, when the
    block starts and ends with a \\DIFdel{}/\\DIFadd{} group."""
    info = {"first": None, "last": None}
    m = re.match(r" *\\DIF(?:del|add)(?:FL)?\{", diff[b["body"]:b["end"]])
    if m:
        cs, ce = group_span(diff, b["body"] + m.end())
        content = diff[cs:ce]
        if not content.strip():
            return info
        lead = re.match(r"[ \t\n]*", content).group(0)
        info["first"] = {"text": vis(content), "cur": 1 if lead else 0,
                         "insert": cs, "span": (cs, len(lead))}
    groups = list(GROUP.finditer(diff, b["body"], b["end"]))
    if groups:
        cs, ce = group_span(diff, groups[-1].end())
        if ce < b["end"] and not vis(diff[ce + 1:b["end"]]).strip():
            content = diff[cs:ce]
            body = content[:TAIL.search(content).start()]
            trail = re.search(r"[ \t\n]*\Z", body).group(0)
            info["last"] = {"text": vis(content), "cur": 1 if trail else 0,
                            "insert": cs + len(body), "span": (cs + len(body) - len(trail), len(trail))}
    return info


def fix_boundary_spaces(diff, old_src, new_src):
    """Put the whitespace around each change where both versions had it.

    latexdiff takes the whitespace next to a change from the new text, so the
    struck reading can come out as "labels , and" (old "labels, and", new "labels
    and"), "casesand" (old "cases and", new "cases.") or "2118] ." (an addition
    before a full stop). Changes with no shared text between them form a chain.
    Around a chain a space can sit before it, after it, and at either end of each
    removal and addition. The old reading sees the outer two plus the removals'
    own, the new reading the outer two plus the additions'. Each junction in each
    reading is checked against plain spacing (a space between two words unless the
    joined form is a word of that version; none before closing punctuation or
    after an opening bracket), and the fewest spaces are moved to satisfy both.
    Spaces after control words, around commands latexdiff could not wrap, and at
    paragraph breaks are never touched.
    """
    blocks = []
    for m in BLOCK.finditer(diff):
        kind, fl = m.group(1), m.group(2) or ""
        e = re.compile(r"\\DIF" + kind + "end" + fl + r"(?![A-Za-z])").search(diff, m.end())
        blocks.append({"kind": kind, "start": m.start(), "body": m.end(), "end": e.start(), "after": e.end()})

    chains = []
    for b in blocks:
        if chains and re.fullmatch(r"[ ]*(\\DIFgap)?", diff[chains[-1][-1]["after"]:b["start"]]):
            chains[-1].append(b)
        else:
            chains.append([b])

    edits = []
    for chain in chains:
        if len(chain) > 6:
            continue
        start, after = chain[0]["start"], chain[-1]["after"]
        slots = {}  # name -> {"cur", "insert", "span"}

        left = diff[max(0, start - 400):start]
        ws = re.search(r"[ \t\n]*\Z", left).group(0)
        before = left[:len(left) - len(ws)]
        # What each version reads just before and just after the chain.
        prev_text = {"del": None, "add": None}
        if "\n\n" not in ws and not re.search(r"\\[A-Za-z]+\Z|\\\\\Z|(?<!\\)%[^\n]*\Z", before):
            prev_text = {k: reading(before, k)[-40:] for k in prev_text}
            slots["oL"] = {"cur": 1 if ws else 0, "insert": start, "span": (start - len(ws), len(ws)),
                           "ins": " "}

        rest = re.sub(r"^[ \t]*\n?[ \t]*", "", diff[after:after + 400])
        next_text = {"del": None, "add": None}
        if not rest.startswith(("\n", "\\DIF")):
            next_text = {k: reading(rest, k)[:40] for k in next_text}
            # nothing visible follows the closing control word; "{}" makes the space count
            slots["oR"] = {"cur": 0, "insert": after, "span": None, "ins": "{}"}

        seqs = {"del": [], "add": []}
        for k, b in enumerate(chain):
            info = block_info(diff, b)
            seqs[b["kind"]].append((k, info))
            for end in ("first", "last"):
                if info[end]:
                    slots[f"{k}{end}"] = {**info[end], "ins": " "}

        junctions = []  # (slot names, need)
        for kind, src in (("del", old_src), ("add", new_src)):
            items = seqs[kind]
            prev, nxt = prev_text[kind], next_text[kind]
            if not items:
                if "oL" in slots and "oR" in slots:
                    n = need(prev, nxt, src)
                    if n is not None:
                        junctions.append((["oL", "oR"], n))
                continue
            k0, i0 = items[0]
            if "oL" in slots and i0["first"]:
                n = need(prev, i0["first"]["text"], src)
                if n is not None:
                    junctions.append((["oL", f"{k0}first"], n))
            for (ka, ia), (kb, ib) in zip(items, items[1:]):
                if ia["last"] and ib["first"]:
                    n = need(ia["last"]["text"], ib["first"]["text"], src)
                    if n is not None:
                        junctions.append(([f"{ka}last", f"{kb}first"], n))
            k1, i1 = items[-1]
            if "oR" in slots and i1["last"]:
                n = need(i1["last"]["text"], nxt, src)
                if n is not None:
                    junctions.append(([f"{k1}last", "oR"], n))
        if not junctions:
            continue

        names = sorted({x for js, _ in junctions for x in js})

        def score(assign):
            sums = [sum(assign[x] for x in js) for js, _ in junctions]
            bad = sum(1 for s, (_, n) in zip(sums, junctions) if (s > 0) != bool(n))
            double = sum(1 for s in sums if s > 1)
            moved = sum(1 for x in names if assign[x] != slots[x]["cur"])
            return bad, 3 * double + moved

        current = {x: slots[x]["cur"] for x in names}
        best = current
        for bits in range(1 << len(names)):
            assign = {x: (bits >> k) & 1 for k, x in enumerate(names)}
            if score(assign) < score(best):
                best = assign
        if score(best)[0] >= score(current)[0]:
            continue
        for x in names:
            if best[x] == slots[x]["cur"]:
                continue
            if best[x]:
                edits.append((slots[x]["insert"], 0, slots[x]["ins"]))
            elif slots[x]["span"]:
                edits.append((*slots[x]["span"], ""))

    for pos, n, text in sorted(edits, key=lambda e: e[0], reverse=True):
        diff = diff[:pos] + text + diff[pos + n:]
    return diff


def flatten(tree):
    """main.tex with every \\input inlined and comments removed the way TeX
    removes them (a comment eats its line end and the next line's indent)."""
    def expand(path):
        text = (tree / path).with_suffix(".tex").read_text(encoding="utf-8")
        text = re.sub(r"(?<!\\)%[^\n]*\n[ \t]*", "", text)
        return re.sub(r"\\input\{([^}]*)\}", lambda m: expand(m.group(1)), text)
    return expand("main")


WRAP = re.compile(r"\\mbox\{%DIFAUXCMD\n|[ \t]*\}(?:[ \t]*\\hskip0pt)?%DIFAUXCMD\n|(?<!\\)%[^\n]*\n")


def respace_groups(diff, old_tex, new_tex):
    """Give the inside of every \\DIFdel/\\DIFadd group its source's spacing.

    latexdiff rebuilds each changed run from tokens and can lose a space ("flips
    on" -> "flipson"), add one ("(DSC)" -> "(DSC\\n)", "1,035" -> "1, 035") or
    swallow one behind the box it puts round a \\cite or \\cref. Each group's
    characters are looked up in its own version's source (removals in the
    original, additions in the final) with any whitespace allowed between them;
    where every match agrees, the group's whitespace is made to match. The boxes
    are kept; a space that belongs right after one goes before its \\hskip0pt."""
    edits = []
    for g in GROUP.finditer(diff):
        src = old_tex if g.group(0).startswith("\\DIFdel") else new_tex
        cs, ce = group_span(diff, g.end())
        content = diff[cs:ce]
        # atoms: (kind, start, end) with kind "c" (a character), "w" (whitespace) or "x" (box markup)
        atoms, i = [], 0
        while i < len(content):
            m = WRAP.match(content, i)
            if m:
                lead = re.match(r"[ \t]*", m.group(0)).end()
                if lead:
                    atoms.append(("w", i, i + lead))
                atoms.append(("x", i + lead, m.end()))
                i = m.end()
            elif content[i] in " \t\n":
                j = i
                while j < len(content) and content[j] in " \t\n":
                    j += 1
                atoms.append(("w", i, j))
                i = j
            else:
                atoms.append(("c", i, i + 1))
                i += 1
        chars = [k for k, a in enumerate(atoms) if a[0] == "c"]
        if len(chars) < 3:
            continue
        pattern = r"\s*".join(re.escape(content[atoms[k][1]]) for k in chars)
        found = set()
        for m in re.finditer(pattern, src):
            gaps, pos = [], m.start()
            for k in chars:
                c = content[atoms[k][1]]
                j = src.index(c, pos)
                gaps.append(j > pos)
                pos = j + 1
            found.add(tuple(gaps[1:]))
            if len(found) > 1:
                break
        if len(found) != 1:
            continue
        want = found.pop()
        for (k0, k1), space in zip(zip(chars, chars[1:]), want):
            between = atoms[k0 + 1:k1]
            has = any(a[0] == "w" for a in between)
            if has and not space:
                edits.extend((cs + a[1], a[2] - a[1], "") for a in between if a[0] == "w")
            elif space and not has:
                closing = [a for a in between if a[0] == "x" and "hskip0pt" in content[a[1]:a[2]]]
                if closing:
                    at = cs + closing[0][1] + content[closing[0][1]:closing[0][2]].index("\\hskip0pt")
                elif between and between[0][0] == "x" and content[between[0][1]:].startswith("\\mbox"):
                    at = cs + between[0][1]
                elif between and between[0][0] == "x" and content[between[0][1]:].startswith("}"):
                    at = cs + between[0][1] + 1
                else:
                    at = cs + atoms[k0][2]
                edits.append((at, 0, " "))
    for pos, n, text in sorted(edits, key=lambda e: e[0], reverse=True):
        diff = diff[:pos] + text + diff[pos + n:]
    return diff


def argument_mask(s):
    """For each character of s: True if it sits inside a command's braced or
    bracketed argument (\\cref{...}, \\cite[...]{...}) or in $...$ math."""
    mask, stack, math = [False] * len(s), [], False
    i = 0
    while i < len(s):
        c = s[i]
        if c == "\\":
            m = re.match(r"\\([A-Za-z]+\*?|.)", s[i:])
            for k in range(i, i + m.end()):
                mask[k] = True
            i += m.end()
            continue
        if c == "$":
            math = not math
        elif c in "{[":
            opens_arg = bool(re.search(r"(\\[A-Za-z]+\*?|[}\]])\s*\Z", s[:i]))
            if c == "[" and not opens_arg:
                c = None  # a literal bracket in the text
            else:
                stack.append(opens_arg)
        elif c in "}]" and stack:
            stack.pop()
        mask[i] = math or any(stack) or c == "$"
        i += 1
    return mask


def fix_run_together_words(diff, old_src, new_src):
    """Restore spaces latexdiff dropped inside one removal or addition.

    When latexdiff matches a space in the middle of a removed run with a space
    elsewhere in the new text, the run is printed without it ("flipson" for old
    "flips on", "size1" for "size 1"). A word of a \\DIFdel group that the original
    never prints, but that the original does print with a space at exactly one
    place, gets its space back (the same for \\DIFadd and the final text)."""
    edits = []
    for g in GROUP.finditer(diff):
        src = old_src if g.group(0).startswith("\\DIFdel") else new_src
        cs, ce = group_span(diff, g.end())
        content = diff[cs:ce]
        hidden = argument_mask(content)
        # words with at least one letter, not the digits of a number like 0.173
        for w in re.finditer(r"(?<![\\A-Za-z0-9.,])(?=[0-9]*[A-Za-z])[A-Za-z0-9]{3,}(?![A-Za-z0-9])", content):
            if hidden[w.start()]:
                continue  # a label, citation key or other command argument
            word = w.group(0)
            if src.has(word):
                continue
            splits = [i for i in range(1, len(word)) if src.has(word[:i] + " " + word[i:])]
            if len(splits) == 1:
                edits.append((cs + w.start() + splits[0], 0, " "))
        # the same before a bracket: "negatives(Table 4.1)" for "negatives (Table 4.1)"
        for w in re.finditer(r"(?<![\\A-Za-z0-9])([A-Za-z0-9]{2,})\(", content):
            if not hidden[w.start()] and src.has(w.group(1) + " (", whole=False) \
                    and not src.has(w.group(1) + "(", whole=False):
                edits.append((cs + w.end() - 1, 0, " "))
    for pos, n, text in sorted(edits, key=lambda e: e[0], reverse=True):
        diff = diff[:pos] + text + diff[pos + n:]
    return diff


def postprocess(diff, old_floats, new_floats, old_nums, changed_figs, notes, old_src, new_src,
                old_tex, new_tex):
    # 0. latexdiff comments out a lone [ or ] in removed text as if it were markup, so
    #    "[177Lu]Lu-PSMA" read "177LuLu-PSMA" when struck. Strike it as text.
    diff = re.sub(r"%DIFDELCMD < ([\[\]])%%%\n", r"\\DIFdel{\1}", diff)
    # Spacing inside each changed run, from its own source.
    diff = respace_groups(diff, old_tex, new_tex)
    # 1. Stray spaces latexdiff puts before punctuation inside marked text
    #    ("interpolation . It", "(IoU )", "\releasedbaseline{} 's"). The sources
    #    never have them; \DIFaddend . is left alone since TeX eats the space after
    #    a control word anyway.
    def fix_line(line):
        if line.lstrip().startswith("%"):
            return line
        line = re.sub(r"(\\?[A-Za-z]+|[0-9)%]) ([.,;:)\]])(?=[ }.,;:)]|$)",
                      lambda m: m.group(0) if m.group(1).startswith("\\") and m.group(1) != "\\%"
                      else m.group(1) + m.group(2), line)
        return line.replace("{} '", "{}'")
    diff = "\n".join(fix_line(l) for l in diff.split("\n"))
    # latexdiff boxes each \cite and \cref with the space after it inside the box
    # ("\mbox{\cite{x} }"); move the space out so it can be moved like any other.
    diff = re.sub(r"(\\mbox\{%DIFAUXCMD\n[^\n]*?)[ \t]+\}(\\hskip0pt)?%DIFAUXCMD",
                  lambda m: m.group(1) + "} " + (m.group(2) or "") + "%DIFAUXCMD", diff)
    # ... and where the source had a line break after the reference, the box's
    # closing comment swallows it ("Table 4.10gives"); a word right after the
    # comment means a space was there.
    diff = re.sub(r"\}\\hskip0pt%DIFAUXCMD\n(?=[A-Za-z(])", "} \\\\hskip0pt%DIFAUXCMD\n", diff)
    # A thin gap between a removal and the addition that replaces it.
    diff = re.sub(r"\\DIFdelend(FL)? \\DIFaddbegin(FL)? ",
                  lambda m: f"\\DIFdelend{m.group(1) or ''} \\DIFgap\\DIFaddbegin{m.group(2) or ''} ", diff)
    diff = fix_run_together_words(diff, old_src, new_src)
    diff = fix_boundary_spaces(diff, old_src, new_src)
    # latexdiff puts a zero-width \hskip0pt after every boxed \cite or \cref so a
    # line can break there, which also lets it break before the comma or full stop
    # that follows ("Table 3.3" / ". Under"). A space after the box, where there
    # is one, is break enough.
    diff = re.sub(r"\\hskip0pt(?=%DIFAUXCMD)", "", diff)
    # When a kept float's \caption command itself changed (a short caption added),
    # latexdiff leaves the struck opening words outside the caption, between the
    # figure and "Figure 4.1:". Move them inside, just after the new caption opens.
    pat = re.compile(r"\\DIFdelbeginFL %DIFDELCMD < \\caption[^\n]*\n(?:%DIFDELCMD <[^\n]*\n)*(\\DIFdelFL\{)")
    out, pos = [], 0
    for m in pat.finditer(diff):
        if m.start() < pos:
            continue
        _, g_end = read_group(diff, m.end(1) - 1)
        tail = re.match(r"\\DIFdelendFL (?:\\DIFgap)?\\DIFaddbeginFL \\caption", diff[g_end:])
        if not tail:
            continue
        k = g_end + tail.end()
        if diff[k] == "[":
            _, k = read_group(diff, k, "[", "]")
        if diff[k] != "{":
            continue
        out += [diff[pos:m.start()], "\\DIFaddbeginFL \\caption", diff[g_end + tail.end():k + 1],
                "\\DIFdelbeginFL ", diff[m.start(1):g_end], "\\DIFdelendFL \\DIFgap"]
        pos = k + 1
    diff = "".join(out) + diff[pos:]

    # 1b. A table whose layout changed (a row or column removed, a new column spec)
    #    cannot be marked cell by cell: latexdiff comments out the removed & and \\, so
    #    the struck cells run into their neighbours and the rows misalign. Show the old
    #    table crossed out (as a removed float) and the new one in full beside a "new
    #    version" frame, its caption in handwriting. Change tags inside it go to its top.
    diff = replace_restructured(diff, old_floats, new_floats, old_nums, notes)

    # 2. Removed floats: latexdiff comments out the environment and leaves the cell
    #    text loose in the paragraph. Swap the whole block for a crossed-out rebuild.
    pat = re.compile(r"%DIFDELCMD < \\begin\{(figure|table)\}[^\n]*\n(.*?)"
                     r"%DIFDELCMD < \\end\{\1\}[^\n]*\n", re.S)

    def swap(m):
        lab = re.search(r"\\label\{([^}]*)\}", m.group(0))
        if not lab or lab.group(1) not in old_floats:
            raise SystemExit(f"removed float without a known label: {m.group(0)[:200]}")
        name = lab.group(1)
        num = old_nums[name][0]
        notes["removed"].append({"label": name, "kind": old_floats[name]["env"],
                                 "number": num, "title": squash(old_floats[name]["entry"])})
        return "\n" + rebuild_removed_float(old_floats[name], num, name)
    diff = pat.sub(swap, diff)
    # A float removed in one place and added in another under the same label has moved:
    # crossed out where it was (above), and treated as new where it now is (4 and 5).
    moved = {r["label"] for r in notes["removed"]} & set(new_floats)
    notes["moved"] = [r for r in notes["removed"] if r["label"] in moved]
    notes["removed"] = [r for r in notes["removed"] if r["label"] not in moved]
    # A removed figure placeholder (the dissertation's own \figureplaceholder box)
    # is a command latexdiff can only comment out; draw it crossed out instead.
    diff = re.sub(r"%DIFDELCMD < (\\figureplaceholder\{[^\n]*\})[ \t]*\n",
                  lambda m: "\\DIFdelbox{" + m.group(1) + "}%\n", diff)

    # 3. Changed figure files (same name, new content).
    for name in changed_figs:
        stem = re.escape(Path(name).stem)
        rx = re.compile(r"\\includegraphics(\[[^\]]*\])?\{(" + stem + r"(?:\.\w+)?)\}")
        n = 0
        out = []
        for line in diff.split("\n"):
            if not line.lstrip().startswith("%"):
                line, k = rx.subn(lambda m: f"\\DIFchangedgraphics{m.group(1) or ''}{{{m.group(2)}}}", line)
                n += k
            out.append(line)
        diff = "\n".join(out)
        if n != 1:
            raise SystemExit(f"expected one \\includegraphics of {name}, found {n}")

    # 4. Floats that are new as a whole sit in \ifDIFshowadded, so the "original
    #    only" check build can leave them out (and not count them).
    for label in [l for l in new_floats if l not in old_floats or l in moved]:
        li = find_active(diff, "\\label{" + label + "}")
        env = new_floats[label]["env"]
        b = diff.rfind("\\begin{" + env + "}", 0, li)
        e = diff.find("\\end{" + env + "}", li) + len("\\end{" + env + "}")
        if li == -1 or b == -1 or not active(diff, b):
            raise SystemExit(f"added float {label} not found in the diff")
        diff = diff[:b] + "\\ifDIFshowadded\n" + diff[b:e] + "\n\\fi" + diff[e:]

    # 5. List of Figures / Tables entries. latexdiff marks the long caption, which
    #    is the entry when neither version has a short one; otherwise mark the entry
    #    here and pass it as the short caption.
    replaced = {r["label"] for r in notes["replaced"]}
    for label, nf in new_floats.items():
        of = old_floats.get(label)
        if label in replaced:
            continue
        if of is None or label in moved:
            entry = f"\\DIFadd{{{nf['entry']}}}"
        elif of["entry"] == nf["entry"] or (of["short"] is None and nf["short"] is None):
            continue
        else:
            entry = word_diff(of["entry"], nf["entry"])
        li = find_active(diff, "\\label{" + label + "}")
        ci = diff.rfind("\\caption", 0, li)
        while ci != -1 and not active(diff, ci):
            ci = diff.rfind("\\caption", 0, ci)
        if li == -1 or ci == -1:
            raise SystemExit(f"caption for {label} not found in the diff")
        j = ci + len("\\caption")
        if diff[j] == "[":
            _, k = read_group(diff, j, "[", "]")
            diff = diff[:j] + "[" + entry + "]" + diff[k:]
        else:
            diff = diff[:j] + "[" + entry + "]" + diff[j:]

    # 6. latexdiff's change marks are commands that do something (they write a position,
    #    and switch \includegraphics), so at the start of a table row one opens a cell,
    #    after which a rule (\midrule, \rowsep) or a \multicolumn is an error. Move each
    #    such mark past the rules, into the \multicolumn's text, or out past the end of
    #    the tabular. Nothing printed moves.
    gap = r"((?:[ \t\n]|(?<!\\)%[^\n]*\n)*)"
    rule = (r"(\\(?:toprule|midrule|bottomrule|hline|rowsep|addlinespace(?:\[[^\]]*\])?"
            r"|cmidrule(?:\([^)]*\))?\{[^{}]*\}|specialrule\{[^{}]*\}\{[^{}]*\}\{[^{}]*\})(?![A-Za-z]))")
    mark = r"(\\DIF(?:add|del)(?:begin|end)(?:FL)? ?)"
    steps = [(re.compile(mark + gap + rule), r"\3\2\1"),
             (re.compile(mark + gap + r"(\\multicolumn\{[^{}]*\}\{(?:[^{}]|\{[^{}]*\})*\}\{)"), r"\2\3\1"),
             (re.compile(mark + gap + r"(\\end\{(?:tabular\*?|tabularx)\})"), r"\2\3\1")]
    for _ in range(10):
        before = diff
        for rx, rep in steps:
            diff = rx.sub(rep, diff)
        if diff == before:
            break
    return diff


# --------------------------------------------------------------------------- change tags
MARKER = re.compile(r"^[ \t]*% REV (\S+)[^\n]*\n", re.M)
TABULAR = re.compile(r"\\begin\{(tabular\*?|tabularx)\}")
REVTAG = re.compile(r"(?<!\\)%DIF > +REV (\S+)[^\n]*")


def code_only(s):
    """s with every % comment blanked out (same length), so searches skip comments."""
    return re.sub(r"(?<!\\)%[^\n]*", lambda m: " " * len(m.group(0)), s)


def move_table_markers(text):
    """A "% REV" line inside a tabular would put its tag where the line is: at the start
    of a row it opens a cell (an error before \\multicolumn or \\midrule), and at the end
    of a cell it keeps the cell's trailing space from being trimmed, which widens the
    column. Move each one to the line before \\begin{tabular}, so the tag sits at the
    top of the table. Moving a comment changes nothing TeX prints."""
    code = code_only(text)
    spans = []
    for m in TABULAR.finditer(code):
        spans.append((code.rfind("\n", 0, m.start()) + 1, m.end(), code.find("\\end{" + m.group(1) + "}", m.end())))
    edits = []  # (position, characters removed, text inserted)
    for mk in MARKER.finditer(text):
        span = next((s for s in spans if s[1] < mk.start() < s[2]), None)
        if span:
            edits += [(mk.start(), len(mk.group(0)), ""), (span[0], 0, mk.group(0).lstrip())]
    for pos, n, ins in sorted(edits, key=lambda e: (e[0], e[1] > 0), reverse=True):
        text = text[:pos] + ins + text[pos + n:]
    return text


def place_tags(diff):
    """latexdiff passes the overlay's "% REV <ID>" lines through as "%DIF >  REV <ID>"
    comments. Each becomes "\\DIFrevtag{<ID>}%": the comment still ends the line as
    before, and the tag records where TeX put it (difstyle.tex). A tag that landed in
    struck text, which ulem sets word by word, moves to just after it."""
    diff, n = REVTAG.subn(lambda m: "\\DIFrevtag{" + m.group(1) + "}%", diff)
    for g in reversed(list(re.finditer(r"\\DIFdel(?:FL)?\{", diff))):
        _, end = read_group(diff, g.end() - 1)
        inner = diff[g.end():end - 1]
        tags = re.findall(r"\\DIFrevtag\{[^}]*\}", inner)
        if tags:
            inner = re.sub(r"\\DIFrevtag\{[^}]*\}", "", inner)
            diff = diff[:g.end()] + inner + "}" + "".join(tags) + diff[end:]
            print(f"  moved {', '.join(tags)} out of struck text")
    return diff, n


def read_tags(path, sizes):
    """Tag positions from <job>.difrev as fractions of the page (y from the top), and the
    text block's left and right edges."""
    k = PT_PER_SP * (72 / 72.27)
    placed, edges = [], None
    for line in path.read_text(encoding="utf-8").splitlines():
        p = line.split()
        if p[0] == "@text":
            edges = [round(int(p[1]) * k / sizes[0][0], 4), round(int(p[2]) * k / sizes[0][0], 4)]
            continue
        page = int(p[1])
        w, h = sizes[page - 1]
        tag = {"id": p[0], "page": page, "x": round(int(p[2]) * k / w, 4), "y": round(1 - int(p[3]) * k / h, 4)}
        # one tag per ID and spot (several markers of a table all sit at its top)
        if not any(t["id"] == tag["id"] and t["page"] == page and abs(t["y"] - tag["y"]) < 0.005 for t in placed):
            placed.append(tag)
    placed.sort(key=lambda t: (t["page"], t["y"], t["x"]))
    return placed, edges


TEXT_HEIGHT_PT = 592.0  # cshonours.cls


def fit_floats(diff, too_large):
    """A float that the markup makes taller than the page (struck and handwritten
    text in a big table) is scaled down just enough to fit, rather than running
    into the page number. too_large: (excess pt, input line) from the log."""
    lines = diff.split("\n")
    for excess, line in sorted(too_large, key=lambda t: -t[1]):
        begins = [i for i in range(min(line, len(lines)) - 1, -1, -1)
                  if re.search(r"^[^%]*\\begin\{(table|figure)\}", lines[i])]
        if not begins:
            print(f"  could not find the float for line {line}")
            continue
        b = begins[0]
        env = re.search(r"\\begin\{(table|figure)\}", lines[b]).group(1)
        e = next(i for i in range(b, len(lines)) if lines[i].strip().startswith(f"\\end{{{env}}}"))
        scale = round(1 - (excess + 6) / TEXT_HEIGHT_PT, 3)
        lines[e] = "\\end{DIFfit}\n" + lines[e]
        lines[b] = lines[b] + f"\n\\begin{{DIFfit}}{{{scale}}}"
        print(f"  float at line {b + 1} scaled to {scale} to fit its page")
    return "\n".join(lines)


# --------------------------------------------------------------------------- PDF data
def page_sizes(pdf):
    out = run(["pdfinfo", "-f", "1", "-l", "9999", str(pdf)], pdf.parent).stdout
    sizes = [(float(w), float(h)) for w, h in
             re.findall(r"Page\s+\d+ size:\s+([\d.]+) x ([\d.]+)", out)]
    return sizes


def dests(pdf):
    out = run(["pdfinfo", "-dests", str(pdf)], pdf.parent).stdout
    res = {}
    for m in re.finditer(r"^\s*(\d+)\s+\[\s*XYZ\s+\S+\s+(\S+)[^\]]*\]\s+\"([^\"]+)\"", out, re.M):
        y = float(m.group(2)) if m.group(2) != "null" else None
        res[m.group(3)] = (int(m.group(1)), y)
    return res


def toc_entries(toc):
    """(level, number, title, anchor) for chapters, sections and subsections."""
    out = []
    pat = re.compile(r"\\contentsline \{(chapter|section|subsection)\}")
    for line in toc.read_text(encoding="utf-8", errors="replace").splitlines():
        m = pat.match(line)
        if not m:
            continue
        i = m.end()
        title, i = read_group(line, i)
        _, i = read_group(line, i)
        anchor, _ = read_group(line, i)
        num = ""
        nm = re.match(r"\\numberline \{([^}]*)\}(.*)", title)
        if nm:
            num, title = nm.group(1), nm.group(2)
        title = re.sub(r"\\[A-Za-z]+\s*(\{\})?", "", title).replace("{", "").replace("}", "")
        out.append((m.group(1), num, squash(title), anchor))
    return out


def export_pages(pdf, dst, label):
    dst.mkdir(parents=True, exist_ok=True)
    n = len(page_sizes(pdf))

    def one(i):
        target = dst / f"page-{i:03d}.svg"
        run(["pdftocairo", "-svg", "-f", str(i), "-l", str(i), str(pdf), str(target)], dst)
        return target.stat().st_size

    with cf.ThreadPoolExecutor(max_workers=6) as ex:
        total = sum(ex.map(one, range(1, n + 1)))
    print(f"  {label}: {n} pages, {total / 1e6:.1f} MB of SVG")
    return n


# --------------------------------------------------------------------------- check
# Two more builds of the marked-up file: "struck only" drops every addition and
# prints removals as plain text; "handwriting only" does the opposite. If the
# markup is right, the first reads exactly like the original PDF and the second
# exactly like the final one, so every change is shown and nothing else is.
MODE_OLD = r"""
\DIFshowaddedfalse
\renewcommand{\DIFaddtex}[1]{}
\renewcommand{\DIFdeltex}[1]{{#1}}
\DeclareRobustCommand\DIFgap{}
\DeclareRobustCommand\DIFmark[1]{}
\renewcommand{\DIFaddincludegraphics}[2][]{}
\renewcommand{\DIFdelincludegraphics}[2][]{\DIFOincludegraphics[#1]{#2}}
\renewcommand\DIFchangedgraphics[2][]{\DIFOincludegraphics[#1]{difold/#2}}
\renewcommand\DIFcrossbox[2]{#2\par}
\renewcommand\DIFdelbox[1]{#1}
\renewcommand\DIFdelcaption[6]{\caption[#6]{#5}}
\renewcommand\DIFoldlabel[1]{\label{#1}}
\renewcommand\DIFnewtable[1]{#1}
\renewenvironment{DIFfit}[1]{}{}
"""
MODE_NEW = r"""
\DIFshowremovedfalse
\renewcommand{\DIFaddtex}[1]{{#1}}
\renewcommand{\DIFdeltex}[1]{}
\DeclareRobustCommand\DIFgap{}
\DeclareRobustCommand\DIFmark[1]{}
\renewcommand{\DIFaddincludegraphics}[2][]{\DIFOincludegraphics[#1]{#2}}
\renewcommand{\DIFdelincludegraphics}[2][]{}
\renewcommand\DIFchangedgraphics[2][]{\DIFOincludegraphics[#1]{#2}}
\renewcommand\DIFdelbox[1]{}
\renewcommand\DIFnewtable[1]{#1}
\renewenvironment{DIFfit}[1]{}{}
"""


DRAFT = r"\PassOptionsToPackage{draft}{graphicx}"  # figures as empty boxes of the same size


def build_marked(dif, job, bbl, mode=None, draft=False, tex="main.tex"):
    """pdflatex <tex> as <job> against a given .bbl until references settle."""
    if mode:
        (dif / f"{job}.mode").write_text(mode, encoding="utf-8")
    shutil.copy2(bbl, dif / "build" / f"{job}.bbl")
    source = DRAFT + r"\input{" + tex + "}" if draft else tex
    for k in range(5):
        run(["pdflatex", "-interaction=nonstopmode", "-file-line-error", "-halt-on-error",
             "-output-directory=build", f"-jobname={job}", source],
            dif, WORK / f"pdflatex-{job}-{k + 1}.log")
        log = (dif / "build" / f"{job}.log").read_text(encoding="utf-8", errors="replace")
        if k >= 1 and "Rerun to get" not in log and "Label(s) may have changed" not in log:
            break
    return dif / "build" / f"{job}.pdf", sorted(set(re.findall(r"LaTeX Warning: [^\n]*", log)))


def words(pdf, layout_free=False):
    """The PDF's printed words. layout_free drops what depends on where the pages
    break rather than on the text: page numbers, the page numbers and dot leaders
    of the contents lists, and hyphens (so "CNN-" / "only" across a line break and
    "CNN-only" on one line compare equal)."""
    import unicodedata
    text = run(["pdftotext", "-enc", "UTF-8", str(pdf), "-"], pdf.parent).stdout
    text = unicodedata.normalize("NFKC", text)
    if layout_free:
        pages = []
        for page in text.split("\f"):
            lines = page.rstrip().split("\n")
            if lines and re.fullmatch(r"\s*([0-9]+|[ivxlcdm]+)\s*", lines[-1]):
                lines.pop()
            pages.append("\n".join(re.sub(r"(?:\s*\.){3,}\s*([0-9]+|[ivxlcdm]+)?\s*$", "", l)
                                   for l in lines))
        text = "\n".join(pages)
        text = re.sub(r"-\n", "", text).replace("-", "")
        # draft-mode figure boxes print their file names
        return [t for t in text.split() if not re.search(r"\.(pdf|png|jpe?g)$", t)]
    return re.sub(r"-\n(?=[a-z])", "", text).split()  # line-end hyphenation


def compare(expected_pdf, got_pdf):
    """Word-level differences between two PDFs' text, with a little context.

    The check builds do not paginate exactly like the real ones (an emptied
    \\DIFadd{} can leave a slightly wider space), so a float can land on another
    page and its words show up as removed in one place and inserted in another. A
    second pass pairs such runs (five or more words) and drops them."""
    a, b = words(expected_pdf, True), words(got_pdf, True)
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    hunks = [(i1, i2, j1, j2) for op, i1, i2, j1, j2 in sm.get_opcodes() if op != "equal"]
    gone = [(h, t) for h, (i1, i2, _, _) in enumerate(hunks) for t in a[i1:i2]]
    extra = [(h, t) for h, (_, _, j1, j2) in enumerate(hunks) for t in b[j1:j2]]
    moved_a, moved_b = set(), set()
    sm2 = difflib.SequenceMatcher(None, [t for _, t in gone], [t for _, t in extra], autojunk=False)
    for blk in sm2.get_matching_blocks():
        if blk.size >= 5:
            moved_a.update(range(blk.a, blk.a + blk.size))
            moved_b.update(range(blk.b, blk.b + blk.size))
    unexplained = {h for k, (h, _) in enumerate(gone) if k not in moved_a} \
        | {h for k, (h, _) in enumerate(extra) if k not in moved_b}
    out = []
    for h in sorted(unexplained):
        i1, i2, j1, j2 = hunks[h]
        out.append({"context": " ".join(a[max(0, i1 - 8):i1]),
                    "expected": " ".join(a[i1:i2]), "got": " ".join(b[j1:j2])})
    return {"words": len(a), "differences": out}


# --------------------------------------------------------------------------- main
def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--old", default=OLD_REV, help=f"original revision (default {OLD_REV})")
    ap.add_argument("--new", default=NEW_REV,
                    help=f"edited revision, or WORKTREE for uncommitted work (default {NEW_REV})")
    ap.add_argument("--overlay", help="folder of edited files laid over the edited tree by name")
    ap.add_argument("--tags", help="JSON with the page's wording and each change ID's metadata")
    args = ap.parse_args()
    meta = json.loads(Path(args.tags).read_text(encoding="utf-8")) if args.tags else {}

    perl, latexdiff = find_perl(), find_latexdiff()
    if WORK.exists():
        shutil.rmtree(WORK)
    old, new, dif = WORK / "old", WORK / "new", WORK / "diff"
    for d in (old, new):
        d.mkdir(parents=True)

    print("1. exporting trees")
    export_rev(args.old, old)
    if args.new == "WORKTREE":
        copy_worktree(new)
        new_src = {"kind": "worktree", "date": dt.datetime.now().strftime("%Y-%m-%d %H:%M")}
    else:
        export_rev(args.new, new)
        new_src = rev_label(args.new)
    if args.overlay:
        overlay = Path(args.overlay).resolve()
        files = apply_overlay(new, overlay)
        for name in files:
            if name.endswith(".tex"):
                p = new / name
                p.write_text(move_table_markers(p.read_text(encoding="utf-8")), encoding="utf-8", newline="\n")
        where = overlay.relative_to(DISS).as_posix() if overlay.is_relative_to(DISS) else str(overlay)
        new_src = {**new_src, "kind": "overlay", "overlay": where, "files": files}
        print(f"  overlay: {len(files)} files from {where}")
    to_lf(old)
    to_lf(new)

    print("2. building original and edited")
    for d in (old, new):
        run(["latexmk"], d, WORK / f"latexmk-{d.name}.log")
    old_pdf, new_pdf = old / "build" / "dissertation.pdf", new / "build" / "dissertation.pdf"
    old_bbl, new_bbl = old / "build" / "dissertation.bbl", new / "build" / "dissertation.bbl"

    old_floats, new_floats = parse_floats(old), parse_floats(new)
    old_nums, old_raw = parse_aux(old / "build" / "dissertation.aux")
    new_nums, _ = parse_aux(new / "build" / "dissertation.aux")

    figs_old = {p.name: p for p in (old / "figures").iterdir() if p.is_file()}
    figs_new = {p.name: p for p in (new / "figures").iterdir() if p.is_file()}
    changed = sorted(n for n in figs_old.keys() & figs_new.keys()
                     if n.endswith((".pdf", ".png", ".jpg"))
                     and figs_old[n].read_bytes() != figs_new[n].read_bytes())

    print("3. latexdiff")
    raw = run([perl, latexdiff, "--flatten", "--type=UNDERLINE", "--graphics-markup=both",
               "main.tex", str(new / "main.tex")], old, WORK / "latexdiff.log").stdout
    (WORK / "diff-raw.tex").write_text(raw, encoding="utf-8")

    notes = {"removed": [], "moved": [], "replaced": [], "added": [], "changed": [], "renumbered": []}
    diff = postprocess(raw, old_floats, new_floats, old_nums, changed, notes,
                       Source(old_pdf), Source(new_pdf), flatten(old), flatten(new))
    diff, n_tags = place_tags(diff)
    if n_tags:
        print(f"  {n_tags} change tags")
    # The crossed-out copy of a moved or rebuilt float says so in its margin note.
    for kind, rows in (("moved", notes["moved"]), ("replaced", notes["replaced"])):
        for r in rows:
            note = f"moved to {new_nums[r['label']][0]}" if kind == "moved" else "old version"
            i = diff.find("\\DIFoldlabel{" + r["label"] + "}")
            b = diff.rfind("\\ifDIFshowremoved\n\\begin{", 0, i)
            e = diff.find("\n", b + len("\\ifDIFshowremoved\n")) + 1
            diff = diff[:e] + f"\\renewcommand\\DIFcrossnote{{{note}}}%\n" + diff[e:]

    # Removed floats keep their original numbers for any reference in struck text.
    # \newlabel is preamble-only, so define the r@<label> macros it would make.
    def define(line):
        name, i = read_group(line, len("\\newlabel"))
        return f"\\global\\@namedef{{r@{name}}}{line[i:]}"
    labels = "\n".join(define(l) for r in notes["removed"] for l in old_raw.get(r["label"], []))
    style = (HERE / "difstyle.tex").read_text(encoding="utf-8")
    diff = diff.replace("\\begin{document}",
                        "% ---- red-pen markup (tools/dissertation-diff/difstyle.tex)\n"
                        + style + "\n\\begin{document}\n\\makeatletter\n" + labels
                        + "\n\\makeatother\n", 1)

    shutil.copytree(new, dif, ignore=shutil.ignore_patterns(
        "build", "chapters", "appendices", "preamble", "frontmatter", "main.tex"))
    for name, p in figs_old.items():  # removed figures still have to be drawn
        if name not in figs_new:
            shutil.copy2(p, dif / "figures" / name)
    (dif / "figures" / "difold").mkdir()
    for name in changed:
        shutil.copy2(figs_old[name], dif / "figures" / "difold" / name)
    (dif / "main.tex").write_text(diff, encoding="utf-8")
    (dif / "check.tex").write_text(diff, encoding="utf-8")  # the check builds' copy, never fitted
    (dif / "build").mkdir()

    print("4. building the marked-up version")
    diff_pdf, warnings = build_marked(dif, "dissertation", new_bbl)
    too_large = re.findall(r"Float too large for page by ([\d.]+)pt on input line (\d+)", "\n".join(warnings))
    if too_large:
        diff = fit_floats(diff, [(float(x), int(n)) for x, n in too_large])
        (dif / "main.tex").write_text(diff, encoding="utf-8")
        diff_pdf, warnings = build_marked(dif, "dissertation", new_bbl)

    print("5. checking it against both builds")
    # All four with graphics in draft mode, so the text inside figure files (axis
    # labels and the like) stays out of the comparison.
    for d in (old, new):
        (d / "draft.tex").write_text(DRAFT + "\n\\input{main}\n", encoding="utf-8")
        run(["latexmk", "-jobname=draft", "draft.tex"], d, WORK / f"latexmk-{d.name}-draft.log")
    pdf_old_view, _ = build_marked(dif, "verify-old", old_bbl, MODE_OLD, draft=True, tex="check.tex")
    pdf_new_view, _ = build_marked(dif, "verify-new", new_bbl, MODE_NEW, draft=True, tex="check.tex")
    check = {"original": compare(old / "build" / "draft.pdf", pdf_old_view),
             "final": compare(new / "build" / "draft.pdf", pdf_new_view)}
    for k, v in check.items():
        print(f"  {k}: {v['words']} words, {len(v['differences'])} differences")
        for h in v["differences"][:40]:
            print(f"    ...{h['context'][-50:]} | expected: {h['expected'][:80]!r} | got: {h['got'][:80]!r}")

    # Floats added, changed and renumbered (from the two plain builds).
    changed_stems = {Path(c).stem for c in changed}
    moved = {r["label"] for r in notes["moved"]}
    for r in notes["moved"] + notes["replaced"]:
        r["to"] = new_nums[r["label"]][0]
    for label, nf in new_floats.items():
        item = {"label": label, "kind": nf["env"], "number": new_nums[label][0],
                "title": squash(nf["entry"])}
        if label not in old_floats:
            notes["added"].append(item)
            continue
        if label in moved:
            continue
        if {Path(g).stem for g in nf["graphics"]} & changed_stems:
            notes["changed"].append(item)
        if old_nums[label][0] != new_nums[label][0]:
            notes["renumbered"].append({**item, "from": old_nums[label][0], "to": new_nums[label][0]})

    print("6. exporting pages")
    for d in ("original", "edited"):
        if (OUT / d).exists():
            shutil.rmtree(OUT / d)
    n_old = export_pages(old_pdf, OUT / "original", "original")
    n_dif = export_pages(diff_pdf, OUT / "edited", "edited")
    shutil.copy2(old_pdf, OUT / "original.pdf")
    shutil.copy2(diff_pdf, OUT / "edited.pdf")
    shutil.copy2(new_pdf, OUT / "final.pdf")

    # Sections present in both, matched by level, number and title, for synced scrolling.
    d_old, d_dif = dests(old_pdf), dests(diff_pdf)
    sizes_old, sizes_dif = page_sizes(old_pdf), page_sizes(diff_pdf)

    def at(d, sizes, anchor):
        page, y = d[anchor]
        h = sizes[page - 1][1]
        return {"page": page, "y": round(1 - (y if y is not None else h) / h, 4)}

    by_key = {(lv, num, t): a for lv, num, t, a in toc_entries(old / "build" / "dissertation.toc")}
    sections = []
    for lv, num, t, a in toc_entries(dif / "build" / "dissertation.toc"):
        a_old = by_key.get((lv, num, t))
        if a_old and a_old in d_old and a in d_dif:
            sections.append({"level": lv, "number": num, "title": t,
                             "original": at(d_old, sizes_old, a_old), "edited": at(d_dif, sizes_dif, a)})

    # Change positions, clustered: marks within 40 pt of each other on a page are one change.
    marks = []
    for line in (dif / "build" / "dissertation.difpos").read_text(encoding="utf-8").splitlines():
        kind, page, y = line.split()
        page = int(page)
        h = sizes_dif[page - 1][1]
        marks.append((page, 1 - float(y) * PT_PER_SP * (72 / 72.27) / h, kind))
    marks.sort()
    changes = []
    for page, y, kind in marks:
        if changes and changes[-1]["page"] == page and y - changes[-1]["y1"] < 40 / 842:
            c = changes[-1]
            c["y1"] = round(y, 4)
            c["kinds"] = "".join(sorted(set(c["kinds"] + kind)))
        else:
            changes.append({"page": page, "y": round(y, 4), "y1": round(y, 4), "kinds": kind})

    # Change tags: where each ID landed, and the IDs that have no place of their own.
    tags = None
    if n_tags:
        placed, edges = read_tags(dif / "build" / "dissertation.difrev", sizes_dif)
        ids = meta.get("ids", {})
        unknown = sorted({t["id"] for t in placed} - set(ids))
        if ids and unknown:
            print(f"  tags with no metadata: {', '.join(unknown)}")
        unplaced = sorted(i for i, v in ids.items() if not v.get("in") and i not in {t["id"] for t in placed})
        tags = {"ids": ids, "stages": meta.get("stages", {}), "placed": placed, "text": edges,
                "unplaced": unplaced, "source": meta.get("page", {}).get("tagged", "")}
        print(f"  tags: {len(placed)} placed for {len({t['id'] for t in placed})} IDs; "
              f"not placed: {', '.join(unplaced) or 'none'}")

    manifest = {
        "built": dt.datetime.now().isoformat(timespec="seconds"),
        "command": subprocess.list2cmdline(["python", "tools/dissertation-diff/build.py"] + sys.argv[1:]),
        "page": meta.get("page"),
        "tags": tags,
        "original": {"source": rev_label(args.old), "pages": [list(s) for s in sizes_old],
                     "pdf": "original.pdf", "dir": "original"},
        "edited": {"source": new_src, "pages": [list(s) for s in sizes_dif],
                   "pdf": "edited.pdf", "dir": "edited",
                   "final_pdf": "final.pdf", "final_pages": len(page_sizes(new_pdf))},
        "sections": sections,
        "changes": changes,
        "floats": notes,
        "check": check,
        "latex_warnings": warnings,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    print(f"done: {n_old} original pages, {n_dif} marked-up pages, {len(changes)} changes, "
          f"{len(warnings)} LaTeX warnings")
    for w in warnings:
        print("  ", w)
    for k, v in notes.items():
        if v:
            print(f"  floats {k}: " + ", ".join(f"{r['label']} {r.get('from', r['number'])}"
                                                + (f" -> {r['to']}" if 'to' in r else "") for r in v))


if __name__ == "__main__":
    main()


