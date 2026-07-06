import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../icons';

/* ============================================================================
   CODE VISUALISER — interactive, annotated walkthrough of real source files
   ----------------------------------------------------------------------------
   A VS-Code-shaped reader for the Mamba_PSMA honours codebase. A dark Explorer
   rail lists the files; the editor pane shows the SELECTED file as an annotated
   walkthrough — real code (exact lines + real line numbers) beside interactive
   diagrams that show what each part actually does. A "Full file" toggle swaps
   the walkthrough for the whole file in one scroll.

   For now the only visualised file is models/mamba_block_3d.py (step 2 of the
   model build). FILES[] is the source of truth — adding another file later is a
   new entry with its source string + chapter ranges; the shell never changes.

   Styled with the .cv-* block in portal.css. The Explorer + code editor use a
   fixed dark "IDE" palette (code reads as code in any theme); the explanation
   panels use the portal's Reading Room theme tokens so they blend in.
   ========================================================================== */

// ── The exact source of models/mamba_block_3d.py (single source of truth) ────
// Line numbers shown in the UI are this file's real line numbers, so the page
// lines up 1:1 with the file open in an editor beside it.
const MAMBA_SRC = `# MambaBlock3D
"""
Reusable 3D Mamba block — the atom of the hybrid CNN-Mamba U-Net.

Wraps \`mamba_ssm.Mamba\` (Mamba-1) or \`mamba_ssm.Mamba2\` (SSD) with:
  - 3D feature map -> 1D sequence flattening      (B, C, D, H, W) -> (B, L, C)
  - Multi-directional selective scan (up to 6 directions: +/-x, +/-y, +/-z)
  - Sequence -> 3D reshape that exactly inverts the flatten
Pre-norm + residual, shape-preserving: (B, C, D, H, W) in -> (B, C, D, H, W) out.

A single 1D flatten biases the scan (voxels adjacent in 3D can be far apart on the
line). Following SegMamba's "tri-orientated" idea generalised to both directions,
each enabled direction scans primarily along one spatial axis (forward or reverse)
with its own Mamba instance; the per-direction outputs are summed. \`n_directions\`
is configurable so you can start bidirectional (2) for correctness and scale to 6.

Mamba-1 <-> Mamba-2 is swappable via \`version\`. Config-driven: construct directly
with kwargs or via \`MambaBlock3D.from_config(dim, cfg)\`.

Requires torch + mamba_ssm (compiled CUDA kernels; see documentation/memory/env-setup-recipe.md).
"""

import torch
import torch.nn as nn

from mamba_ssm import Mamba, Mamba2

# Spatial axes of (B, C, D, H, W) are (D, H, W) == index (0, 1, 2). Each direction is
# (perm, flip): \`perm\` reorders the spatial axes so the *last* one varies fastest in the
# flattened sequence — i.e. the scan runs primarily along that axis; \`flip\` reverses it.
# Ordered so n_directions=1 -> +x, 2 -> +/-x (the bidirectional MVP), ... 6 -> all six.
_DIRECTIONS = [
    ((0, 1, 2), False),  # +x : (D, H, W), scan along W
    ((0, 1, 2), True),   # -x
    ((0, 2, 1), False),  # +y : (D, W, H), scan along H
    ((0, 2, 1), True),   # -y
    ((1, 2, 0), False),  # +z : (H, W, D), scan along D
    ((1, 2, 0), True),   # -z
]


class MambaBlock3D(nn.Module):
    """
    dim          : channel / model dimension C (== d_model), i.e. channels at this stage.
    version      : "mamba1" (mamba_ssm.Mamba) or "mamba2" (SSD, mamba_ssm.Mamba2).
    n_directions : number of scan directions in [1, 6] (2 = bidirectional, 6 = full).
    d_state      : SSM state size; defaults to 16 (Mamba-1) / 128 (Mamba-2) if None.
    d_conv       : depthwise causal conv width.
    expand       : inner expansion factor (inner dim = expand * dim).
    headdim      : Mamba-2 head dim; expand*dim must be divisible by it (ignored for Mamba-1).
    """

    def __init__(self, dim, version="mamba1", n_directions=6,
                 d_state=None, d_conv=4, expand=2, headdim=64):
        super().__init__()
        if version not in ("mamba1", "mamba2"):
            raise ValueError(f"version must be 'mamba1' or 'mamba2', got {version!r}")
        if not 1 <= n_directions <= len(_DIRECTIONS):
            raise ValueError(f"n_directions must be in [1, {len(_DIRECTIONS)}], got {n_directions}")

        self.dim = dim
        self.version = version
        self.d_conv = d_conv
        self.expand = expand
        self.headdim = headdim
        self.d_state = d_state if d_state is not None else (16 if version == "mamba1" else 128)
        self.directions = _DIRECTIONS[:n_directions]

        if version == "mamba2":
            d_inner = expand * dim
            if d_inner % headdim != 0:
                raise ValueError(
                    f"Mamba-2 requires expand*dim ({d_inner}) divisible by headdim ({headdim}); "
                    f"got dim={dim}, expand={expand}. Use dim like 64/128/256 with headdim=64."
                )

        # Pre-norm over the channel dim (applied once per forward; equivalent to
        # normalising every flattened sequence since LayerNorm is per-token over C).
        self.norm = nn.LayerNorm(dim)
        # One Mamba instance per direction (SegMamba-style); they do not share weights.
        self.mambas = nn.ModuleList([self._make_core() for _ in self.directions])

    def _make_core(self):
        if self.version == "mamba1":
            return Mamba(d_model=self.dim, d_state=self.d_state,
                         d_conv=self.d_conv, expand=self.expand)
        return Mamba2(d_model=self.dim, d_state=self.d_state, d_conv=self.d_conv,
                      expand=self.expand, headdim=self.headdim)

    # --- flatten / un-flatten (pure reshape, no learned params) -----------------
    # _unflatten(_flatten(x, perm, flip), B, C, spatial, perm, flip) == x, exactly.

    @staticmethod
    def _flatten(x, perm, flip):
        """(B, C, D, H, W) -> (B, L, C) for a given spatial axis order + direction."""
        full = (0, 1, 2 + perm[0], 2 + perm[1], 2 + perm[2])
        seq = x.permute(*full).flatten(2).transpose(1, 2).contiguous()  # (B, L, C)
        if flip:
            seq = seq.flip(1)
        return seq

    @staticmethod
    def _unflatten(seq, B, C, spatial, perm, flip):
        """(B, L, C) -> (B, C, D, H, W), inverting the matching _flatten call."""
        if flip:
            seq = seq.flip(1)
        permuted_shape = tuple(spatial[p] for p in perm)                # (s0, s1, s2)
        x = seq.transpose(1, 2).reshape(B, C, *permuted_shape)         # (B, C, s0, s1, s2)
        full = (0, 1, 2 + perm[0], 2 + perm[1], 2 + perm[2])
        inv = [0] * 5
        for i, p in enumerate(full):
            inv[p] = i
        return x.permute(*inv).contiguous()

    def forward(self, x):
        """x: (B, C, D, H, W) with C == dim  ->  same shape."""
        if x.shape[1] != self.dim:
            raise ValueError(f"expected {self.dim} channels, got {x.shape[1]} (shape {tuple(x.shape)})")
        B, C, D, H, W = x.shape
        spatial = (D, H, W)
        residual = x

        # channels-last so LayerNorm normalises over C, then back to channels-first.
        xn = self.norm(x.movedim(1, -1)).movedim(-1, 1)

        out = None
        for mamba, (perm, flip) in zip(self.mambas, self.directions):
            seq = self._flatten(xn, perm, flip)     # (B, L, C)
            y = mamba(seq)                          # selective scan, (B, L, C)
            vol = self._unflatten(y, B, C, spatial, perm, flip)
            out = vol if out is None else out + vol

        return residual + out

    @classmethod
    def from_config(cls, dim, cfg):
        """Build from a config dict of Mamba params (e.g. config['model']['mamba'])."""
        cfg = cfg or {}
        return cls(
            dim,
            version=cfg.get("version", "mamba1"),
            n_directions=cfg.get("n_directions", 6),
            d_state=cfg.get("d_state"),
            d_conv=cfg.get("d_conv", 4),
            expand=cfg.get("expand", 2),
            headdim=cfg.get("headdim", 64),
        )


# ---------------------------------------------------------------------------
# Standalone test: forward + backward on the GPU, shape preserved, grads flow.
#   python models/mamba_block_3d.py
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import time

    assert torch.cuda.is_available(), "CUDA GPU required (activate the \`mamba\` conda env)."
    device = torch.device("cuda")
    torch.manual_seed(0)
    print(f"Device: {torch.cuda.get_device_name(0)}  |  torch {torch.__version__}\\n")

    # --- 1. reshape reversibility (the #1 bug source): un-flatten must exactly
    #        invert flatten for every direction, or features land in wrong voxels.
    print("[1] Flatten/un-flatten reversibility (all 6 directions)")
    B, C, D, H, W = 2, 3, 4, 5, 6
    ref = torch.arange(B * C * D * H * W, device=device).reshape(B, C, D, H, W).float()
    for perm, flip in _DIRECTIONS:
        seq = MambaBlock3D._flatten(ref, perm, flip)
        back = MambaBlock3D._unflatten(seq, B, C, (D, H, W), perm, flip)
        assert torch.equal(back, ref), f"reshape not reversible for perm={perm} flip={flip}"
    print(f"  [ OK ]  all {len(_DIRECTIONS)} directions round-trip exactly\\n")

    # --- 2. forward + backward for each variant/direction count --------------
    scenarios = [
        dict(name="mamba1 · bidirectional (2 dir)", version="mamba1", n_directions=2,
             dim=64, shape=(1, 64, 16, 32, 16)),
        dict(name="mamba1 · 6-direction",           version="mamba1", n_directions=6,
             dim=64, shape=(1, 64, 16, 32, 16)),
        dict(name="mamba2 · 6-direction (SSD)",     version="mamba2", n_directions=6,
             dim=128, shape=(2, 128, 8, 16, 8)),
    ]

    print("[2] Forward + backward on CUDA (shape preserved, gradients flow)")
    for s in scenarios:
        block = MambaBlock3D(s["dim"], version=s["version"],
                             n_directions=s["n_directions"]).to(device)
        n_params = sum(p.numel() for p in block.parameters())
        x = torch.randn(*s["shape"], device=device, requires_grad=True)

        torch.cuda.reset_peak_memory_stats(device)
        torch.cuda.synchronize()
        t0 = time.perf_counter()

        out = block(x)
        loss = out.float().mean()
        loss.backward()

        torch.cuda.synchronize()
        dt_ms = (time.perf_counter() - t0) * 1e3
        peak_mb = torch.cuda.max_memory_allocated(device) / 1024**2

        assert out.shape == x.shape, f"shape changed: in {tuple(x.shape)} -> out {tuple(out.shape)}"
        assert torch.isfinite(out).all(), "non-finite values in output"
        assert x.grad is not None and torch.isfinite(x.grad).all(), "no/invalid gradient on input"
        grad_params = sum(1 for p in block.parameters() if p.grad is not None and p.grad.abs().sum() > 0)
        assert grad_params > 0, "no gradients reached block parameters"

        L = s["shape"][2] * s["shape"][3] * s["shape"][4]
        print(f"  [ OK ]  {s['name']:<30}  in={tuple(x.shape)} L={L:>6}  "
              f"params={n_params/1e6:5.2f}M  fwd+bwd={dt_ms:6.1f}ms  peakVRAM={peak_mb:6.1f}MB")

    print("\\nALL CHECKS PASSED - MambaBlock3D ready for step 3 (encoder assembly).")`;

