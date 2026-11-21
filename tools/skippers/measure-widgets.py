"""SKIPPERS · FORMS - print every AcroForm widget rectangle of the source PDFs.

    pip install pypdf            (or: pip install --target <dir> pypdf and set PYTHONPATH)
    python tools/skippers/measure-widgets.py

Prints, per page, each widget's name, type and /Rect flipped to top-down PDF
points ([x, top, w, h]) plus the same as % of the page. These are the boxes
in src/components/portal/modules/skippers/fields.js.
"""
import os
import sys

from pypdf import PdfReader

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "Documents", "portal", "skippers")
FILES = ["Eyesight Declaration for Non MDL holders.pdf", "Letter of Consent for U18s.pdf"]

for name in sys.argv[1:] or FILES:
    path = name if os.path.isabs(name) else os.path.join(SRC, name)
    reader = PdfReader(path)
    print("==", os.path.basename(path))
    for pi, page in enumerate(reader.pages):
        W = float(page.mediabox.width)
        H = float(page.mediabox.height)
        rows = []
        for ref in page.get("/Annots") or []:
            a = ref.get_object()
            if a.get("/Subtype") != "/Widget":
                continue
            field = a.get("/T")
            kind = a.get("/FT")
            if field is None and a.get("/Parent") is not None:
                parent = a["/Parent"].get_object()
                field = parent.get("/T")
                kind = kind or parent.get("/FT")
            x0, y0, x1, y1 = [float(v) for v in a["/Rect"]]
            rows.append((H - y1, x0, str(field), str(kind), x1 - x0, y1 - y0))
        for top, x, field, kind, w, h in sorted(rows):
            print(
                f"p{pi + 1} {field:24s} {kind:5s} [{x:.1f}, {top:.1f}, {w:.1f}, {h:.1f}]"
                f"  x%={x / W * 100:.2f} y%={top / H * 100:.2f} w%={w / W * 100:.2f}"
            )