const MAMBA_LINES = MAMBA_SRC.split('\n');

// ── Explorer tree (files[].id selects the walkthrough; stubs are non-clickable) ──
const TREE = [
  {
    type: 'folder', name: 'models', open: true, children: [
      { type: 'file', id: 'mamba_block_3d', name: 'mamba_block_3d.py', lang: 'py', ready: true, loc: MAMBA_LINES.length },
      { type: 'file', name: 'encoder.py', lang: 'py', ready: false },
      { type: 'file', name: 'decoder.py', lang: 'py', ready: false },
      { type: 'file', name: 'psma_mamba.py', lang: 'py', ready: false },
    ],
  },
];

/* ── Lightweight, stateful Python highlighter ───────────────────────────────
   Handles triple-quoted docstrings spanning lines; tags keywords, builtins,
   strings, comments, numbers, decorators, def/class names and self/cls. */
const PY_KW = new Set(['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'not', 'and', 'or',
  'is', 'import', 'from', 'as', 'with', 'try', 'except', 'finally', 'raise', 'assert', 'lambda', 'yield',
  'pass', 'break', 'continue', 'global', 'nonlocal', 'del', 'None', 'True', 'False']);
const PY_BI = new Set(['torch', 'nn', 'super', 'ValueError', 'range', 'len', 'sum', 'print', 'zip', 'enumerate',
  'tuple', 'list', 'dict', 'set', 'int', 'float', 'str', 'bool', 'isinstance', 'staticmethod', 'classmethod',
  'property', 'Mamba', 'Mamba2', 'time', 'dict']);

function highlight(lines) {
  let triple = null;
  let defNext = false;
  const out = [];
  for (const line of lines) {
    const spans = [];
    const push = (text, cls) => { if (text !== '') spans.push({ text, cls: cls || null }); };
    let i = 0;
    if (triple) {
      const c = line.indexOf(triple);
      if (c === -1) { push(line, 'str'); out.push(spans); continue; }
      push(line.slice(0, c + 3), 'str'); i = c + 3; triple = null;
    }
    while (i < line.length) {
      const rest = line.slice(i);
      if (rest[0] === '#') { push(rest, 'com'); break; }
      const t3 = rest.slice(0, 3);
      if (t3 === '"""' || t3 === "'''") {
        const c = rest.indexOf(t3, 3);
        if (c === -1) { push(rest, 'str'); triple = t3; break; }
        push(rest.slice(0, c + 3), 'str'); i += c + 3; continue;
      }
      const sm = rest.match(/^("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/);
      if (sm) { push(sm[0], 'str'); i += sm[0].length; continue; }
      const dm = rest.match(/^@[A-Za-z_][\w.]*/);
      if (dm) { push(dm[0], 'dec'); i += dm[0].length; continue; }
      const nm = rest.match(/^\d[\d_]*\.?\d*(?:[eE]-?\d+)?/);
      if (nm) { push(nm[0], 'num'); i += nm[0].length; defNext = false; continue; }
      const im = rest.match(/^[A-Za-z_]\w*/);
      if (im) {
        const w = im[0];
        let cls = null;
        if (defNext) { cls = 'fn'; defNext = false; }
        else if (PY_KW.has(w)) { cls = 'kw'; if (w === 'def' || w === 'class') defNext = true; }
        else if (w === 'self' || w === 'cls') cls = 'self';
        else if (PY_BI.has(w)) cls = 'bi';
        push(w, cls); i += w.length; continue;
      }
      const wm = rest.match(/^\s+/);
      if (wm) { push(wm[0], null); i += wm[0].length; continue; }
      push(rest[0], 'op'); i += 1;
    }
    out.push(spans);
  }
  return out;
}

// One rendered code block: exact lines + real line numbers + syntax colour.
function CodeBlock({ fromLine, lines, label, tall = false }) {
  const rows = useMemo(() => highlight(lines), [lines]);
  return (
    <div className={`cv-code${tall ? ' cv-code--tall' : ''}`} role="figure" aria-label={label}>
      <pre className="cv-code__pre">
        {rows.map((spans, idx) => (
          <div className="cv-code__row" key={idx}>
            <span className="cv-code__ln" aria-hidden="true">{fromLine + idx}</span>
            <code className="cv-code__line">
              {spans.length
                ? spans.map((s, i) => (
                  <span key={i} className={s.cls ? `cv-tok cv-tok--${s.cls}` : undefined}>{s.text}</span>
                ))
                : ' '}
            </code>
          </div>
        ))}
      </pre>
    </div>
  );
}

/* ── Direction model (mirrors _DIRECTIONS exactly) ──────────────────────────
   Each direction picks one spatial axis of (D, H, W) to be the fastest-varying
   in the flattened sequence (the scan then runs primarily along it), forward or
   reversed. Labels ±x/±y/±z map x→W, y→H, z→D to match the file's comments. */
const DIRS = [
  { perm: [0, 1, 2], flip: false, label: '+x', axis: 'W', word: 'along W → forward' },
  { perm: [0, 1, 2], flip: true, label: '−x', axis: 'W', word: 'along W → reverse' },
  { perm: [0, 2, 1], flip: false, label: '+y', axis: 'H', word: 'along H → forward' },
  { perm: [0, 2, 1], flip: true, label: '−y', axis: 'H', word: 'along H → reverse' },
  { perm: [1, 2, 0], flip: false, label: '+z', axis: 'D', word: 'along D → forward' },
  { perm: [1, 2, 0], flip: true, label: '−z', axis: 'D', word: 'along D → reverse' },
];

const DEMO = { D: 2, H: 3, W: 4 };          // small volume for the flatten demo
const DEMO_N = DEMO.D * DEMO.H * DEMO.W;     // 24 voxels

// Sequence order of original (d,h,w) coords for a direction — mirrors _flatten.
function scanOrder({ perm, flip }, dims = DEMO) {
  const S = [dims.D, dims.H, dims.W];
  const sizes = [S[perm[0]], S[perm[1]], S[perm[2]]];
  const order = [];
  for (let a = 0; a < sizes[0]; a++)
    for (let b = 0; b < sizes[1]; b++)
      for (let c = 0; c < sizes[2]; c++) {
        const coord = [0, 0, 0];
        coord[perm[0]] = a; coord[perm[1]] = b; coord[perm[2]] = c;
        order.push({ d: coord[0], h: coord[1], w: coord[2] });
      }
  if (flip) order.reverse();
  return order;
}

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
};

// Compact 6-button direction picker (shared control).
function DirPicker({ dir, setDir, nDir }) {
  return (
    <div className="cv-dirpick" role="group" aria-label="Scan direction">
      {DIRS.map((d, i) => (
        <button
          key={d.label}
          className={`cv-dirpick__btn${i === dir ? ' cv-dirpick__btn--active' : ''}${nDir != null && i >= nDir ? ' cv-dirpick__btn--off' : ''}`}
          onClick={() => setDir(i)}
          aria-pressed={i === dir}
          title={d.word}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

/* ── Chapter 1 · block dataflow diagram ─────────────────────────────────── */
function DataflowViz({ nDir }) {
  const reduced = usePrefersReducedMotion();
  const branches = Array.from({ length: nDir }, (_, i) => i);
  return (
    <svg className={`cv-flow${reduced ? ' cv-flow--still' : ''}`} viewBox="0 0 360 210" role="img"
      aria-label="Block dataflow: input, layernorm, per-direction scans summed, plus a residual skip">
      <defs>
        <marker id="cvArrow" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" className="cv-flow__arrowhead" />
        </marker>
      </defs>

      {/* residual skip (input -> add) */}
      <path className="cv-flow__skip" d="M40,38 C40,14 330,14 330,150" markerEnd="url(#cvArrow)" />
      <text className="cv-flow__skiplabel" x="185" y="10" textAnchor="middle">residual skip</text>

      {/* input */}
      <g transform="translate(12,38)">
        <rect className="cv-flow__box cv-flow__box--io" width="72" height="34" rx="5" />
        <text className="cv-flow__t" x="36" y="15">x</text>
        <text className="cv-flow__st" x="36" y="27">B,C,D,H,W</text>
      </g>
      <path className="cv-flow__wire" d="M84,55 L104,55" markerEnd="url(#cvArrow)" />

      {/* layernorm */}
      <g transform="translate(104,38)">
        <rect className="cv-flow__box" width="72" height="34" rx="5" />
        <text className="cv-flow__t" x="36" y="15">LayerNorm</text>
        <text className="cv-flow__st" x="36" y="27">over C</text>
      </g>

      {/* fan-out to N scans */}
      {branches.map((i) => {
        const y = 42 + i * 24;
        return (
          <g key={i}>
            <path className="cv-flow__wire" d={`M176,55 C196,55 196,${y + 9} 216,${y + 9}`} markerEnd="url(#cvArrow)" />
            <g transform={`translate(216,${y})`}>
              <rect className="cv-flow__box cv-flow__box--scan" width="70" height="18" rx="4" />
              <text className="cv-flow__t cv-flow__t--sm" x="35" y="13">{DIRS[i].label} · Mamba</text>
            </g>
            <path className="cv-flow__wire" d={`M286,${y + 9} C300,${y + 9} 300,120 312,120`} markerEnd="url(#cvArrow)" />
          </g>
        );
      })}

      {/* sum */}
      <g transform="translate(312,108)">
        <circle className="cv-flow__op" cx="12" cy="12" r="12" />
        <text className="cv-flow__op-t" x="12" y="16">Σ</text>
      </g>
      <path className="cv-flow__wire" d="M324,132 L324,150" markerEnd="url(#cvArrow)" />

      {/* add residual */}
      <g transform="translate(312,150)">
        <circle className="cv-flow__op cv-flow__op--add" cx="12" cy="12" r="12" />
        <text className="cv-flow__op-t" x="12" y="16">+</text>
      </g>

      {/* output */}
      <path className="cv-flow__wire" d="M324,174 L324,182 L60,182 L60,166" markerEnd="url(#cvArrow)" />
      <g transform="translate(24,150)">
        <rect className="cv-flow__box cv-flow__box--io" width="72" height="16" rx="4" />
        <text className="cv-flow__t cv-flow__t--sm" x="36" y="11">out · same shape</text>
      </g>
    </svg>
  );
}

/* ── Chapter 2 · 3D axis widget + direction table ───────────────────────── */
function DirectionsViz({ dir, setDir, nDir, setNDir }) {
  // isometric screen directions for the three axes (from a shared origin)
  const O = { x: 150, y: 96 };
  const U = { W: [64, 34], H: [-64, 34], D: [0, -66] }; // axis -> [dx,dy]
  const axisArrow = (axis, sign) => {
    const [dx, dy] = U[axis];
    return { x2: O.x + sign * dx, y2: O.y + sign * dy };
  };
  return (
    <div className="cv-dirs">
      <svg className="cv-axis" viewBox="0 0 300 200" role="img" aria-label="Six scan directions on the D, H, W axes">
        <defs>
          <marker id="cvAx" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" className="cv-axis__head" />
          </marker>
          <marker id="cvAxA" markerWidth="8" markerHeight="8" refX="5.5" refY="3.2" orient="auto">
            <path d="M0,0 L6.5,3.2 L0,6.4 Z" className="cv-axis__head cv-axis__head--on" />
          </marker>
        </defs>
        {/* little reference cube at the origin */}
        <g className="cv-axis__cube">
          <path d="M150,96 l32,17 M150,96 l-32,17 M150,96 l0,-33" />
        </g>
        {DIRS.map((d, i) => {
          const { x2, y2 } = axisArrow(d.axis, d.flip ? -1 : 1);
          const on = i === dir;
          const off = i >= nDir && i !== dir;
          return (
            <g key={d.label}
              className={`cv-axis__dir${on ? ' cv-axis__dir--on' : ''}${off ? ' cv-axis__dir--off' : ''}`}
              onClick={() => setDir(i)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDir(i); } }}>
              <line x1={O.x} y1={O.y} x2={x2} y2={y2} markerEnd={on ? 'url(#cvAxA)' : 'url(#cvAx)'} />
              <circle cx={x2} cy={y2} r="11" className="cv-axis__hit" />
              <text x={x2} y={y2 + 3.5} textAnchor="middle" className="cv-axis__lbl">{d.label}</text>
            </g>
          );
        })}
        <circle cx={O.x} cy={O.y} r="3.2" className="cv-axis__origin" />
      </svg>

      <div className="cv-dirtable">
        <div className="cv-dirtable__head">
          <span>dir</span><span>perm (D,H,W)→</span><span>fastest axis</span>
        </div>
        {DIRS.map((d, i) => (
          <button key={d.label}
            className={`cv-dirtable__row${i === dir ? ' cv-dirtable__row--on' : ''}${i >= nDir && i !== dir ? ' cv-dirtable__row--off' : ''}`}
            onClick={() => setDir(i)}>
            <span className="cv-dirtable__k">{d.label}</span>
            <code>({d.perm.join(',')}){d.flip ? ' · flip' : ''}</code>
            <span>{d.axis}{d.flip ? ' (rev)' : ''}</span>
          </button>
        ))}
      </div>

      <label className="cv-slider">
        <span className="cv-slider__label">n_directions <b>{nDir}</b></span>
        <input type="range" min="1" max="6" value={nDir}
          onChange={(e) => { const v = +e.target.value; setNDir(v); if (dir >= v) setDir(v - 1); }} />
        <span className="cv-slider__hint">{nDir === 2 ? 'bidirectional MVP' : nDir === 6 ? 'full 6-way scan' : `${nDir} active`}</span>
      </label>
    </div>
  );
}

/* ── Chapter 3 · the flatten animation (the crux) ───────────────────────── */
function FlattenViz({ dir, setDir }) {
  const reduced = usePrefersReducedMotion();
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [hover, setHover] = useState(-1);
  const timer = useRef(null);

  // reset the animation when the direction changes (derive during render — no effect)
  const [seenDir, setSeenDir] = useState(dir);
  if (seenDir !== dir) { setSeenDir(dir); setStep(-1); setPlaying(false); }

  const order = useMemo(() => scanOrder(DIRS[dir]), [dir]);
  // seqIndex[d][h][w] -> position in the flattened sequence
  const seqIndex = useMemo(() => {
    const m = {};
    order.forEach((c, t) => { m[`${c.d}-${c.h}-${c.w}`] = t; });
    return m;
  }, [order]);

  useEffect(() => {
    if (!playing) return undefined;
    timer.current = setInterval(() => {
      setStep((s) => (s + 1 >= DEMO_N ? 0 : s + 1));   // loop the scan until paused
    }, 260);
    return () => clearInterval(timer.current);
  }, [playing]);

  const activeSeq = hover >= 0 ? hover : step;
  const d = DIRS[dir];
  const permStr = `(0, 1, ${2 + d.perm[0]}, ${2 + d.perm[1]}, ${2 + d.perm[2]})`;

  const cellClass = (t) => {
    let c = 'cv-vox';
    if (t === activeSeq) c += ' cv-vox--active';
    else if (step >= 0 && t < step) c += ' cv-vox--seen';
    return c;
  };

  return (
    <div className="cv-flatten">
      <DirPicker dir={dir} setDir={setDir} />

      <div className="cv-flatten__echo">
        <code>x.permute{permStr}.flatten(2){d.flip ? '.flip(1)' : ''}</code>
        <span className="cv-flatten__echo-note">scan {d.word}</span>
      </div>

      {/* the 3D volume, drawn as D depth-slices of an H×W grid */}
      <div className="cv-vol" aria-label="3D feature map as depth slices">
        {Array.from({ length: DEMO.D }, (_, dd) => (
          <div className="cv-slice" key={dd}>
            <span className="cv-slice__z">z&nbsp;=&nbsp;{dd}</span>
            <div className="cv-slice__grid" style={{ gridTemplateColumns: `repeat(${DEMO.W}, 1fr)` }}>
              {Array.from({ length: DEMO.H }, (_, hh) =>
                Array.from({ length: DEMO.W }, (_, ww) => {
                  const t = seqIndex[`${dd}-${hh}-${ww}`];
                  return (
                    <div key={`${hh}-${ww}`}
                      className={cellClass(t)}
                      style={{ '--t': DEMO_N > 1 ? t / (DEMO_N - 1) : 0 }}
                      onMouseEnter={() => setHover(t)}
                      onMouseLeave={() => setHover(-1)}
                      onClick={() => setStep(t)}>
                      {t}
                    </div>
                  );
                }),
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="cv-unroll" aria-hidden="true">↓ flatten to a 1D sequence of length L = D·H·W = {DEMO_N}</div>

      {/* the resulting 1D sequence */}
      <div className="cv-strip" role="img" aria-label="Flattened 1D sequence in scan order">
        {order.map((c, t) => (
          <div key={t}
            className={`cv-strip__cell${t === activeSeq ? ' cv-strip__cell--active' : ''}${step >= 0 && t < step ? ' cv-strip__cell--seen' : ''}`}
            style={{ '--t': DEMO_N > 1 ? t / (DEMO_N - 1) : 0 }}
            onMouseEnter={() => setHover(t)}
            onMouseLeave={() => setHover(-1)}
            onClick={() => setStep(t)}
            title={`seq ${t}  ←  voxel (d=${c.d}, h=${c.h}, w=${c.w})`}>
            <span className="cv-strip__t">{t}</span>
            <span className="cv-strip__c">{c.d}·{c.h}·{c.w}</span>
          </div>
        ))}
      </div>

      <div className="cv-flatten__ctrls">
        <button className="cv-btn cv-btn--go" onClick={() => {
          if (!playing && step + 1 >= DEMO_N) setStep(-1);   // restart if parked at the end
          setPlaying((p) => !p);
        }}>
          {playing ? '❙❙ Pause' : '▶ Play scan'}
        </button>
        <input className="cv-scrub" type="range" min="-1" max={DEMO_N - 1} value={step}
          onChange={(e) => { setPlaying(false); setStep(+e.target.value); }} aria-label="Scrub scan position" />
        <button className="cv-btn" onClick={() => { setPlaying(false); setStep(-1); }}>Reset</button>
      </div>
      {reduced && <p className="cv-note">Reduced-motion is on — use the slider to step through the scan.</p>}

      <p className="cv-flatten__reverse">
        <strong>Reversibility:</strong> <code>_unflatten</code> replays these steps backwards —
        same permute, same flip — so every voxel lands back exactly where it started. The test asserts
        this for all six directions.
      </p>
    </div>
  );
}

/* ── Chapter 4 · Mamba-1 vs Mamba-2 swap ────────────────────────────────── */
const VERSIONS = {
  mamba1: {
    call: 'Mamba(d_model=dim, d_state=16, d_conv=4, expand=2)',
    rows: [
      ['import', 'from mamba_ssm import Mamba'],
      ['d_state', '16 (small diagonal state)'],
      ['A matrix', 'per-channel diagonal'],
      ['scan', 'sequential selective scan'],
      ['best for', 'the correctness baseline'],
    ],
  },
  mamba2: {
    call: 'Mamba2(d_model=dim, d_state=128, ..., headdim=64)',
    rows: [
      ['import', 'from mamba_ssm import Mamba2'],
      ['d_state', '128 (larger state, SSD)'],
      ['A matrix', 'scalar per head'],
      ['scan', 'chunked parallel scan (chunk 256)'],
      ['constraint', 'expand·dim must divide by headdim'],
    ],
  },
};

function BuildViz({ version, setVersion }) {
  const v = VERSIONS[version];
  const dInner = 2 * 128;
  return (
    <div className="cv-build">
      <div className="cv-toggle" role="group" aria-label="Mamba version">
        {['mamba1', 'mamba2'].map((k) => (
          <button key={k} className={`cv-toggle__opt${version === k ? ' cv-toggle__opt--on' : ''}`}
            onClick={() => setVersion(k)} aria-pressed={version === k}>
            {k === 'mamba1' ? 'Mamba-1' : 'Mamba-2 (SSD)'}
          </button>
        ))}
      </div>

      <div className="cv-modlist" aria-label="one Mamba instance per direction">
        <span className="cv-modlist__label">self.mambas = ModuleList</span>
        <div className="cv-modlist__row">
          {DIRS.map((d) => (
            <span key={d.label} className="cv-modlist__chip">{d.label}<em>{version === 'mamba1' ? 'M1' : 'M2'}</em></span>
          ))}
        </div>
        <span className="cv-modlist__note">one selective-scan core per direction — separate weights, summed in forward()</span>
      </div>

      <code className="cv-build__call">{v.call}</code>
      <dl className="cv-kv">
        {v.rows.map(([k, val]) => (
          <div className="cv-kv__row" key={k}><dt>{k}</dt><dd>{val}</dd></div>
        ))}
      </dl>
      {version === 'mamba2' && (
        <p className="cv-check">
          <span className="cv-check__ok">✓</span> at dim=128: expand·dim = {dInner}, and {dInner} ÷ 64 = {dInner / 64} heads — constraint satisfied.
        </p>
      )}
    </div>
  );
}

/* ── Chapter 5 · the forward loop ───────────────────────────────────────── */
function ForwardViz({ nDir, dir, setDir }) {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="cv-forward">
      <ol className={`cv-steps2${reduced ? ' cv-steps2--still' : ''}`}>
        <li><b>1</b> normalise once<code>xn = norm(x)</code></li>
        <li><b>2</b> for each of the {nDir} directions<code>flatten → mamba → unflatten</code></li>
        <li><b>3</b> sum the direction volumes<code>out += vol</code></li>
        <li><b>4</b> add the residual<code>return x + out</code></li>
      </ol>
      <div className="cv-fanchips">
        {DIRS.map((d, i) => (
          <button key={d.label}
            className={`cv-fanchip${i === dir ? ' cv-fanchip--on' : ''}${i >= nDir ? ' cv-fanchip--off' : ''}`}
            onClick={() => setDir(i)}>
            {d.label}
          </button>
        ))}
        <span className="cv-fanchips__sum">→ Σ → + x</span>
      </div>
      <p className="cv-note">
        The loop reuses the exact <code>_flatten</code>/<code>_unflatten</code> pair from chapter 3, once per
        active direction, so each scan sees the volume threaded along a different axis. Summing then adding the
        residual keeps the block shape-preserving.
      </p>
    </div>
  );
}

/* ── Chapter 6 · config-driven construction ─────────────────────────────── */
function ConfigViz() {
  return (
    <div className="cv-config">
      <div className="cv-config__yaml">
        <span className="cv-config__cap">configs/experiments/*.yaml</span>
        <pre>{`model:
  mamba:
    version: mamba2
    n_directions: 6
    d_state: 128
    expand: 2`}</pre>
      </div>
      <div className="cv-config__arrow"><Icon name="arrowDown" size={18} /></div>
      <div className="cv-config__call">
        <span className="cv-config__cap">encoder builds each stage</span>
        <code>MambaBlock3D.from_config(dim=128, cfg)</code>
      </div>
      <p className="cv-note">
        Nothing about the block is hard-coded: the variant, direction count and state size all come from the
        experiment config. The encoder (step 3) just passes the per-stage channel count as <code>dim</code>.
      </p>
    </div>
  );
}

/* ── Chapter 7 · the verification test (real captured output) ───────────── */
const TEST_OUT = [
  { t: 'Device: NVIDIA GeForce RTX 5070 Ti  |  torch 2.11.0+cu128', c: 'dim' },
  { t: '', c: 'dim' },
  { t: '[1] Flatten/un-flatten reversibility (all 6 directions)', c: '' },
  { t: '  [ OK ]  all 6 directions round-trip exactly', c: 'ok' },
  { t: '', c: 'dim' },
  { t: '[2] Forward + backward on CUDA (shape preserved, gradients flow)', c: '' },
  { t: '  [ OK ]  mamba1 · bidirectional (2 dir)   in=(1,64,16,32,16)  params=0.07M', c: 'ok' },
  { t: '  [ OK ]  mamba1 · 6-direction             in=(1,64,16,32,16)  fwd+bwd=11.0ms', c: 'ok' },
  { t: '  [ OK ]  mamba2 · 6-direction (SSD)        in=(2,128,8,16,8)   peakVRAM=368MB', c: 'ok' },
  { t: '', c: 'dim' },
  { t: 'ALL CHECKS PASSED - MambaBlock3D ready for step 3 (encoder assembly).', c: 'pass' },
];

function TestViz() {
  return (
    <div className="cv-test">
      <div className="cv-term" role="img" aria-label="Captured test output">
        <div className="cv-term__bar">
          <span className="cv-term__dot" /><span className="cv-term__dot" /><span className="cv-term__dot" />
          <span className="cv-term__title">python models/mamba_block_3d.py</span>
        </div>
        <pre className="cv-term__body">
          {TEST_OUT.map((l, i) => (
            <div key={i} className={`cv-term__ln${l.c ? ` cv-term__ln--${l.c}` : ''}`}>{l.t || ' '}</div>
          ))}
        </pre>
      </div>
      <div className="cv-resgrid">
        <div className="cv-res"><b>= input</b><span>output shape (all cases)</span></div>
        <div className="cv-res"><b>6/6</b><span>directions reversible</span></div>
        <div className="cv-res"><b>✓</b><span>gradients flow (fwd+bwd)</span></div>
        <div className="cv-res cv-res--accent"><b>≤ 368 MB</b><span>peak VRAM · 16 GB card</span></div>
      </div>
      <p className="cv-note">
        Mamba-2's first pass takes ~50 s while Triton compiles its kernel — that's one-time compilation, not
        per-call cost (warmed-up steady state is ~20 ms). Everything else runs in milliseconds.
      </p>
    </div>
  );
}

// ── Explorer tree row ────────────────────────────────────────────────────────
function TreeNode({ node, depth, activeId, onPick }) {
  const [open, setOpen] = useState(node.open ?? true);
  if (node.type === 'folder') {
    return (
      <div className="cv-tree__folder">
        <button className="cv-tree__row cv-tree__row--folder" style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className={`cv-tree__caret${open ? ' cv-tree__caret--open' : ''}`}><Icon name="chevron" size={12} /></span>
          <span className="cv-tree__folder-ico" aria-hidden="true" />
          <span className="cv-tree__name">{node.name}</span>
        </button>
        {open && node.children.map((c, i) => (
          <TreeNode key={i} node={c} depth={depth + 1} activeId={activeId} onPick={onPick} />
        ))}
      </div>
    );
  }
  const isActive = node.ready && node.id === activeId;
  return (
    <button
      className={`cv-tree__row cv-tree__row--file${isActive ? ' cv-tree__row--active' : ''}${!node.ready ? ' cv-tree__row--stub' : ''}`}
      style={{ paddingLeft: 8 + depth * 12 }}
      onClick={() => node.ready && onPick(node.id)}
      disabled={!node.ready}
      title={node.ready ? node.name : `${node.name} — not visualised yet (stub)`}>
      <span className="cv-tree__file-ico" aria-hidden="true">py</span>
      <span className="cv-tree__name">{node.name}</span>
      {node.ready
        ? <span className="cv-tree__loc">{node.loc}</span>
        : <span className="cv-tree__soon">soon</span>}
    </button>
  );
}

// ── Chapter shell (code left · prose + diagram right) ─────────────────────────
function Chapter({ n, title, tag, from, to, tall, children, viz }) {
  return (
    <section className="cv-chapter">
      <header className="cv-chapter__head">
        <span className="cv-chapter__n">{n}</span>
        <h3 className="cv-chapter__title">{title}</h3>
        {tag && <span className="cv-chapter__tag">{tag}</span>}
        <span className="cv-chapter__lines">lines {from}–{to}</span>
      </header>
      <div className="cv-chapter__grid">
        <div className="cv-chapter__codecol">
          <CodeBlock fromLine={from} lines={MAMBA_LINES.slice(from - 1, to)} label={`${title} — source`} tall={tall} />
        </div>
        <div className="cv-chapter__vizcol">
          <div className="cv-prose">{children}</div>
          {viz}
        </div>
      </div>
    </section>
  );
}

export default function CodeVisualiser() {
  const [activeId, setActiveId] = useState('mamba_block_3d');
  const [view, setView] = useState('walk');       // 'walk' | 'full'
  const [dir, setDir] = useState(4);              // shared scan direction (default +z)
  const [nDir, setNDir] = useState(6);            // shared n_directions
  const [version, setVersion] = useState('mamba1');

  return (
    <div className="pt-module cv">
      <div>
        <p className="cv-kicker">University · Mamba_PSMA</p>
        <p className="pt-module__intro">
          An interactive walkthrough of the real source files. Pick a file in the Explorer; the editor shows the
          exact code beside diagrams and animations that show what each part actually does — built to be read
          side-by-side with the file open in your editor. First up: the 3D Mamba block from step 2.
        </p>
      </div>

      <div className="cv-ide">
        {/* ── Explorer ─────────────────────────────────────────────────── */}
        <aside className="cv-explorer">
          <div className="cv-explorer__head">Explorer</div>
          <div className="cv-explorer__root">
            <span className="cv-tree__caret cv-tree__caret--open"><Icon name="chevron" size={12} /></span>
            MAMBA_PSMA
          </div>
          <div className="cv-tree">
            {TREE.map((n, i) => (
              <TreeNode key={i} node={n} depth={0} activeId={activeId} onPick={setActiveId} />
            ))}
          </div>
          <p className="cv-explorer__foot">More files get visualised as the model is built.</p>
        </aside>

        {/* ── Editor ───────────────────────────────────────────────────── */}
        <main className="cv-editor">
          <div className="cv-tabs">
            <div className="cv-tab cv-tab--active">
              <span className="cv-tab__ico" aria-hidden="true">py</span>
              mamba_block_3d.py
              <span className="cv-tab__dot" aria-hidden="true" />
            </div>
            <div className="cv-tabs__spacer" />
            <div className="cv-viewtoggle" role="group" aria-label="View mode">
              <button className={`cv-viewtoggle__opt${view === 'walk' ? ' cv-viewtoggle__opt--on' : ''}`}
                onClick={() => setView('walk')}>Walkthrough</button>
              <button className={`cv-viewtoggle__opt${view === 'full' ? ' cv-viewtoggle__opt--on' : ''}`}
                onClick={() => setView('full')}>Full file</button>
            </div>
          </div>

          <div className="cv-breadcrumb">
            models <Icon name="chevron" size={11} /> mamba_block_3d.py
            <span className="cv-breadcrumb__meta">{MAMBA_LINES.length} lines · Python · step 2 · GPU-verified</span>
          </div>

          {view === 'full' ? (
            <div className="cv-editor__body">
              <CodeBlock fromLine={1} lines={MAMBA_LINES} label="mamba_block_3d.py — full file" tall />
            </div>
          ) : (
            <div className="cv-editor__body cv-chapters">
              <Chapter n="1" title="What the block is" tag="the contract" from={1} to={21}
                viz={<DataflowViz nDir={nDir} />}>
                <p>
                  <code>MambaBlock3D</code> takes a 3D CNN feature map <code>(B, C, D, H, W)</code> and returns the
                  <strong> same shape</strong>. It's the reusable atom the whole hybrid CNN–Mamba U-Net is built from.
                </p>
                <p>
                  The shape of the whole thing is a standard pre-norm residual block: normalise, run one or more
                  selective scans, sum them, then add the input back. The diagram is the exact dataflow —
                  drag <code>n_directions</code> in chapter 2 and this fan of scans grows or shrinks.
                </p>
              </Chapter>

              <Chapter n="2" title="Six scan directions" tag="±x ±y ±z" from={28} to={39}
                viz={<DirectionsViz dir={dir} setDir={setDir} nDir={nDir} setNDir={setNDir} />}>
                <p>
                  A single flatten order biases the model — voxels next to each other in 3D can end up far apart on
                  the 1D line. So the block scans along <strong>each axis, forwards and back</strong>: six directions.
                </p>
                <p>
                  Each entry is a <code>(perm, flip)</code>: <code>perm</code> reorders <code>(D,H,W)</code> so a
                  chosen axis varies fastest (the scan then runs primarily along it), and <code>flip</code> reverses
                  it. Click an axis arrow or a row to select a direction — chapter 3 animates whichever you pick.
                </p>
              </Chapter>

              <Chapter n="3" title="Flatten a volume into a sequence" tag="the crux" from={93} to={113} tall
                viz={<FlattenViz dir={dir} setDir={setDir} />}>
                <p>
                  This is the heart of the block. Mamba works on a 1D sequence <code>(B, L, C)</code>, so the volume
                  has to be unrolled into a line — and then rolled back <em>exactly</em>, or features land in the
                  wrong voxels.
                </p>
                <p>
                  Below, each voxel is numbered by its position in the flattened sequence for the selected
                  direction. <strong>Hover</strong> to link a voxel to its spot on the 1D strip, or hit
                  <strong> Play</strong> to watch the scan thread through the volume. Switch directions and watch the
                  numbering re-order — that's <code>permute</code> and <code>flip</code> at work.
                </p>
              </Chapter>

              <Chapter n="4" title="Building the block" tag="Mamba-1 ↔ Mamba-2" from={53} to={88} tall
                viz={<BuildViz version={version} setVersion={setVersion} />}>
                <p>
                  The constructor validates the arguments, then builds one Mamba core <strong>per direction</strong>
                  in a <code>ModuleList</code> (separate weights, SegMamba-style). A LayerNorm sits in front.
                </p>
                <p>
                  Flip the toggle to see the only real difference between the two variants — a single
                  <code>version</code> flag picks <code>Mamba</code> or <code>Mamba2</code> in <code>_make_core</code>.
                  Mamba-2 adds a divisibility constraint the constructor checks up front.
                </p>
              </Chapter>

              <Chapter n="5" title="The forward pass" tag="put together" from={115} to={133}
                viz={<ForwardViz nDir={nDir} dir={dir} setDir={setDir} />}>
                <p>
                  Forward normalises the volume <strong>once</strong>, then loops the active directions: flatten →
                  Mamba scan → un-flatten, accumulating the result. Finally it adds the residual.
                </p>
                <p>
                  Because every <code>_unflatten</code> exactly inverts its <code>_flatten</code>, all the direction
                  volumes line up voxel-for-voxel before they're summed — so the output keeps the input's shape.
                </p>
              </Chapter>

              <Chapter n="6" title="Config-driven construction" tag="no hard-coding" from={135} to={147}
                viz={<ConfigViz />}>
                <p>
                  <code>from_config</code> builds a block straight from a config dict, so experiments select the
                  variant and direction count in YAML rather than in code — keeping the Mamba runs comparable to the
                  nnU-Net baseline.
                </p>
              </Chapter>

              <Chapter n="7" title="Proving it works" tag="GPU test" from={154} to={212} tall
                viz={<TestViz />}>
                <p>
                  The file is runnable: its <code>__main__</code> checks reversibility for all six directions, then
                  does a real forward + backward pass on the GPU for both Mamba variants, asserting the output shape
                  matches the input and gradients flow.
                </p>
                <p>This is the actual captured output from the RTX 5070 Ti.</p>
              </Chapter>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
