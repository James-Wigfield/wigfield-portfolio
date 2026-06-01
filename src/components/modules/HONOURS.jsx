import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Colour helpers ────────────────────────────────────────────────────────────
const C = {
  rose:    'var(--rose)',
  cyan:    'var(--cyan)',
  violet:  'var(--violet)',
  emerald: 'var(--emerald)',
  amber:   'var(--amber)',
};

// ─── Code Block ───────────────────────────────────────────────────────────────
function Code({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="ho-code-wrap">
      <div className="ho-code-bar">
        <span className="ho-code-dot" style={{ background: '#ff5f57' }} />
        <span className="ho-code-dot" style={{ background: '#febc2e' }} />
        <span className="ho-code-dot" style={{ background: '#28c840' }} />
        <button className="ho-code-copy" onClick={copy}>{copied ? '✓ COPIED' : 'COPY'}</button>
      </div>
      <pre className="ho-code"><code>{code}</code></pre>
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SH({ children, color = C.rose }) {
  return (
    <div className="ho-sh-wrap">
      <span className="ho-sh-accent" style={{ background: color }} />
      <h2 className="ho-sh" style={{ color }}>{children}</h2>
    </div>
  );
}

// ─── Info box ─────────────────────────────────────────────────────────────────
function InfoBox({ color = C.cyan, children }) {
  return <div className="ho-infobox" style={{ borderLeftColor: color }}>{children}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB: OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
function TabOverview() {
  return (
    <div>
      {/* Hero */}
      <div className="ho-hero">
        <p className="ho-hero-label">// CITS4010 · BACHELOR OF ADVANCED CS (HONOURS) · UWA 2025</p>
        <h1 className="ho-hero-title">
          Optimising PSMA PET Segmentation<br />
          <span style={{ color: C.rose }}>using the Mamba Architecture</span>
        </h1>
        <p className="ho-hero-sub">
          A 3D State Space Model approach to whole-body <sup>[68</sup>Ga<sup>]</sup>Ga-PSMA-11 PET
          scan segmentation for automated detection of metastatic prostate cancer lesions.
          Supervised by <strong>Dr. Jake Kendrick</strong> &amp; <strong>Dr. Mubashar Hassan</strong>,
          UWA Medical Physics Research Group.
        </p>
        <div className="ho-tags">
          {['HONOURS 2025','MEDICAL IMAGING','STATE SPACE MODELS','3D SEGMENTATION','PSMA PET'].map(t => (
            <span key={t} className="ho-tag">{t}</span>
          ))}
        </div>
      </div>

      {/* Baseline metrics */}
      <SH color={C.amber}>Baseline Performance — nnU-Net</SH>
      <div className="ho-stat-grid">
        {[
          { val: '79.9%', lbl: 'Lesion F1 Score',        sub: 'Primary target metric',    color: C.amber  },
          { val: '88.2%', lbl: 'PPV (Precision)',         sub: 'High — to maintain',      color: C.cyan   },
          { val: '73.0%', lbl: 'Sensitivity (Recall)',    sub: 'Too low — target to raise',color: C.rose   },
          { val: '94.5%', lbl: 'Patient-Level Accuracy',  sub: '121 / 128 patients',      color: C.emerald},
        ].map(s => (
          <div key={s.lbl} className="ho-stat-card" style={{ borderColor: s.color }}>
            <p className="ho-stat-val" style={{ color: s.color }}>{s.val}</p>
            <p className="ho-stat-lbl">{s.lbl}</p>
            <p className="ho-stat-sub">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Research aims */}
      <SH color={C.cyan}>Research Aims</SH>
      <div className="ho-aims">
        {[
          {
            n: '01', title: 'Design a 3D Mamba Architecture',
            desc: 'Address the extreme volumetric disparity between tiny metastatic lesions and vast healthy background. Mamba\'s input-dependent selective memory can suppress background while preserving tiny lesion features across long sequences.',
          },
          {
            n: '02', title: 'Benchmark Against nnU-Net',
            desc: 'Rigorously evaluate using the SCGH dataset (~300 whole-body patients) and the open-source autoPET dataset. Reproducible comparison under identical preprocessing and evaluation protocols.',
          },
          {
            n: '03', title: 'Dual-Metric Evaluation',
            desc: 'Prioritise lesion-level F1 score (balancing sensitivity and PPV) alongside voxel-level Dice Similarity Coefficient (DSC). F1 ensures no single metric hides a sensitivity–precision trade-off.',
          },
        ].map(a => (
          <div key={a.n} className="ho-aim">
            <span className="ho-aim-num" style={{ color: C.rose }}>{a.n}</span>
            <div>
              <p className="ho-aim-title">{a.title}</p>
              <p className="ho-aim-desc">{a.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Why Mamba */}
      <SH color={C.emerald}>Why Mamba for Whole-Body PET?</SH>
      <div className="ho-inn-grid">
        {[
          {
            icon: 'O(L)', title: 'Linear Complexity',
            desc: 'Transformers scale O(L²) — infeasible for whole-body volumes where L ≈ millions of voxels. Mamba\'s SSM scan scales O(L), enabling far larger volumetric patches within the same VRAM budget.',
            color: C.cyan,
          },
          {
            icon: '⊛', title: 'Selective Memory',
            desc: 'Input-dependent parameters Δ, B, C allow the model to selectively ignore vast background tissue and "remember" small lesion features across the full scan without a fixed-size attention window.',
            color: C.rose,
          },
          {
            icon: '▣', title: 'SRAM-Efficient Scan',
            desc: 'Mamba\'s hardware-aware parallel scan computes the SSM recurrence directly in SRAM, avoiding VRAM materialisation of the full sequence. Critical for whole-body 3D scans that exceed GPU memory.',
            color: C.amber,
          },
          {
            icon: '⊕', title: 'Hybrid CNN-Mamba',
            desc: 'CNN layers handle local feature extraction (tumour texture, shape). Mamba blocks capture long-range spatial context (primary tumour ↔ distant metastasis relationships) with linear cost.',
            color: C.emerald,
          },
        ].map(i => (
          <div key={i.title} className="ho-inn" style={{ borderColor: i.color }}>
            <span className="ho-inn-icon" style={{ color: i.color }}>{i.icon}</span>
            <p className="ho-inn-title" style={{ color: i.color }}>{i.title}</p>
            <p className="ho-inn-desc">{i.desc}</p>
          </div>
        ))}
      </div>

      {/* Problem statement */}
      <SH color={C.violet}>Problem Statement &amp; Hypothesis</SH>
      <InfoBox color={C.violet}>
        By leveraging the <strong>linear complexity</strong> and <strong>selective memory</strong> of
        State Space Models (SSMs), a 3D Mamba architecture can process whole-body PSMA PET scans with
        greater computational efficiency than existing baseline models while improving lesion-level F1
        score — particularly the 73% sensitivity bottleneck — by selectively amplifying weak lesion
        signals over high-intensity background regions.
      </InfoBox>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Mamba Block Interactive Diagram
// ─────────────────────────────────────────────────────────────────────────────
const ARCH_BLOCKS = [
  {
    id: 'norm', label: 'RMSNorm', dims: 'LayerNorm(D)',
    color: C.cyan,
    desc: 'Root Mean Square Layer Normalisation applied before each block (pre-norm). Normalises the residual stream for stable training.',
    code: `self.norm = RMSNorm(d_model, eps=1e-5)
# Applied as: hidden_states = self.norm(residual)`,
  },
  {
    id: 'in_proj', label: 'in_proj', dims: 'Linear(D → 2·E)',
    color: C.rose,
    desc: 'Expands to 2× inner dimension in a single fused matmul. Output is split into x (data path) and z (gating path). E = expand × D, typically E = 2D.',
    code: `self.in_proj = nn.Linear(self.d_model, self.d_inner * 2, bias=False)
# d_inner = expand * d_model = 2 * 512 = 1024
xz = self.in_proj(hidden_states)  # (B, L, 2E)
x, z = xz.chunk(2, dim=-1)        # x: data, z: gate`,
  },
  {
    id: 'conv', label: 'causal conv1d', dims: 'Conv1d(E, k=d_conv, depthwise)',
    color: C.amber,
    desc: 'Short causal depthwise 1D convolution over the sequence. Provides local context aggregation before the SSM. Causal padding (k−1 zeros) ensures no future information leaks.',
    code: `self.conv1d = nn.Conv1d(
    in_channels=self.d_inner,
    out_channels=self.d_inner,
    bias=conv_bias,
    kernel_size=d_conv,          # default: 4
    groups=self.d_inner,         # depthwise (per-channel)
    padding=d_conv - 1,          # causal: left-only padding
)
x = self.act(self.conv1d(x)[..., :seqlen])  # SiLU activation`,
  },
  {
    id: 'proj', label: 'x_proj + dt_proj', dims: 'Linear(E → Δ,B,C)',
    color: C.violet,
    desc: 'Projects features to SSM parameters Δ (timescale), B (input projection), C (output projection). These are INPUT-DEPENDENT — the "selective" mechanism that distinguishes Mamba from fixed SSMs.',
    code: `# Projects to [dt_rank | d_state | d_state] = [Δ, B, C]
self.x_proj = nn.Linear(self.d_inner, self.dt_rank + self.d_state * 2)
self.dt_proj = nn.Linear(self.dt_rank, self.d_inner, bias=True)

x_dbl = self.x_proj(x)                                  # (B*L, dt_rank+2N)
dt, B, C = torch.split(x_dbl, [dt_rank, d_state, d_state])
dt = self.dt_proj.weight @ dt.t()                        # (E, B*L)`,
  },
  {
    id: 'ssm', label: 'Selective Scan', dims: 'h_t = Ā·h_{t-1} + B̄·x_t',
    color: C.emerald,
    desc: 'The core SSM recurrence. A is a fixed learned diagonal matrix (input-independent). Ā = exp(Δ·A) is the discretised transition. Large Δ → small Ā → state resets (forget). Small Δ → Ā ≈ 1 → state persists (remember). Computed in SRAM via a parallel scan algorithm.',
    code: `# A: fixed diagonal (S4D-Real init), shape (E, N)
A = -torch.exp(self.A_log.float())  # always negative for stability

# ZOH Discretisation (input-dependent via Δ):
# Ā = exp(Δ·A),   B̄ ≈ Δ·B

# Parallel selective scan (CUDA kernel):
y = selective_scan_fn(
    x,       # (B, E, L)  — convolved features
    dt,      # (B, E, L)  — INPUT-DEPENDENT timescale
    A,       # (E, N)     — fixed state transition
    B,       # (B, N, L)  — INPUT-DEPENDENT write matrix
    C,       # (B, N, L)  — INPUT-DEPENDENT read matrix
    self.D.float(),         # (E,) — skip connection
    z=z,                    # (B, E, L) — gate (SiLU applied internally)
    delta_bias=self.dt_proj.bias.float(),
    delta_softplus=True,
)
# y: (B, L, E)  — gated SSM output`,
  },
  {
    id: 'out_proj', label: 'out_proj', dims: 'Linear(E → D)',
    color: C.rose,
    desc: 'Projects gated SSM output back to model dimension D. The gate z has already been applied (via SiLU) inside the selective scan kernel when using the fast path.',
    code: `self.out_proj = nn.Linear(self.d_inner, self.d_model, bias=False)
out = self.out_proj(y)   # (B, L, D)`,
  },
];

function MambaBlockDiagram() {
  const [active, setActive] = useState('ssm');
  const block = ARCH_BLOCKS.find(b => b.id === active);

  return (
    <div className="ho-arch">
      {/* Flow column */}
      <div className="ho-arch-flow">
        <div className="ho-arch-io">
          <span style={{ color: 'var(--text-2)' }}>Input</span>
          <span className="ho-arch-dims">(B, L, D)</span>
        </div>
        <div className="ho-arch-connector" />

        {ARCH_BLOCKS.map((b, i) => (
          <div key={b.id}>
            <button
              className={`ho-arch-box${active === b.id ? ' ho-arch-box--active' : ''}`}
              style={{ '--box-color': b.color }}
              onClick={() => setActive(b.id)}
            >
              <span className="ho-arch-box-label">{b.label}</span>
              <span className="ho-arch-box-dims">{b.dims}</span>
            </button>
            {i < ARCH_BLOCKS.length - 1 && <div className="ho-arch-connector" />}
          </div>
        ))}

        <div className="ho-arch-connector" />
        <div className="ho-arch-io">
          <span style={{ color: 'var(--text-2)' }}>+ Residual → Output</span>
          <span className="ho-arch-dims">(B, L, D)</span>
        </div>
      </div>

      {/* Detail panel */}
      <div className="ho-arch-detail">
        <p className="ho-arch-detail-name" style={{ color: block.color }}>{block.label}</p>
        <p className="ho-arch-detail-dims">{block.dims}</p>
        <p className="ho-arch-detail-desc">{block.desc}</p>
        <Code code={block.code} />
        <p className="ho-arch-hint">// click any block to inspect</p>
      </div>
    </div>
  );
}

// ─── SSM Selectivity Visualiser ───────────────────────────────────────────────
function SSMVisualizer() {
  const [selectivity, setSelectivity] = useState(0.55);
  const SEQ = 48;

  const signal = useMemo(() => Array.from({ length: SEQ }, (_, i) => {
    if ((i >= 9 && i <= 12) || (i >= 30 && i <= 34)) return 0.82 + Math.random() * 0.14;
    return Math.random() * 0.11;
  }), []);

  const { hs, ys } = useMemo(() => {
    let h = 0;
    const hs = [], ys = [];
    for (let i = 0; i < SEQ; i++) {
      const x = signal[i];
      const delta = 0.08 + selectivity * x * 3.5;
      const A_bar = Math.exp(-delta);
      h = A_bar * h + (1 - A_bar) * x;
      hs.push(h);
      ys.push(h * 0.75 + x * 0.25);
    }
    return { hs, ys };
  }, [signal, selectivity]);

  const Bar = ({ vals, colorFn, label }) => (
    <div className="ho-viz-row">
      <span className="ho-viz-label">{label}</span>
      <div className="ho-viz-cells">
        {vals.map((v, i) => (
          <div
            key={i}
            className="ho-viz-cell"
            style={{ background: colorFn(v, i), opacity: 0.12 + v * 0.88 }}
            title={`t=${i}: ${v.toFixed(3)}`}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="ho-viz">
      <div className="ho-viz-ctrl">
        <span className="ho-viz-ctrl-lbl">Selectivity (Δ bias)</span>
        <input
          type="range" min="0" max="1" step="0.01"
          value={selectivity}
          onChange={e => setSelectivity(+e.target.value)}
          style={{ flex: 1, accentColor: 'var(--rose)' }}
        />
        <span className="ho-viz-ctrl-val">{selectivity.toFixed(2)}</span>
      </div>

      <Bar vals={signal} colorFn={v => v > 0.5 ? C.rose : C.cyan} label="x(t) input" />
      <Bar vals={hs}     colorFn={() => C.violet}                   label="h(t) state" />
      <Bar vals={ys}     colorFn={v => v > 0.4 ? C.emerald : 'rgba(52,211,153,0.5)'} label="y(t) output" />

      <p className="ho-viz-note">
        <span style={{ color: C.rose }}>■ Lesion spikes</span> vs <span style={{ color: C.cyan }}>■ background</span>.
        {' '}High selectivity: state resets quickly (forgets background). Low selectivity: state accumulates across sequence. Watch how output preserves lesions while suppressing noise.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB: ARCHITECTURE
// ─────────────────────────────────────────────────────────────────────────────
function TabArchitecture() {
  const [view, setView] = useState('mamba1');
  return (
    <div>
      <div className="ho-view-btns">
        {['mamba1','mamba2','equations'].map(v => (
          <button key={v} className={`ho-view-btn${view===v?' ho-view-btn--on':''}`} onClick={() => setView(v)}>
            {v.toUpperCase().replace('1',' 1').replace('2',' 2')}
          </button>
        ))}
      </div>

      {view === 'mamba1' && (
        <>
          <SH color={C.rose}>Mamba-1 Block</SH>
          <InfoBox color={C.rose}>
            The original Mamba block from <em>Gu &amp; Dao 2023</em>. All SSM parameters (Δ, B, C) are projected
            from the input — "selective". A remains input-independent (diagonal S4D init). Key hyperparameters:
            d_model=512, d_state=16 (N), d_conv=4, expand=2, dt_rank=32.
          </InfoBox>
          <MambaBlockDiagram />
        </>
      )}

      {view === 'mamba2' && (
        <>
          <SH color={C.violet}>Mamba-2 (SSD) Block</SH>
          <InfoBox color={C.violet}>
            Structured State Space Dual (SSD) model. Reformulates SSM as a matrix multiplication for better
            parallelism. Key differences: A is scalar per head (not a full N×N matrix), ngroups for shared B/C,
            multi-head formulation (nheads = d_ssm / headdim). More hardware-efficient, larger d_state (128 vs 16).
          </InfoBox>
          <div className="ho-card">
            <div className="ho-two-col">
              <div>
                <p className="ho-card-h" style={{ color: C.cyan }}>// Mamba-1 hyperparams</p>
                <Code code={`Mamba(
    d_model  = 512,   # D: model dimension
    d_state  = 16,    # N: SSM state size
    d_conv   = 4,     # k: conv kernel size
    expand   = 2,     # E = 2D = 1024
    dt_rank  = 32,    # ceil(D/16)
)
# Params ≈ 3.2M per block`} />
              </div>
              <div>
                <p className="ho-card-h" style={{ color: C.violet }}>// Mamba-2 hyperparams</p>
                <Code code={`Mamba2(
    d_model  = 512,   # D: model dimension
    d_state  = 128,   # N: much larger state
    d_conv   = 4,     # k: conv kernel size
    expand   = 2,     # E = 2D = 1024
    headdim  = 64,    # per-head dimension
    ngroups  = 1,     # shared B/C groups
    chunk_size = 256, # parallel scan chunks
)
# Params ≈ 2.8M per block (more efficient)`} />
              </div>
            </div>
            <table className="ho-table">
              <thead><tr><th>Property</th><th>Mamba-1</th><th>Mamba-2</th></tr></thead>
              <tbody>
                {[
                  ['A matrix', 'Diagonal (E×N)', 'Scalar per head (nheads)'],
                  ['B, C', 'Shared (N)', 'Group-shared (ngroups×N)'],
                  ['Δ (timescale)', 'Per-channel (E)', 'Per-head (nheads)'],
                  ['Scan algorithm', 'Sequential selective scan', 'Chunked SSD (parallel)'],
                  ['d_state typical', '16', '128'],
                  ['CUDA kernel', 'selective_scan_fn', 'mamba_chunk_scan_combined'],
                ].map(([p, m1, m2]) => (
                  <tr key={p}>
                    <td className="ho-td-key">{p}</td>
                    <td>{m1}</td>
                    <td style={{ color: C.violet }}>{m2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === 'equations' && (
        <>
          <SH color={C.amber}>SSM Equations</SH>
          <div className="ho-card">
            <p className="ho-card-h" style={{ color: C.amber }}>// Continuous-Time SSM</p>
            <div className="ho-eq-block">
              <div className="ho-eq-row"><span className="ho-eq-label">State:</span><span className="ho-eq">h'(t) = A·h(t) + B·x(t)</span></div>
              <div className="ho-eq-row"><span className="ho-eq-label">Output:</span><span className="ho-eq">y(t) = C·h(t) + D·x(t)</span></div>
            </div>
            <p className="ho-card-h" style={{ color: C.cyan }}>// Discretisation (Zero-Order Hold)</p>
            <div className="ho-eq-block">
              <div className="ho-eq-row"><span className="ho-eq-label">Ā:</span><span className="ho-eq">exp(Δ · A)</span></div>
              <div className="ho-eq-row"><span className="ho-eq-label">B̄:</span><span className="ho-eq">(ΔA)⁻¹ · (exp(ΔA) − I) · ΔB ≈ Δ · B</span></div>
            </div>
            <p className="ho-card-h" style={{ color: C.rose }}>// Discrete Recurrence (what Mamba computes)</p>
            <div className="ho-eq-block">
              <div className="ho-eq-row"><span className="ho-eq-label">State:</span><span className="ho-eq" style={{ color: C.rose }}>h_t = Ā · h_{'{'}t-1{'}'} + B̄ · x_t</span></div>
              <div className="ho-eq-row"><span className="ho-eq-label">Output:</span><span className="ho-eq" style={{ color: C.rose }}>y_t = C · h_t + D · x_t</span></div>
            </div>
            <p className="ho-card-h" style={{ color: C.emerald }}>// The Selective Mechanism</p>
            <InfoBox color={C.emerald}>
              In standard SSMs, A, B, C are fixed matrices — the model cannot adapt to input.
              Mamba makes <strong>Δ(x), B(x), C(x) all input-dependent</strong> via linear projections.
              Large Δ → Ā ≈ 0 → state reset (ignore input). Small Δ → Ā ≈ I → state preserved (remember).
              A and D remain input-independent learned parameters.
            </InfoBox>
          </div>

          <SH color={C.emerald}>Selectivity Visualiser</SH>
          <div className="ho-card">
            <p className="ho-card-h" style={{ color: C.emerald }}>
              // Synthetic PSMA signal — 2 lesion spikes in background noise
            </p>
            <SSMVisualizer />
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB: 3D ADAPTATION
// ─────────────────────────────────────────────────────────────────────────────
function TabAdaptation() {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: '1. Voxel Patch Embedding',
      color: C.cyan,
      desc: 'A 3D CNN extracts local features from overlapping patches of the PET volume, producing a spatial feature map at each encoder stage. This replaces the token embedding used in NLP.',
      code: `# Input: (B, 2, D, H, W)  — 2 channels: PET + CT
# Patch conv: stride=2, reduces spatial dims by 2×
patch_embed = nn.Conv3d(2, d_model, kernel_size=3, stride=2, padding=1)
# Output: (B, d_model, D/2, H/2, W/2)`,
    },
    {
      title: '2. Flatten to Sequence',
      color: C.rose,
      desc: 'Before each Mamba block, the 3D feature map is flattened to a 1D sequence. The sequence length L = (D/s) × (H/s) × (W/s) where s is the cumulative stride. Multiple scan directions are then applied.',
      code: `B, C, d, h, w = features.shape
L = d * h * w
seq = features.flatten(2).transpose(1, 2)  # (B, L, C)

# 6-directional scan (forward + reverse per axis):
directions = [
    seq,                          # z: front→back
    seq.flip(1),                  # z: back→front
    seq.reshape(B,d,h*w,C).transpose(1,2).flatten(2,3),  # y
    # ... etc.
]
out = sum(mamba(d) for d in directions) / len(directions)`,
    },
    {
      title: '3. Mamba Blocks at Encoder',
      color: C.violet,
      desc: 'At each encoder scale, the flattened sequence is processed by N Mamba blocks to capture long-range dependencies. The output is reshaped back to 3D spatial format for the next conv stage.',
      code: `class MambaEncoderStage(nn.Module):
    def __init__(self, dim, n_mamba=2, d_state=16):
        super().__init__()
        self.conv = ConvBlock3D(dim, dim*2, stride=2)
        self.mamba = nn.Sequential(*[
            Mamba(d_model=dim*2, d_state=d_state, d_conv=4)
            for _ in range(n_mamba)
        ])

    def forward(self, x):
        x = self.conv(x)         # (B, 2C, D/2, H/2, W/2)
        B, C, d, h, w = x.shape
        seq = x.flatten(2).transpose(1,2)
        seq = self.mamba(seq)    # long-range context
        return seq.transpose(1,2).reshape(B, C, d, h, w)`,
    },
    {
      title: '4. Skip Connections + Decoder',
      color: C.amber,
      desc: 'A U-Net style decoder uses transposed convolutions to upsample. Skip connections from each encoder stage preserve high-resolution spatial detail, critical for accurate lesion boundary delineation.',
      code: `class MambaDecoder(nn.Module):
    def forward(self, bottleneck, skips):
        x = bottleneck
        for i, skip in enumerate(reversed(skips)):
            x = self.upsample[i](x)  # transposed conv ×2
            x = torch.cat([x, skip], dim=1)  # skip connection
            x = self.decode_blocks[i](x)
        return self.seg_head(x)  # (B, n_classes, D, H, W)`,
    },
    {
      title: '5. Overlap-Tile Inference',
      color: C.emerald,
      desc: 'Full whole-body volumes exceed GPU memory. During inference, the volume is split into overlapping patches. Each patch is predicted separately and stitched with Gaussian weighting to smooth boundary artefacts. Mirror padding fills edge context.',
      code: `# Inspired by PSMASegmentator / nnUNet approach:
# tile_step_size = 0.5 → 50% overlap between tiles
predictor = nnUNetPredictor(
    tile_step_size=0.5,
    use_gaussian=True,     # Gaussian weight map for stitching
    use_mirroring=True,    # test-time augmentation (TTA)
)
# Mirror padding ensures boundary tiles see full context:
padded = F.pad(volume, [pad]*6, mode='reflect')`,
    },
  ];

  return (
    <div>
      <SH color={C.cyan}>U-Mamba Architecture for 3D PSMA PET</SH>
      <InfoBox color={C.cyan}>
        Adapting 1D Mamba (designed for language sequences) to 3D medical volumes requires four
        key engineering choices: volumetric patch embedding, sequence flattening strategy, multi-directional
        scanning, and overlap-tile inference. The architecture is inspired by U-Mamba (Ma et al. 2024).
      </InfoBox>

      {/* Architecture sketch */}
      <div className="ho-card">
        <p className="ho-card-h" style={{ color: C.cyan }}>// U-Mamba Encoder-Decoder</p>
        <div className="ho-arch-sketch">
          {[
            { l: 'Input (B,2,D,H,W)', c: C.cyan, dim: 'PET + CT' },
            { l: 'Enc Stage 1 — CNN Block', c: C.cyan, dim: '(B,32,D/2,H/2,W/2)', arrow: '↓ + skip₁' },
            { l: 'Enc Stage 2 — CNN + Mamba', c: C.violet, dim: '(B,64,D/4,H/4,W/4)', arrow: '↓ + skip₂' },
            { l: 'Enc Stage 3 — CNN + Mamba', c: C.violet, dim: '(B,128,D/8,H/8,W/8)', arrow: '↓ + skip₃' },
            { l: 'Bottleneck — Mamba ×4', c: C.rose, dim: '(B,256,D/16,H/16,W/16)' },
            { l: 'Dec Stage 3 — Upsample + skip₃', c: C.amber, dim: '(B,128,D/8,H/8,W/8)', arrow: '↑' },
            { l: 'Dec Stage 2 — Upsample + skip₂', c: C.amber, dim: '(B,64,D/4,H/4,W/4)', arrow: '↑' },
            { l: 'Dec Stage 1 — Upsample + skip₁', c: C.amber, dim: '(B,32,D/2,H/2,W/2)', arrow: '↑' },
            { l: 'Segmentation Head', c: C.emerald, dim: '(B,1,D,H,W)' },
          ].map((r, i) => (
            <div key={i} className="ho-sketch-row">
              {r.arrow && <span className="ho-sketch-arrow">{r.arrow}</span>}
              <div className="ho-sketch-box" style={{ borderColor: r.c }}>
                <span className="ho-sketch-lbl" style={{ color: r.c }}>{r.l}</span>
                <span className="ho-sketch-dim">{r.dim}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step explorer */}
      <SH color={C.rose}>Implementation Steps</SH>
      <div className="ho-step-nav">
        {steps.map((s, i) => (
          <button key={i} className={`ho-step-btn${step===i?' ho-step-btn--on':''}`}
            style={{ '--step-color': s.color }} onClick={() => setStep(i)}>
            {s.title.split('.')[0]}
          </button>
        ))}
      </div>
      <div className="ho-step-panel" style={{ borderColor: steps[step].color }}>
        <p className="ho-step-title" style={{ color: steps[step].color }}>{steps[step].title}</p>
        <p className="ho-step-desc">{steps[step].desc}</p>
        <Code code={steps[step].code} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB: DATA PIPELINE
// ─────────────────────────────────────────────────────────────────────────────
const PIPELINE_STEPS = [
  {
    n: '01', title: 'DICOM → NIfTI',
    color: C.cyan,
    desc: 'Raw clinical data arrives as DICOM series. Convert both PET and CT DICOM series to NIfTI format (.nii.gz) using SimpleITK. DICOM series sorting is handled automatically by the GDCM reader.',
    source: 'psma_segmentator/pre_processing.py',
    code: `import SimpleITK as sitk

def dicom_series_to_nifti(dicom_dir: Path, output_path: Path):
    """Convert a DICOM series directory to a single NIfTI volume."""
    reader = sitk.ImageSeriesReader()
    dicom_names = reader.GetGDCMSeriesFileNames(str(dicom_dir))
    reader.SetFileNames(dicom_names)
    image = reader.Execute()
    sitk.WriteImage(image, str(output_path))
    return image`,
  },
  {
    n: '02', title: 'CT–PET Alignment',
    color: C.rose,
    desc: 'CT and PET volumes are acquired separately and may have different voxel sizes or physical spacing. Resample CT to match the PET grid (size + spacing) using linear interpolation — PSMASegmentator uses this exact approach.',
    source: 'psma_segmentator/pre_processing.py :: resample_ct_to_pet()',
    code: `def resample_ct_to_pet(ct_path, pet_path, verbose=False):
    ct_img  = sitk.ReadImage(str(ct_path))
    pet_img = sitk.ReadImage(str(pet_path))

    # Check both size and spacing
    if ct_img.GetSize() != pet_img.GetSize() or \\
       ct_img.GetSpacing() != pet_img.GetSpacing():
        # Resample CT to PET reference space
        resampled_ct = sitk.Resample(ct_img, pet_img)
        sitk.WriteImage(resampled_ct, str(ct_path))
        if verbose:
            print(f"Resampled CT → PET space: {pet_img.GetSize()}")`,
  },
  {
    n: '03', title: 'Intensity Normalisation',
    color: C.violet,
    desc: 'PET SUV values are clipped to the 99th percentile and scaled to [0,1]. CT Hounsfield Units are windowed to soft-tissue range [−1024, 3000] and scaled to [0,1]. Normalization prevents extreme values from dominating gradient updates.',
    source: 'custom implementation',
    code: `import numpy as np

def normalize_pet(pet_img):
    arr = sitk.GetArrayFromImage(pet_img).astype(np.float32)
    p99 = np.percentile(arr[arr > 0], 99)  # ignore air voxels
    arr = np.clip(arr, 0, p99) / (p99 + 1e-8)
    return arr  # values in [0, 1]

def normalize_ct(ct_img):
    arr = sitk.GetArrayFromImage(ct_img).astype(np.float32)
    arr = np.clip(arr, -1024, 3000)
    arr = (arr + 1024) / (3000 + 1024)  # → [0, 1]
    return arr`,
  },
  {
    n: '04', title: 'Patch Sampling',
    color: C.amber,
    desc: 'Whole-body volumes (~150×192×192 voxels) are too large to train on directly. Randomly sample patches of size (96, 96, 96) with foreground-biased sampling: 2× more lesion-containing patches than background. Implemented via MONAI transforms.',
    source: 'custom implementation (MONAI-based)',
    code: `from monai.transforms import (
    RandCropByPosNegLabeld, RandFlipd,
    RandRotate90d, NormalizeIntensityd
)

train_transform = Compose([
    # Foreground-biased crop: 2× more lesion patches
    RandCropByPosNegLabeld(
        keys=['image', 'label'],
        label_key='label',
        spatial_size=(96, 96, 96),
        pos=2.0,   # positive (lesion) ratio
        neg=1.0,   # negative (background) ratio
        num_samples=4,
    ),
    RandFlipd(keys=['image','label'], prob=0.5, spatial_axis=0),
    RandFlipd(keys=['image','label'], prob=0.5, spatial_axis=1),
    RandFlipd(keys=['image','label'], prob=0.5, spatial_axis=2),
    RandRotate90d(keys=['image','label'], prob=0.5, max_k=3),
])`,
  },
  {
    n: '05', title: 'DataLoader Setup',
    color: C.emerald,
    desc: 'Training uses a MONAI CacheDataset to pre-load and cache preprocessed volumes in RAM, avoiding repeated disk I/O. A PersistentDataset is used for larger datasets. Distributed training is supported via PyTorch DDP.',
    source: 'custom implementation',
    code: `from monai.data import CacheDataset, DataLoader

# Build dataset dict list
data_dicts = [
    {'image': [ct_p, pet_p], 'label': seg_p}
    for ct_p, pet_p, seg_p in zip(ct_files, pet_files, seg_files)
]

# Cache 100% of data in RAM (fast iteration)
train_ds = CacheDataset(
    data=data_dicts[:n_train],
    transform=train_transform,
    cache_rate=1.0,
    num_workers=4,
)
train_loader = DataLoader(
    train_ds, batch_size=2,
    shuffle=True, num_workers=4, pin_memory=True,
)`,
  },
];

function TabPipeline() {
  const [active, setActive] = useState(0);
  const s = PIPELINE_STEPS[active];
  return (
    <div>
      <SH color={C.cyan}>Data Preprocessing Pipeline</SH>
      <InfoBox color={C.cyan}>
        Pipeline designed by adapting <strong>PSMASegmentator</strong> (UWA Medical Physics Research Group, 2025)
        preprocessing techniques. Key steps: DICOM→NIfTI conversion, CT–PET spatial alignment,
        intensity normalisation, and lesion-biased patch sampling.
      </InfoBox>

      {/* Horizontal pipeline nav */}
      <div className="ho-pipe-nav">
        {PIPELINE_STEPS.map((s, i) => (
          <button
            key={i}
            className={`ho-pipe-btn${active===i?' ho-pipe-btn--on':''}`}
            style={{ '--pipe-color': s.color }}
            onClick={() => setActive(i)}
          >
            <span className="ho-pipe-n">{s.n}</span>
            <span className="ho-pipe-t">{s.title}</span>
          </button>
        ))}
      </div>

      {/* Active step detail */}
      <div className="ho-pipe-panel" style={{ borderColor: s.color }}>
        <div className="ho-pipe-header">
          <span className="ho-pipe-num" style={{ color: s.color }}>{s.n}</span>
          <div>
            <p className="ho-pipe-title" style={{ color: s.color }}>{s.title}</p>
            <p className="ho-pipe-source">source: {s.source}</p>
          </div>
        </div>
        <p className="ho-pipe-desc">{s.desc}</p>
        <Code code={s.code} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB: IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────
function TabImplementation() {
  const [open, setOpen] = useState(null);
  const sections = [
    {
      id: 'env', title: 'Environment Setup',
      color: C.cyan,
      code: `# Install CUDA-compatible PyTorch + mamba-ssm
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
pip install mamba-ssm                # official SSM library
pip install monai nibabel pydicom    # medical imaging
pip install SimpleITK tqdm           # ITK + progress

# Verify mamba install
python -c "from mamba_ssm import Mamba; print('Mamba OK')"`,
    },
    {
      id: 'model', title: 'Full Model Skeleton',
      color: C.rose,
      code: `import torch, torch.nn as nn
from mamba_ssm import Mamba

class PSMAMamba(nn.Module):
    """Hybrid CNN-Mamba U-Net for PSMA PET segmentation."""

    def __init__(self, in_ch=2, base=32, d_state=16, n_mamba=2):
        super().__init__()
        # ── Encoder ──────────────────────────────────────────
        self.enc1 = ConvBlock3D(in_ch,   base)    # (B,32,D/2,H/2,W/2)
        self.enc2 = EncStage(base,   base*2, n_mamba, d_state)  # (B,64,D/4,H/4,W/4)
        self.enc3 = EncStage(base*2, base*4, n_mamba, d_state)  # (B,128,D/8,H/8,W/8)

        # ── Bottleneck Mamba blocks ───────────────────────────
        self.bottleneck = ConvBlock3D(base*4, base*8)
        self.mamba_bot  = nn.Sequential(*[
            Mamba(d_model=base*8, d_state=d_state*2, d_conv=4, expand=2)
            for _ in range(4)
        ])

        # ── Decoder ──────────────────────────────────────────
        self.dec3 = DecStage(base*8, base*4)
        self.dec2 = DecStage(base*4, base*2)
        self.dec1 = DecStage(base*2, base)

        # ── Output ───────────────────────────────────────────
        self.seg_head = nn.Conv3d(base, 1, kernel_size=1)  # binary seg

    def mamba_seq(self, x, mamba_blocks):
        B, C, d, h, w = x.shape
        seq = x.flatten(2).transpose(1, 2)  # (B, L, C)
        seq = mamba_blocks(seq)
        return seq.transpose(1, 2).reshape(B, C, d, h, w)

    def forward(self, x):
        # Encoder + skip connections
        f1 = self.enc1(x)
        f2 = self.enc2(f1)
        f3 = self.enc3(f2)

        # Bottleneck with global context
        b  = self.bottleneck(f3)
        b  = self.mamba_seq(b, self.mamba_bot)

        # Decoder with skip connections
        x = self.dec3(b,  f3)
        x = self.dec2(x,  f2)
        x = self.dec1(x,  f1)
        return self.seg_head(x)`,
    },
    {
      id: 'loss', title: 'Tversky Loss Function',
      color: C.amber,
      code: `class TverskyLoss(nn.Module):
    """
    Tversky loss for extreme class imbalance.

    Setting beta > alpha penalises FN (missed lesions) more
    than FP (false alarms) — critical in oncology where
    missing a metastatic lesion is more harmful than a FP.

    Target: improve baseline sensitivity from 73% while
    maintaining PPV ≥ 88%. Start with alpha=0.3, beta=0.7.
    """
    def __init__(self, alpha=0.3, beta=0.7, smooth=1e-5):
        super().__init__()
        self.alpha = alpha   # FP weight (lower = allow more FP)
        self.beta  = beta    # FN weight (higher = penalise missed lesions)
        self.smooth = smooth

    def forward(self, logits, targets):
        pred = torch.sigmoid(logits)    # (B, 1, D, H, W)
        TP = (pred * targets).sum()
        FP = (pred * (1 - targets)).sum()
        FN = ((1 - pred) * targets).sum()
        tversky = (TP + self.smooth) / (
            TP + self.alpha * FP + self.beta * FN + self.smooth
        )
        return 1 - tversky

# Combined loss (Tversky + BCE for numerical stability)
criterion = lambda p, t: TverskyLoss()(p, t) + 0.3 * F.binary_cross_entropy_with_logits(p, t)`,
    },
    {
      id: 'train', title: 'Training Loop',
      color: C.emerald,
      code: `import torch.optim as optim
from torch.optim.lr_scheduler import CosineAnnealingLR

model    = PSMAMamba(in_ch=2, base=32, d_state=16).cuda()
optimizer = optim.AdamW(model.parameters(), lr=1e-4, weight_decay=1e-5)
scheduler = CosineAnnealingLR(optimizer, T_max=500, eta_min=1e-6)

for epoch in range(500):
    model.train()
    for batch in train_loader:
        imgs   = batch['image'].cuda()   # (B, 2, 96, 96, 96)
        labels = batch['label'].cuda()   # (B, 1, 96, 96, 96)

        optimizer.zero_grad()
        preds = model(imgs)
        loss  = criterion(preds, labels)
        loss.backward()

        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()

    scheduler.step()

    # Validation every 10 epochs
    if epoch % 10 == 0:
        val_f1  = evaluate_f1(model, val_loader)
        val_dsc = evaluate_dsc(model, val_loader)
        print(f"Epoch {epoch:3d} | F1={val_f1:.4f} | DSC={val_dsc:.4f}")`,
    },
    {
      id: 'eval', title: 'Evaluation Metrics',
      color: C.violet,
      code: `from monai.metrics import DiceMetric

def evaluate_metrics(model, loader, threshold=0.5):
    model.eval()
    lesion_f1s, dsc_scores = [], []

    with torch.no_grad():
        for batch in loader:
            imgs   = batch['image'].cuda()
            labels = batch['label'].cuda()
            preds  = torch.sigmoid(model(imgs)) > threshold  # binary mask

            # ── Voxel-level DSC ───────────────────────────────
            dsc = DiceMetric()(preds, labels)
            dsc_scores.append(dsc.item())

            # ── Lesion-level F1 (connected component analysis) ─
            pred_np  = preds.cpu().numpy()[0, 0]
            label_np = labels.cpu().numpy()[0, 0]
            f1 = lesion_level_f1(pred_np, label_np, iou_threshold=0.1)
            lesion_f1s.append(f1)

    return {
        'mean_dsc':      float(np.mean(dsc_scores)),
        'lesion_f1':     float(np.mean(lesion_f1s)),
    }`,
    },
  ];

  return (
    <div>
      <SH color={C.rose}>End-to-End Implementation</SH>
      <InfoBox color={C.rose}>
        Complete implementation plan using <strong>mamba-ssm</strong> (official Mamba library),
        <strong> MONAI</strong> (medical imaging transforms), and <strong>SimpleITK</strong>
        (preprocessing — reused from PSMASegmentator). Training target hardware: SCGH HPC with ≥16 GB VRAM.
      </InfoBox>
      <div className="ho-accordion">
        {sections.map(s => (
          <div key={s.id} className="ho-acc-item" style={{ '--acc-color': s.color }}>
            <button className="ho-acc-header" onClick={() => setOpen(open === s.id ? null : s.id)}>
              <span className="ho-acc-title" style={{ color: s.color }}>{s.title}</span>
              <span className="ho-acc-chevron">{open === s.id ? '▲' : '▼'}</span>
            </button>
            {open === s.id && (
              <div className="ho-acc-body">
                <Code code={s.code} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB: ROADMAP
// ─────────────────────────────────────────────────────────────────────────────
const MILESTONES = [
  { month: 'Feb–Mar 2025', phase: 'Phase 1', title: 'Foundation',   color: C.cyan,    status: 'done',
    tasks: ['Literature review: U-Mamba, nnU-Net, VMamba', 'Research proposal submission', 'Dataset access request (SCGH)', 'Baseline nnU-Net reproduction'] },
  { month: 'Apr 2025',     phase: 'Phase 2', title: 'Data Pipeline', color: C.rose,   status: 'active',
    tasks: ['DICOM→NIfTI preprocessing pipeline', 'CT–PET alignment & validation', 'Patch sampling strategy', 'Train/val/test split (patient-level)'] },
  { month: 'May 2025',     phase: 'Phase 3', title: 'Architecture',  color: C.violet, status: 'upcoming',
    tasks: ['U-Mamba encoder-decoder implementation', 'Mamba block integration (mamba-ssm)', '3D scanning strategy experiments', 'Initial training runs'] },
  { month: 'Jun 2025',     phase: 'Phase 4', title: 'Training',      color: C.amber,  status: 'upcoming',
    tasks: ['Tversky loss hyperparameter sweep (α, β)', 'LR schedule & optimizer tuning', 'Patch size ablation (64³ vs 96³ vs 128³)', 'VRAM profiling & optimisation'] },
  { month: 'Jul 2025',     phase: 'Phase 5', title: 'Evaluation',    color: C.emerald,status: 'upcoming',
    tasks: ['Full dataset evaluation (lesion F1, DSC)', 'Ablation: pure Mamba vs hybrid CNN-Mamba', 'Comparison table vs nnU-Net baseline', 'Qualitative results visualisation'] },
  { month: 'Aug–Sep 2025', phase: 'Phase 6', title: 'Thesis',        color: C.cyan,   status: 'upcoming',
    tasks: ['Thesis writing (methods, results, discussion)', 'Supervisor review cycles', 'Final submission', 'Honours presentation'] },
];

function TabRoadmap() {
  const statusIcon = s => ({ done: '✓', active: '◉', upcoming: '○' }[s]);
  const statusLabel = s => ({ done: 'COMPLETE', active: 'IN PROGRESS', upcoming: 'UPCOMING' }[s]);

  return (
    <div>
      <SH color={C.amber}>Research Timeline</SH>
      <InfoBox color={C.amber}>
        6-phase research plan from Feb 2025 through Sep 2025.
        Current phase: <strong style={{ color: C.rose }}>Data Pipeline</strong> (Apr 2025).
      </InfoBox>

      <div className="ho-roadmap">
        {MILESTONES.map((m, i) => (
          <div key={i} className={`ho-milestone ho-milestone--${m.status}`} style={{ '--ms-color': m.color }}>
            <div className="ho-ms-aside">
              <span className="ho-ms-icon" style={{ color: m.color }}>{statusIcon(m.status)}</span>
              {i < MILESTONES.length - 1 && <div className="ho-ms-line" />}
            </div>
            <div className="ho-ms-body">
              <div className="ho-ms-head">
                <span className="ho-ms-phase" style={{ color: m.color }}>{m.phase}</span>
                <span className="ho-ms-status" style={{ color: m.status === 'done' ? C.emerald : m.status === 'active' ? C.rose : 'var(--text-2)' }}>
                  {statusIcon(m.status)} {statusLabel(m.status)}
                </span>
              </div>
              <p className="ho-ms-title">{m.title}</p>
              <p className="ho-ms-month">{m.month}</p>
              <ul className="ho-ms-tasks">
                {m.tasks.map((t, j) => (
                  <li key={j} className="ho-ms-task">
                    <span style={{ color: m.status === 'done' ? C.emerald : m.color }}>
                      {m.status === 'done' ? '✓' : '›'}
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  RESEARCH PAPERS — SegResMamba
// ─────────────────────────────────────────────────────────────────────────────
const CMMB_BLOCKS = [
  {
    id: 'conv5a', label: 'Conv 5×5×5', dims: 'Coarse-grained feature extraction',
    color: C.cyan,
    technical: 'A 3D convolution with a large 5×5×5 kernel. The wide receptive field extracts coarse structural features in one step — capturing high-level patterns like organ boundaries or tumour regions across a large 3D neighbourhood.',
    simple: 'Like a wide-angle lens: this big filter looks at a large 3D region at once, spotting rough outlines of important structures — the shape of an organ, or whether a region might be a tumour.',
    code: `# Input X: (B, C, D, H, W)
F1 = Conv3d(in_ch, hidden_ch, kernel_size=5, padding=2)(X)
# Larger kernel = bigger 3D "view" at each voxel position`,
  },
  {
    id: 'conv3a', label: 'Conv 3×3×3', dims: 'Local detail refinement',
    color: C.rose,
    technical: 'A smaller 3×3×3 convolution refines the coarse features — capturing fine-grained local spatial relationships such as sharp edges and texture patterns between adjacent voxels.',
    simple: 'Now a zoom-in lens: this narrower filter sharpens the picture, picking out fine details like the precise edge between a tumour and healthy tissue, or subtle texture differences.',
    code: `F2 = Conv3d(hidden_ch, hidden_ch, kernel_size=3, padding=1)(F1)
# Refines local edges and textures after coarse extraction`,
  },
  {
    id: 'tom1', label: 'ToM — 1st scan', dims: 'Tri-oriented Mamba (global context)',
    color: C.violet,
    technical: 'Tri-oriented Mamba flattens the 3D feature map into sequences in three directions — forward-z, reverse-z, and inter-slice — running an independent Mamba SSM on each. Outputs are summed. This captures long-range dependencies across the full 3D volume that convolutions miss.',
    simple: 'Imagine reading a 3D book in 3 different ways: front-to-back, back-to-front, and jumping across all slices column by column. SegResMamba reads the scan all three ways so distant features can "talk" — a top lesion can connect with a bottom one.',
    code: `# Flatten 3D volume → three 1D sequences, Mamba on each
z_f = flatten_z_forward(F2)     # z=0 → z=D (front→back)
z_r = flatten_z_reverse(F2)     # z=D → z=0 (back→front)
z_s = flatten_interslice(F2)    # column-wise across slices
F3 = Mamba(z_f) + Mamba(z_r) + Mamba(z_s)  # sum directions
F3 = reshape_to_3d(F3)`,
  },
  {
    id: 'conv3b', label: 'Conv 3×3×3', dims: 'Spatial structure recovery',
    color: C.amber,
    technical: 'Restores local spatial structure lost when the feature map was flattened to sequences for ToM. Prepares spatially coherent features for the transposed convolution upsampling step.',
    simple: 'After the global scan, we "re-anchor" where things are in 3D space — moving from abstract long-range connections back to a concrete spatial map of the volume.',
    code: `F4 = Conv3d(hidden_ch, hidden_ch, kernel_size=3, padding=1)(F3)
# Re-anchors spatial layout after global SSM scan`,
  },
  {
    id: 'convt5', label: 'ConvT 5×5×5', dims: 'Spatial resolution recovery',
    color: C.emerald,
    technical: 'Transposed convolution with 5×5×5 kernel reverses the spatial compression of the initial Conv 5×5×5, restoring the feature map to the original block input resolution.',
    simple: 'The "zoom out" — we reverse the initial compression, expanding back to full size while keeping all the rich features discovered during processing.',
    code: `F5 = ConvTranspose3d(hidden_ch, in_ch, kernel_size=5, padding=2)(F4)
# Mirrors Conv5×5×5 — restores original spatial dimensions`,
  },
  {
    id: 'residual', label: '⊕ Residual', dims: 'Skip: F5 + original input X',
    color: C.cyan,
    technical: 'A residual (skip) connection adds the original block input X back to F5. Prevents vanishing gradients and lets the block learn residual corrections rather than full mappings. Essential for stable training of deep networks.',
    simple: 'Like keeping your original notes while also writing new ones — no matter how much we transform the data, we add the raw input back so nothing valuable is lost. This also stops training from "forgetting" earlier features.',
    code: `F6 = F5 + X   # residual skip connection
# Model learns to correct, not rewrite, the input features`,
  },
  {
    id: 'tom2', label: 'ToM — 2nd scan', dims: 'Final global context pass',
    color: C.violet,
    technical: 'A second Tri-oriented Mamba scan on F6 = F5 + X. Because F6 combines high-level processed features (F5) with the original low-level input (X), this final SSM pass operates on a richer, multi-scale representation.',
    simple: 'One last global sweep — now with the full picture: original raw data AND everything learned so far. This is where the model builds its most complete, long-range understanding of the entire 3D volume.',
    code: `F_out = ToM(F6)
# Second pass: global context over enriched (conv + original) features`,
  },
];

function CMMBDiagram() {
  const [active, setActive] = useState('tom1');
  const [mode, setMode] = useState('simple');
  const block = CMMB_BLOCKS.find(b => b.id === active);

  return (
    <div>
      <div className="ho-mode-toggle">
        <span className="ho-mode-label">Explanation mode:</span>
        {[['simple', '☁ PLAIN ENGLISH'], ['technical', '</> TECHNICAL']].map(([m, lbl]) => (
          <button
            key={m}
            className={`ho-view-btn${mode === m ? ' ho-view-btn--on' : ''}`}
            onClick={() => setMode(m)}
          >{lbl}</button>
        ))}
      </div>

      <div className="ho-arch">
        <div className="ho-arch-flow">
          <div className="ho-arch-io">
            <span style={{ color: 'var(--text-2)' }}>Input X</span>
            <span className="ho-arch-dims">(B, C, D, H, W)</span>
          </div>
          <div className="ho-arch-connector" />
          {CMMB_BLOCKS.map((b, i) => (
            <div key={b.id}>
              <button
                className={`ho-arch-box${active === b.id ? ' ho-arch-box--active' : ''}`}
                style={{ '--box-color': b.color }}
                onClick={() => setActive(b.id)}
              >
                <span className="ho-arch-box-label">{b.label}</span>
                <span className="ho-arch-box-dims">{b.dims}</span>
              </button>
              {i < CMMB_BLOCKS.length - 1 && <div className="ho-arch-connector" />}
            </div>
          ))}
          <div className="ho-arch-connector" />
          <div className="ho-arch-io">
            <span style={{ color: 'var(--text-2)' }}>F_out</span>
            <span className="ho-arch-dims">(B, C, D, H, W)</span>
          </div>
        </div>

        <div className="ho-arch-detail">
          <p className="ho-arch-detail-name" style={{ color: block.color }}>{block.label}</p>
          <p className="ho-arch-detail-dims">{block.dims}</p>
          {mode === 'simple' ? (
            <div>
              <span className="ho-simple-badge">☁ PLAIN ENGLISH</span>
              <p className="ho-arch-detail-desc" style={{ marginTop: '0.5rem' }}>{block.simple}</p>
            </div>
          ) : (
            <div>
              <span className="ho-tech-badge">&lt;/&gt; TECHNICAL</span>
              <p className="ho-arch-detail-desc" style={{ marginTop: '0.5rem' }}>{block.technical}</p>
            </div>
          )}
          <Code code={block.code} />
          <p className="ho-arch-hint">// click any block to inspect</p>
        </div>
      </div>
    </div>
  );
}

function ToMVisualizer() {
  const [active, setActive] = useState(0);
  const dirs = [
    {
      id: 'zf', label: 'z_f', full: 'Forward  (front → back)',
      color: C.rose,
      grid: [['→','→','→'],['→','→','→'],['→','→','→']],
      axisNote: 'z = 0 (front) → z = D (back)',
      techDesc: 'The 3D volume is flattened slice by slice from z=0 to z=D. The Mamba SSM processes these in sequence, building a hidden state h_t that accumulates information from all previous slices — capturing long-range front-to-back dependencies.',
      simpleDesc: 'Like reading a stack of scan slices front-to-back: each slice can recall everything it "saw" in all earlier slices. A deep lesion can inform our understanding of a shallow one.',
    },
    {
      id: 'zr', label: 'z_r', full: 'Reverse  (back → front)',
      color: C.cyan,
      grid: [['←','←','←'],['←','←','←'],['←','←','←']],
      axisNote: 'z = D (back) → z = 0 (front)',
      techDesc: 'Same volume, reversed z-order. Paired with the forward scan, every voxel now has access to both past (z < t) and future (z > t) context — equivalent to a bidirectional SSM along the z-axis.',
      simpleDesc: 'Reading the same slices backwards — each slice also knows what comes after it. Together, forward + reverse means every slice is fully informed about the whole depth of the volume.',
    },
    {
      id: 'zs', label: 'z_s', full: 'Inter-slice  (columns)',
      color: C.violet,
      grid: [['↕','↕','↕'],['↕','↕','↕'],['↕','↕','↕']],
      axisNote: 'column-wise: same (x,y) across all z',
      techDesc: 'Instead of scanning along z for each (x,y) position, this direction traverses column-first: for each (x,y) column, all z values are read in sequence. Captures vertical cross-slice correlations missed by z-only scanning.',
      simpleDesc: 'Instead of reading page by page, read each column straight down through all pages. This links the same (x,y) position across every depth — perfect for tracing a structure that spans many slices.',
    },
  ];

  const d = dirs[active];

  return (
    <div>
      <div className="ho-view-btns">
        {dirs.map((dir, i) => (
          <button
            key={dir.id}
            className={`ho-view-btn${active === i ? ' ho-view-btn--on' : ''}`}
            style={active === i ? { color: dir.color, borderColor: dir.color, background: `${dir.color}18` } : {}}
            onClick={() => setActive(i)}
          >
            <code style={{ fontFamily: 'var(--font-mono)' }}>{dir.label}</code>
            &nbsp;— {dir.full.split('(')[0].trim()}
          </button>
        ))}
      </div>

      <div className="ho-tom-row">
        <div className="ho-tom-box" style={{ borderColor: d.color }}>
          <p className="ho-tom-dir-label" style={{ color: d.color }}>{d.full}</p>
          <div className="ho-tom-dir-grid">
            {d.grid.map((row, r) => row.map((cell, c) => (
              <span key={`${r}-${c}`} className="ho-tom-cell" style={{ color: d.color }}>{cell}</span>
            )))}
          </div>
          <p className="ho-tom-axis-note">{d.axisNote}</p>
        </div>

        <div className="ho-tom-descs">
          <div className="ho-infobox" style={{ borderLeftColor: 'var(--border)', margin: 0 }}>
            <span className="ho-simple-badge">☁ PLAIN ENGLISH</span>
            <p style={{ marginTop: '0.4rem', fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.6 }}>{d.simpleDesc}</p>
          </div>
          <div className="ho-infobox" style={{ borderLeftColor: d.color, margin: 0 }}>
            <span className="ho-tech-badge" style={{ color: d.color, borderColor: d.color }}>&lt;/&gt; TECHNICAL</span>
            <p style={{ marginTop: '0.4rem', fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.6 }}>{d.techDesc}</p>
          </div>
        </div>
      </div>

      <div className="ho-tom-formula-row">
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-2)' }}>ToM(F) =</span>
        <span className="ho-eq" style={{ color: C.rose }}>Mamba(z_f)</span>
        <span style={{ color: 'var(--text-2)', fontFamily: 'var(--font-mono)', padding: '0 0.4rem' }}>+</span>
        <span className="ho-eq" style={{ color: C.cyan }}>Mamba(z_r)</span>
        <span style={{ color: 'var(--text-2)', fontFamily: 'var(--font-mono)', padding: '0 0.4rem' }}>+</span>
        <span className="ho-eq" style={{ color: C.violet }}>Mamba(z_s)</span>
      </div>
    </div>
  );
}

function PaperSegResMamba() {
  const [section, setSection] = useState('keypoints');

  return (
    <div>
      <div className="ho-paper-hero">
        <span className="ho-paper-venue">MIDL 2025 · Accepted</span>
        <h2 className="ho-paper-title">SegResMamba</h2>
        <p className="ho-paper-subtitle">An Efficient Architecture for 3D Medical Image Segmentation</p>
        <p className="ho-paper-authors">Das, Singh, Islam, Zhao, Maier · Siemens Healthineers &amp; FAU Erlangen-Nuremberg</p>
        <div className="ho-tags" style={{ marginTop: '0.75rem' }}>
          {['MAMBA SSM','3D SEGMENTATION','HYBRID CNN-MAMBA','MEMORY EFFICIENT','TRI-ORIENTED MAMBA'].map(t => (
            <span key={t} className="ho-tag">{t}</span>
          ))}
        </div>
      </div>

      <div className="ho-view-btns">
        {[['keypoints','Key Points'],['architecture','Architecture'],['results','Results']].map(([k, lbl]) => (
          <button
            key={k}
            className={`ho-view-btn${section === k ? ' ho-view-btn--on' : ''}`}
            onClick={() => setSection(k)}
          >{lbl.toUpperCase()}</button>
        ))}
      </div>

      {section === 'keypoints' && (
        <div>
          <SH color={C.violet}>TL;DR</SH>
          <InfoBox color={C.violet}>
            SegResMamba achieves <strong>comparable accuracy to heavy Transformer models</strong> while using
            <strong> less than half their training memory</strong>. It combines local CNN feature extraction with
            global Mamba SSM context modelling, designed specifically for resource-constrained clinical settings.
          </InfoBox>

          <div className="ho-stat-grid">
            {[
              { val: '4.78 GB', lbl: 'BraTS Training Memory', sub: 'vs 13.44 GB for SegMamba', color: C.emerald },
              { val: '340 G', lbl: 'MACs (BraTS)', sub: 'vs 1575 G for SegMamba', color: C.cyan },
              { val: '0.9147', lbl: 'Dice — Spleen', sub: '#1 rank on spleen dataset', color: C.rose },
              { val: '0.8839', lbl: 'Mean Dice — BraTS', sub: '−0.24% vs SegMamba, 3.6× less memory', color: C.amber },
            ].map(s => (
              <div key={s.lbl} className="ho-stat-card" style={{ borderColor: s.color }}>
                <p className="ho-stat-val" style={{ color: s.color }}>{s.val}</p>
                <p className="ho-stat-lbl">{s.lbl}</p>
                <p className="ho-stat-sub">{s.sub}</p>
              </div>
            ))}
          </div>

          <SH color={C.cyan}>5 Key Innovations</SH>
          <div className="ho-aims">
            {[
              {
                n: '01', title: 'Convolution Mamba Mixed Block (CMMB)',
                desc: 'A novel block interleaving multi-scale convolutions (5×5×5 → 3×3×3) with two Tri-oriented Mamba scans and a residual connection. Captures both local texture and global long-range context in one efficient unit.',
                color: C.violet,
              },
              {
                n: '02', title: 'Tri-oriented Mamba (ToM)',
                desc: 'Mamba is applied independently in three directions — forward-z, reverse-z, and inter-slice — and outputs are summed. Full 3D long-range coverage without the quadratic cost of 3D self-attention.',
                color: C.rose,
              },
              {
                n: '03', title: 'Lightweight Decoder with Additive Skip Connections',
                desc: 'Rather than concatenating skip connections (which doubles channels), SegResMamba sums encoder and decoder features. The encoder bears the representational load; the decoder stays slim and memory-efficient.',
                color: C.amber,
              },
              {
                n: '04', title: 'Training Memory < Half of SegMamba',
                desc: 'SegResMamba uses 4.78 GB vs SegMamba\'s 13.44 GB on BraTS. This enables deployment on single-GPU clinical workstations that cannot run SwinUNETR or SegMamba.',
                color: C.emerald,
              },
              {
                n: '05', title: 'CO₂ Efficiency',
                desc: '267 s/epoch vs 321 s for SwinUNETR — ~16% fewer emissions per 5-fold cross-validation. SegResMamba sits at the "efficiency frontier" of the accuracy vs CO₂ trade-off curve.',
                color: C.cyan,
              },
            ].map(a => (
              <div key={a.n} className="ho-aim">
                <span className="ho-aim-num" style={{ color: a.color }}>{a.n}</span>
                <div>
                  <p className="ho-aim-title">{a.title}</p>
                  <p className="ho-aim-desc">{a.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <SH color={C.rose}>Relevance to This Honours Project</SH>
          <InfoBox color={C.rose}>
            SegResMamba's <strong>Tri-oriented Mamba (ToM)</strong> is a strong candidate to replace or augment the 6-directional scan
            used in U-Mamba for whole-body PSMA PET — potentially fewer parameters with equivalent 3D coverage. The
            <strong> memory efficiency</strong> (under 5 GB) is critical for the SCGH HPC environment. The lightweight
            <strong> additive decoder</strong> also reduces VRAM during training on large whole-body volumes.
          </InfoBox>
        </div>
      )}

      {section === 'architecture' && (
        <div>
          <SH color={C.cyan}>Overall U-Net Shape</SH>
          <InfoBox color={C.cyan}>
            SegResMamba follows a U-shaped encoder-decoder design. The <strong>encoder</strong> uses a 7×7×7 initial
            downsampling layer followed by 3 stages of 2×2×2 conv + CMMB blocks to build a rich feature hierarchy.
            The <strong>decoder</strong> is intentionally lightweight — 3 upsampling stages with additive skip connections via MLP layers.
          </InfoBox>
          <div className="ho-card">
            <p className="ho-card-h" style={{ color: C.cyan }}>// SegResMamba Encoder-Decoder</p>
            <div className="ho-arch-sketch">
              {[
                { l: 'Input (B, C, D, H, W)', c: C.cyan, dim: 'e.g. 4 MRI modalities' },
                { l: 'Conv3D 7×7×7, stride 2', c: C.cyan, dim: '(B, 32, D/2, H/2, W/2)', arrow: '↓' },
                { l: 'CMMB Block', c: C.violet, dim: 'local + global context' },
                { l: 'Conv3D 2×2×2 + CMMB  ×3', c: C.violet, dim: '×3 stages, ×2 downsample', arrow: '↓ + skip₁,₂,₃' },
                { l: 'Bottleneck', c: C.rose, dim: '(B, 768, D/16, ...)' },
                { l: 'MLP + Upsample ×3', c: C.amber, dim: '⊕ additive skip connections', arrow: '↑' },
                { l: 'Conv 1×1×1  Output Head', c: C.emerald, dim: '(B, n_classes, D, H, W)' },
              ].map((r, i) => (
                <div key={i} className="ho-sketch-row">
                  {r.arrow && <span className="ho-sketch-arrow">{r.arrow}</span>}
                  <div className="ho-sketch-box" style={{ borderColor: r.c }}>
                    <span className="ho-sketch-lbl" style={{ color: r.c }}>{r.l}</span>
                    <span className="ho-sketch-dim">{r.dim}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <SH color={C.violet}>Convolution Mamba Mixed Block (CMMB) — Interactive</SH>
          <InfoBox color={C.violet}>
            Click each layer in the diagram to see what it does. Toggle between <strong>Plain English</strong> and
            <strong> Technical</strong> explanations. The CMMB is the heart of SegResMamba — it uniquely combines
            multi-scale convolutions with two Tri-oriented Mamba scans and a residual connection.
          </InfoBox>
          <CMMBDiagram />

          <SH color={C.rose}>Tri-oriented Mamba (ToM) — Interactive</SH>
          <InfoBox color={C.rose}>
            ToM is SegResMamba's mechanism for full 3D long-range context. Rather than a single scan direction
            (which misses cross-axis dependencies), ToM applies Mamba in 3 complementary directions and sums the results.
            Select a direction below to understand how each one works.
          </InfoBox>
          <div className="ho-card">
            <p className="ho-card-h" style={{ color: C.rose }}>// Three Mamba scan directions, summed</p>
            <ToMVisualizer />
          </div>
        </div>
      )}

      {section === 'results' && (
        <div>
          <SH color={C.amber}>Performance vs Compute Trade-off</SH>
          <InfoBox color={C.amber}>
            SegResMamba sits at the <strong>"efficiency frontier"</strong> — competitive Dice scores at significantly lower
            memory and compute than SwinUNETR and SegMamba. The key design insight:
            <em> a powerful encoder can offset a deliberately lightweight decoder</em>.
          </InfoBox>

          <div className="ho-card">
            <p className="ho-card-h" style={{ color: C.cyan }}>// BTCV Multi-organ Segmentation (13 organs, 30 volumes)</p>
            <table className="ho-table">
              <thead><tr><th>Model</th><th>MACs</th><th>Inference (s)</th><th>Avg Dice</th></tr></thead>
              <tbody>
                {[
                  ['UNETR','196 G','0.053','0.8027',false],
                  ['SegMamba','1555 G','0.169','0.8430',false],
                  ['SwinUNETR','784 G','0.134','0.8389',false],
                  ['nnUNet','1068 G','0.167','0.8316',false],
                  ['SegResMamba','336 G','0.084','0.8361',true],
                ].map(([m,mac,inf,dice,hl]) => (
                  <tr key={m} style={hl ? { background: 'rgba(139,92,246,0.08)' } : {}}>
                    <td className="ho-td-key" style={hl ? { color: C.violet } : {}}>{m}</td>
                    <td>{mac}</td><td>{inf}</td>
                    <td style={hl ? { color: C.violet, fontWeight: 700 } : {}}>{dice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ho-two-col">
            <div className="ho-card">
              <p className="ho-card-h" style={{ color: C.rose }}>// BraTS 2021 Brain Tumour (5-fold)</p>
              <table className="ho-table">
                <thead><tr><th>Model</th><th>MACs</th><th>Mean Dice</th></tr></thead>
                <tbody>
                  {[
                    ['UNETR','203 G','0.8617',false],
                    ['SegMamba','1575 G','0.8863',false],
                    ['SwinUNETR','792 G','0.8861',false],
                    ['SegResMamba','341 G','0.8839',true],
                  ].map(([m,mac,dice,hl]) => (
                    <tr key={m} style={hl ? { background: 'rgba(139,92,246,0.08)' } : {}}>
                      <td className="ho-td-key" style={hl ? { color: C.violet } : {}}>{m}</td>
                      <td>{mac}</td>
                      <td style={hl ? { color: C.violet, fontWeight: 700 } : {}}>{dice}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ho-card">
              <p className="ho-card-h" style={{ color: C.emerald }}>// Spleen Segmentation</p>
              <table className="ho-table">
                <thead><tr><th>Model</th><th>MACs</th><th>Avg Dice</th></tr></thead>
                <tbody>
                  {[
                    ['UNET','12 G','0.8195',false],
                    ['UNETR','83 G','0.8642',false],
                    ['SegMamba','655 G','0.9004',false],
                    ['SwinUNETR','329 G','0.9126',false],
                    ['SegResMamba','138 G','0.9147 ★',true],
                  ].map(([m,mac,dice,hl]) => (
                    <tr key={m} style={hl ? { background: 'rgba(52,211,153,0.08)' } : {}}>
                      <td className="ho-td-key" style={hl ? { color: C.emerald } : {}}>{m}</td>
                      <td>{mac}</td>
                      <td style={hl ? { color: C.emerald, fontWeight: 700 } : {}}>{dice}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <SH color={C.emerald}>Memory Efficiency</SH>
          <div className="ho-card">
            <p className="ho-card-h" style={{ color: C.emerald }}>// Training memory (GB) — batch size 1</p>
            <table className="ho-table">
              <thead><tr><th>Model</th><th>BTCV (128³)</th><th>Spleen (96³)</th><th>BraTS (128³)</th></tr></thead>
              <tbody>
                {[
                  ['UNET','1.42','0.48','1.13',false],
                  ['UNETR','3.08','0.14','3.02',false],
                  ['SwinUNETR','7.77','3.21','7.68',false],
                  ['SegMamba','13.51','5.68','13.44',false],
                  ['SegResMamba','5.10','2.22','4.78',true],
                ].map(([m,b,s,br,hl]) => (
                  <tr key={m} style={hl ? { background: 'rgba(52,211,153,0.08)' } : {}}>
                    <td className="ho-td-key" style={hl ? { color: C.emerald } : {}}>{m}</td>
                    {[b,s,br].map((v,i) => (
                      <td key={i} style={hl ? { color: C.emerald, fontWeight: 700 } : {}}>{v} GB</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SH color={C.rose}>Ablation — What Actually Helps?</SH>
          <div className="ho-two-col">
            <div className="ho-card">
              <p className="ho-card-h" style={{ color: C.rose }}>// Architecture ablation (BTCV)</p>
              <table className="ho-table">
                <thead><tr><th>Setup</th><th>Avg Dice</th><th>Δ</th></tr></thead>
                <tbody>
                  {[
                    ['SegMamba encoder + ResNet decoder','0.8164','—'],
                    ['+ CMMB block','0.8279','+1.15%'],
                    ['+ Conv before downsampling','0.8361','+0.82%'],
                  ].map(([s,d,delta]) => (
                    <tr key={s}>
                      <td className="ho-td-key" style={{ fontSize: '0.68rem' }}>{s}</td>
                      <td style={s.includes('downsampling') ? { color: C.violet, fontWeight: 700 } : {}}>{d}</td>
                      <td style={{ color: C.emerald, fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>{delta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ho-card">
              <p className="ho-card-h" style={{ color: C.violet }}>// ToM ablation (BTCV)</p>
              <table className="ho-table">
                <thead><tr><th>Variant</th><th>Avg Dice</th></tr></thead>
                <tbody>
                  {[
                    ['Without ToM','0.8234',false],
                    ['With ToM (SegResMamba)','0.8361',true],
                  ].map(([v,d,hl]) => (
                    <tr key={v} style={hl ? { background: 'rgba(139,92,246,0.08)' } : {}}>
                      <td className="ho-td-key" style={hl ? { color: C.violet } : {}}>{v}</td>
                      <td style={hl ? { color: C.violet, fontWeight: 700 } : {}}>{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: '0.72rem', color: C.emerald, fontFamily: 'var(--font-mono)', marginTop: '0.5rem' }}>
                +1.27% Dice — tri-directional scan vs no ToM
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  RESEARCH PAPERS — uniform data-driven paper renderer
// ─────────────────────────────────────────────────────────────────────────────

const PAPERS_DATA = [
  // ── 1. Partial Volume Effect — Soret, Bacharach, Buvat (2007) ─────────────
  {
    id: 'pve', label: 'Partial Volume Effect', venue: 'J Nucl Med 2007', year: 2007, color: C.amber,
    hero: {
      title: 'Partial-Volume Effect in PET Tumor Imaging',
      subtitle: 'A comprehensive review of PVE phenomena and correction methods',
      authors: 'Soret · Bacharach · Buvat — J Nucl Med 2007 (48: 932–945)',
      tags: ['PET QUANTIFICATION', 'PVE', 'REVIEW', 'CLINICAL', 'SUV BIAS'],
    },
    tldr: "Foundational review on how PET's finite spatial resolution causes systematic underestimation of small lesion uptake — explaining why voxel-level Dice will always be modest for tiny metastatic lesions.",
    stats: [
      { val: '3× FWHM', lbl: 'Accuracy threshold', sub: 'lesions below: larger but dimmer', color: C.amber },
      { val: '2', lbl: 'Distinct PVE causes', sub: 'PSF blur + tissue-fraction', color: C.cyan },
      { val: '~50%', lbl: 'Typical SUV under-estimation', sub: 'for sub-resolution lesions', color: C.rose },
      { val: '7+', lbl: 'Correction methods reviewed', sub: 'no widely accepted clinical solution', color: C.violet },
    ],
    motivation: "Quantitative PET — SUVs, lesion volumes, treatment response — is the backbone of nuclear medicine. The scanner's finite spatial resolution causes signal to spill OUT of small hot lesions and surrounding tissue uptake to spill IN. Without understanding PVE, no quantitative PET result is trustworthy.",
    innovations: [
      { n: '01', title: 'Two-Phenomenon Decomposition', desc: '(1) 3D blurring from finite scanner resolution — convolution with the point-spread function. (2) Tissue-fraction effect — each voxel averages whatever tissues fall inside it.', color: C.amber },
      { n: '02', title: 'Recovery Coefficient (RC)', desc: 'Simplest, most clinically adopted correction. Assumes spherical tumor + uniform background. Returns a corrected number, not a corrected image. Widely used.', color: C.cyan },
      { n: '03', title: 'Geometric Transfer Matrix (GTM)', desc: 'Generalises RC to multiple compartments using anatomic priors from CT/MRI. Better for multi-region quantification — but assumes accurate boundary segmentation.', color: C.violet },
      { n: '04', title: 'Pixel-Level Corrections', desc: 'Iterative deconvolution, partition correction, wavelet methods, MAP reconstruction with anatomic priors, kinetic-model corrections. Produce corrected images (not just numbers).', color: C.rose },
      { n: '05', title: 'Measurement-Method Trade-offs', desc: 'SUVmax is observer-independent but noise-sensitive. Manual ROIs are subjective. Fixed-size ROIs introduce size bias. Isocontours depend on threshold choice — no free lunch.', color: C.emerald },
    ],
    architecture: {
      summary: 'Not an architecture paper — a conceptual taxonomy of correction methods, split into regional (correct numbers) vs. pixel-level (correct images). The pipeline below shows how PVE arises from a true lesion signal.',
      sketch: [
        { l: 'True lesion SUV', c: C.amber, dim: 'small object, e.g. 0.5 cm³ metastasis' },
        { l: '⊛ PSF convolution', c: C.rose, dim: 'finite scanner resolution', arrow: '↓' },
        { l: '⊕ Tissue-fraction effect', c: C.violet, dim: 'voxel averages multiple tissues', arrow: '↓' },
        { l: 'Observed SUV (biased ↓)', c: C.cyan, dim: 'underestimated, blurred, dim' },
        { l: 'PVE correction (RC/GTM/MAP)', c: C.emerald, dim: 'regional or pixel-level', arrow: '↑' },
        { l: 'Corrected SUV / image', c: C.amber, dim: 'closer to true value' },
      ],
    },
    results: {
      intro: 'No widely accepted single solution exists. RC is the only method with real clinical traction. Even imperfect correction substantially reduces bias. Strong advocacy for standardisation of acquisition, reconstruction, and ROI protocols.',
      tables: [
        {
          title: 'PVE correction methods at a glance', color: C.cyan,
          headers: ['Method', 'Output', 'Assumption', 'Adoption'],
          rows: [
            { cells: ['Recovery Coefficient', 'Number', 'Spherical tumor, uniform bg', 'Widespread'] },
            { cells: ['Geometric Transfer Matrix', 'Number', 'Multi-compartment anatomy', 'Research'] },
            { cells: ['Iterative deconvolution', 'Number', 'Known PSF', 'Limited'] },
            { cells: ['Partition correction', 'Image', 'Tissue map (MRI/CT)', 'Brain mainly'] },
            { cells: ['MAP reconstruction', 'Image', 'Anatomic prior', 'Experimental'] },
            { cells: ['Kinetic-model correction', 'Image', 'Dynamic acquisition', 'Niche'] },
          ],
        },
      ],
    },
    strengths: [
      'Comprehensive review — cleanly distinguishes PSF blurring vs. tissue-fraction effect',
      'Practical taxonomy of correction methods (regional vs. pixel-level)',
      'Honest about lack of universal clinical solution',
      'Strong advocacy for standardisation — later realised via EARL accreditation',
    ],
    weaknesses: [
      "Predates modern TOF and PSF modelling in iterative reconstruction (now routine)",
      'No widely accepted clinical solution at time of writing (2007)',
      'Measurement-method discussion is rich but lacks definitive recommendation',
      'Cross-centre standardisation remains a problem in 2026',
    ],
    relevance: "Explains why voxel-level DSC for PSMA segmentation is fundamentally bounded (~43% in Kendrick 2022). Tiny metastatic lesions are below the PSF resolution limit — their boundaries are physically blurred in the input itself. This motivates the Honours project's choice of lesion-level F1 (not voxel DSC) as the primary metric, and explains why beating Observer 2 on DSC is already an impressive result.",
  },

  // ── 2. U-Net — Ronneberger, Fischer, Brox (2015) ──────────────────────────
  {
    id: 'u-net', label: 'U-Net', venue: 'MICCAI 2015', year: 2015, color: C.cyan,
    hero: {
      title: 'U-Net',
      subtitle: 'Convolutional Networks for Biomedical Image Segmentation',
      authors: 'Ronneberger · Fischer · Brox — University of Freiburg, MICCAI 2015',
      tags: ['ENCODER-DECODER', 'SKIP CONNECTIONS', 'BIOMEDICAL', 'FOUNDATIONAL', '2D'],
    },
    tldr: 'The foundational encoder-decoder with skip connections that defined biomedical image segmentation — wins ISBI 2015 EM and cell-tracking challenges from just 30 training images.',
    stats: [
      { val: '92.0%', lbl: 'PhC-U373 IoU', sub: 'vs 83% second-best', color: C.cyan },
      { val: '77.6%', lbl: 'DIC-HeLa IoU', sub: 'vs 46% second-best', color: C.emerald },
      { val: '30', lbl: 'Training images (ISBI EM)', sub: 'works with tiny datasets', color: C.amber },
      { val: '< 1 s', lbl: 'Inference per 512×512', sub: 'on contemporary GPU', color: C.violet },
    ],
    motivation: "Image classification CNNs (Krizhevsky/AlexNet) couldn't help biomedical imaging because (1) segmentation needs per-pixel labels, not one label per image, and (2) annotated biomedical data is scarce (often dozens, not millions). The prior best — Ciresan's sliding-window CNN — was painfully slow and trapped between context and localisation.",
    innovations: [
      { n: '01', title: 'U-Shaped Encoder-Decoder', desc: 'Contracting path (encoder) doubles channels at each downsample for context. Symmetric expanding path (decoder) halves channels via 2×2 up-convolutions for precise localisation. Capacity flows both ways.', color: C.cyan },
      { n: '02', title: 'Skip Connections (Concatenation)', desc: 'Cropped encoder feature maps are concatenated into the decoder at the same resolution. High-resolution spatial detail is recovered exactly where the decoder needs it. This single idea changed segmentation.', color: C.rose },
      { n: '03', title: 'Overlap-Tile + Mirror Padding', desc: 'For images bigger than GPU memory, predict overlapping tiles. Border-pixel context filled via mirror padding. Lets U-Net segment arbitrarily large images seamlessly.', color: C.violet },
      { n: '04', title: 'Elastic Deformation Augmentation', desc: 'Random displacement field (σ=10 px, 3×3 grid, bicubic interp) teaches invariance to soft tissue deformations without needing annotations. Single biggest reason it works with 30 images.', color: C.amber },
      { n: '05', title: 'Distance-Weighted Loss for Touching Cells', desc: 'Pre-computed weight map gives huge loss weight to thin background pixels between touching cells. Forces the network to learn separation borders. Critical for instance segmentation.', color: C.emerald },
    ],
    architecture: {
      summary: '23 convolutional layers, no fully-connected. 4 downsampling stages (channels 64→128→256→512→1024 bottleneck). Symmetric decoder. Only valid (unpadded) convolutions — so output pixels always have full surrounding context.',
      sketch: [
        { l: 'Input 572×572 (1ch)', c: C.cyan, dim: 'biomedical image (EM, cell, MRI...)' },
        { l: 'Encoder × 4 — conv3×3 ×2 + ReLU + maxpool 2×2', c: C.cyan, dim: '64→128→256→512 channels', arrow: '↓ + skip₁,₂,₃,₄' },
        { l: 'Bottleneck — conv3×3 ×2', c: C.rose, dim: '1024 channels @ 28×28' },
        { l: 'Decoder × 4 — up-conv 2×2 + concat skip + conv3×3 ×2', c: C.amber, dim: 'mirrors encoder', arrow: '↑' },
        { l: 'Conv 1×1 — K output channels', c: C.emerald, dim: '(388×388, K-class softmax)' },
      ],
    },
    results: {
      intro: 'Won the ISBI 2015 EM Segmentation Challenge (best warping error) and both categories of the ISBI 2015 Cell Tracking Challenge by large margins — with no pre/post-processing.',
      tables: [
        {
          title: 'ISBI 2015 cell tracking — IoU', color: C.cyan,
          headers: ['Method', 'PhC-U373', 'DIC-HeLa'],
          rows: [
            { cells: ['IMCB-SG (2014)', '0.267', '0.294'] },
            { cells: ['KTH-SE (2014)', '0.795', '0.461'] },
            { cells: ['Second-best 2015', '0.830', '0.460'] },
            { cells: ['U-Net (this paper)', '0.920', '0.776'], hl: true },
          ],
        },
      ],
    },
    strengths: [
      'Works with tiny datasets (~30 imgs) via aggressive augmentation',
      'Skip connections — single most important segmentation idea of the 2010s',
      'End-to-end training, no post-processing tricks needed',
      'Seamless tiling for arbitrarily large images',
    ],
    weaknesses: [
      '2D only — needs the 3D extension for volumetric data',
      'Unpadded conv loses border pixels — input/output sizes mismatch',
      'Hand-crafted weight map for touching cells is dataset-specific',
      'Batch size = 1 (with momentum 0.99) is finicky to tune',
    ],
    relevance: "The DNA of every architecture in this Honours project — including the nnU-Net baseline and the U-Mamba target. The encoder-decoder + skip-connection skeleton from 2015 has held up remarkably and is the structural foundation for both the PSMA baseline (Kendrick 2022 via nnU-Net) and the proposed Mamba-based replacement.",
  },

  // ── 3. 3D U-Net — Çiçek et al. (2016) ─────────────────────────────────────
  {
    id: '3d-unet', label: '3D U-Net', venue: 'MICCAI 2016', year: 2016, color: C.rose,
    hero: {
      title: '3D U-Net',
      subtitle: 'Learning Dense Volumetric Segmentation from Sparse Annotation',
      authors: 'Çiçek · Abdulkadir · Lienkamp · Brox · Ronneberger — Freiburg, MICCAI 2016',
      tags: ['3D SEGMENTATION', 'VOLUMETRIC', 'SPARSE ANNOTATION', 'BATCH NORM', 'XENOPUS KIDNEY'],
    },
    tldr: 'Direct 3D extension of U-Net that learns dense volumetric segmentation from just a handful of sparsely annotated slices — replacing all 2D operations with 3D counterparts.',
    stats: [
      { val: '0.863', lbl: 'IoU semi-automated', sub: '3-fold CV, Xenopus kidney', color: C.rose },
      { val: '0.704', lbl: 'IoU fully-automated', sub: 'avg vs 0.547 for 2D baseline', color: C.cyan },
      { val: '19.07 M', lbl: 'Parameters', sub: '132×132×116 → 44×44×28 output', color: C.violet },
      { val: '~3 days', lbl: 'Training on TitanX', sub: '70 K iterations', color: C.amber },
    ],
    motivation: 'Volumetric biomedical data (CT, MRI, microscopy) is abundant but annotation is brutal — only 2D slices can be shown on screen, neighbours are nearly identical, full 3D labelling is impractical. The need: train on a handful of orthogonal sparse slices and densely segment the whole volume.',
    innovations: [
      { n: '01', title: 'All 2D Operations → 3D', desc: '3×3×3 convolutions, 2×2×2 max-pooling, 2×2×2 up-convolutions. Direct architectural translation of U-Net to volumetric. No new tricks — just commit to 3D end-to-end.', color: C.rose },
      { n: '02', title: 'Weighted Softmax Loss for Sparse Annotation', desc: 'Set the loss weight of unlabelled voxels (label 3) to ZERO. Network learns only from labelled voxels but generalises to the whole volume. Enables sparse-slice training.', color: C.cyan },
      { n: '03', title: 'Batch Normalisation Before Each ReLU', desc: 'BN at every layer for faster convergence. Batch size of 1 — use current-batch statistics also at test time. Stabilises tiny-batch volumetric training.', color: C.violet },
      { n: '04', title: 'On-the-Fly 3D Elastic Deformation', desc: 'Smooth dense deformation field via B-spline interpolation (σ=4 on a 32-voxel grid). Data and labels deformed together. Memory-efficient augmentation for 3D.', color: C.emerald },
      { n: '05', title: 'Avoid Bottlenecks via Pre-doubling Channels', desc: 'Channel count doubled BEFORE max-pooling (not after). Prevents information bottleneck and keeps representational capacity high through pooling.', color: C.amber },
    ],
    architecture: {
      summary: 'Same U-shape as 2D U-Net but with 3D everywhere. 4 analysis levels (3D conv ×2 + 3D maxpool), bottleneck, 4 synthesis levels (3D up-conv + concat + 3D conv ×2). Final 1×1×1 conv to K classes. Input tile 132×132×116, output 44×44×28.',
      sketch: [
        { l: 'Input 132×132×116 (3 ch)', c: C.cyan, dim: 'Tomato-Lectin + DAPI + β-Catenin' },
        { l: 'Analysis × 4 — conv3³ ×2 + maxpool2³', c: C.cyan, dim: '32→64→128→256 channels', arrow: '↓ + skip' },
        { l: 'Bottleneck — conv3³ ×2', c: C.rose, dim: '512 channels' },
        { l: 'Synthesis × 4 — up-conv2³ + concat + conv3³ ×2', c: C.amber, dim: 'mirrors analysis', arrow: '↑' },
        { l: 'Conv 1×1×1 — K classes', c: C.emerald, dim: '(44×44×28 output, K=3)' },
      ],
    },
    results: {
      intro: 'Tested on Xenopus kidney microscopy. The 3D-with-BN variant decisively beats both 2D and 3D-without-BN. Sparse-annotation training is viable from as few as 3 orthogonal slices per axis.',
      tables: [
        {
          title: 'Semi-automated 3-fold CV (IoU)', color: C.rose,
          headers: ['Test slices', '3D w/o BN', '3D + BN', '2D + BN'],
          rows: [
            { cells: ['Subset 1', '0.822', '0.855', '0.785'] },
            { cells: ['Subset 2', '0.857', '0.871', '0.820'] },
            { cells: ['Subset 3', '0.846', '0.863', '0.782'] },
            { cells: ['Average', '0.842', '0.863', '0.796'], hl: true },
          ],
        },
      ],
    },
    strengths: [
      'Native 3D context — exploits inter-slice information that 2D nets miss',
      'Sparse-annotation training — radically reduces labelling burden',
      'BN at batch-size-1 — pragmatic choice that just works',
      'End-to-end from scratch (no pre-trained 3D backbone needed)',
    ],
    weaknesses: [
      'Memory-hungry — limits tile size, hence receptive field',
      '19M parameters but small effective input field of view',
      'Tested only on one biological structure (Xenopus kidney)',
      'No formal long-range modelling beyond convolutional receptive field',
    ],
    relevance: 'The direct ancestor of every 3D PSMA segmentation network in this project — the nnU-Net cascade used by Kendrick (2022) is built on this 3D U-Net architecture, and the proposed Mamba alternative inherits the same encoder-decoder + skip-connection skeleton.',
  },

  // ── 4. Tversky Loss — Salehi, Erdogmus, Gholipour (2017) ──────────────────
  {
    id: 'tversky', label: 'Tversky Loss', venue: 'MLMI 2017', year: 2017, color: C.amber,
    hero: {
      title: 'Tversky Loss Function for Image Segmentation',
      subtitle: 'Using 3D Fully Convolutional Networks — asymmetric FP/FN weighting',
      authors: 'Salehi · Erdogmus · Gholipour — Boston Children\'s Hospital · MLMI 2017',
      tags: ['LOSS FUNCTION', 'CLASS IMBALANCE', 'LESION SEGMENTATION', 'F-BETA', 'FOCAL TVERSKY'],
    },
    tldr: 'A generalised Dice loss with separate weights α (FP) and β (FN). Pushing β > α biases training toward recall — and surprisingly improves DSC too, on imbalanced lesion segmentation.',
    stats: [
      { val: '56.4%', lbl: 'DSC at β = 0.7', sub: 'vs 53.4% for β = 0.5 (Dice)', color: C.amber },
      { val: '56.9%', lbl: 'Sensitivity at β = 0.7', sub: 'vs 49.9% Dice baseline', color: C.rose },
      { val: 'α + β = 1', lbl: 'F-β family', sub: 'subsumes Dice, Jaccard, F₂', color: C.violet },
      { val: '15 / 2', lbl: 'Subjects / fold-CV', sub: 'MS lesion MRI proof of concept', color: C.cyan },
    ],
    motivation: 'In lesion segmentation, non-lesion voxels outnumber lesion voxels by 500× or more. Cross-entropy predicts "no lesion" everywhere (high precision, terrible recall). Dice helps but treats FP and FN symmetrically — which is wrong for clinical practice, where missing a lesion is much worse than a false alarm.',
    innovations: [
      { n: '01', title: 'Generalised Tversky Index', desc: 'T(α, β) = TP / (TP + α·FP + β·FN). α and β are independent — controlling FP and FN penalty separately. Smooth and differentiable for backprop.', color: C.amber },
      { n: '02', title: 'Subsumes Dice / Jaccard / F-β', desc: 'α = β = 0.5 → Dice. α = β = 1 → Jaccard/Tanimoto. α + β = 1 → F-β family. One loss to rule them all (per dataset, anyway).', color: C.cyan },
      { n: '03', title: 'Recall-Biased Tuning (β > α)', desc: 'For clinical lesion detection, missing a lesion is far costlier than a false alarm. β > α explicitly amplifies the gradient through FN. Recommended start: α=0.3, β=0.7.', color: C.rose },
      { n: '04', title: 'Cross-Metric Improvement', desc: 'Surprising finding: a recall-biased loss improves DSC too (a symmetric metric). Authors attribute this to "improved generalisation" — escaping the trivial all-zero solution that Dice can fall into.', color: C.emerald },
      { n: '05', title: 'Drop-in Compatibility', desc: 'No architectural change required. Plug into any FCN/U-Net; just swap the loss. Single hyperparameter trade-off (β) is easy to sweep.', color: C.violet },
    ],
    architecture: {
      summary: 'Not an architecture — a loss function. The diagram below shows how it slots into a standard 3D segmentation pipeline. The only change is the loss block.',
      sketch: [
        { l: 'Multi-channel MRI (T1 + T2 + FLAIR)', c: C.cyan, dim: 'imbalanced input volume' },
        { l: '3D U-Net (any backbone)', c: C.rose, dim: 'unchanged segmentation network', arrow: '↓' },
        { l: 'Sigmoid → soft segmentation', c: C.violet, dim: 'p ∈ [0,1] per voxel', arrow: '↓' },
        { l: 'Tversky Loss  T(α, β)', c: C.amber, dim: 'α = 0.3, β = 0.7  recommended', arrow: '↑ backprop' },
        { l: 'TP / (TP + α·FP + β·FN)', c: C.emerald, dim: 'asymmetric class-imbalance loss' },
      ],
    },
    results: {
      intro: 'MS lesion segmentation on multi-channel MRI (T1, T2, FLAIR), 15 subjects, 2-fold CV. β = 0.7 wins on every metric. Pushing β to 0.9 keeps sensitivity climbing but collapses precision.',
      tables: [
        {
          title: 'Tversky β sweep on MS lesion MRI', color: C.amber,
          headers: ['β', 'DSC', 'Sensitivity', 'F₂', 'APR'],
          rows: [
            { cells: ['0.5  (= Dice)', '53.4%', '49.9%', '50.5%', '52.7%'] },
            { cells: ['0.6', '54.1%', '52.7%', '53.2%', '53.6%'] },
            { cells: ['0.7  (recommended)', '56.4%', '56.9%', '57.3%', '56.0%'], hl: true },
            { cells: ['0.8', '54.9%', '60.2%', '58.9%', '54.7%'] },
            { cells: ['0.9', '50.1%', '64.0%', '60.4%', '51.5%'] },
          ],
        },
      ],
    },
    strengths: [
      'Simple drop-in replacement for Dice loss',
      'Tunable for clinical FN-cost preference',
      'Aged extremely well — spawned Focal Tversky and asymmetric variants',
      'Counter-intuitive cross-metric gain (recall-biased loss → better DSC)',
    ],
    weaknesses: [
      'β must be tuned per dataset (no theory says β=0.7 generalises)',
      'Thin experimental base — 15 subjects, one dataset, one application',
      'Mechanism behind cross-metric gain is hand-wavy',
      'PR-curve variance across subjects exceeds variance across β values',
    ],
    relevance: "The most direct lever for raising the Honours project's 73% sensitivity. Kendrick (2022) explicitly cites Tversky-style loss as recommended future work for the PSMA baseline. Initial hyperparameter pick for the Honours implementation: α = 0.3, β = 0.7 — exactly the value recommended here.",
  },

  // ── 5. PSMA Pelvic Deep Net — Zhao et al. (2020) ──────────────────────────
  {
    id: 'zhao-psma', label: 'Zhao PSMA (Pelvic)', venue: 'EJNMMI 2020', year: 2020, color: C.emerald,
    hero: {
      title: 'Deep Neural Network for Automatic Characterization of Lesions on ⁶⁸Ga-PSMA-11 PET/CT',
      subtitle: 'Triple-combining 2.5D U-Net for pelvic mPCa lesion detection',
      authors: 'Zhao · Gafita · Vollnberg · Tetteh · Haupt · Afshar-Oromieh · Menze · Eiber · Rominger · Shi — EJNMMI 2020',
      tags: ['PSMA PET/CT', '2.5D ENSEMBLE', 'PELVIC mPCa', 'MULTI-CENTER', 'BONE+LN+LOCAL'],
    },
    tldr: 'First multi-center deep network for automated PSMA PET/CT lesion characterisation — a triple-plane 2.5D U-Net ensemble that mimics how radiologists scroll axial/coronal/sagittal views.',
    stats: [
      { val: '0.99', lbl: 'Bone lesion F1', sub: '99% / 99% / 99% P / R / F1', color: C.emerald },
      { val: '0.92', lbl: 'Lymph node F1', sub: '94% precision, 90% recall', color: C.cyan },
      { val: '0.69', lbl: 'Local lesion F1', sub: 'hardest class (n=127, low contrast)', color: C.rose },
      { val: '193', lbl: 'Patients · 3 centres', sub: 'TUM + Munich + Bern · 1,756 lesions', color: C.amber },
    ],
    motivation: '¹⁷⁷Lu-PSMA radioligand therapy (RLT) was suboptimal in ~30% of patients — better tumour-burden quantification is needed. RLT patients typically have many metastases, so manual segmentation is impractical at clinical scale. Prior automation (bone-PET-index) was bone-only.',
    innovations: [
      { n: '01', title: '2.5D Input — 3 Slices as Channels', desc: 'Each input is 6-channel: 3 consecutive slices × 2 modalities (PET + CT). The third dimension flows through channels rather than 3D convolutions. Massive memory savings vs 3D.', color: C.emerald },
      { n: '02', title: 'Triple-Plane Ensemble + Majority Voting', desc: 'Independent 2.5D U-Nets trained on axial, coronal, sagittal slicings. Outputs combined by per-voxel majority vote. Mimics how clinicians scroll all three orthogonal views.', color: C.cyan },
      { n: '03', title: 'Three Lesion Classes Simultaneously', desc: 'Bone / lymph node / local prostate. Multi-class Dice loss (insensitive to absolute background voxel count) handles the extreme imbalance directly.', color: C.violet },
      { n: '04', title: 'Detection via Connected Components', desc: 'Post-processing on the segmentation: connected-component analysis + volume filter (T_V = 25 mm³) + 10% GT-overlap detection criterion (T_E). Turns dense seg into clinical-style lesion detection.', color: C.amber },
      { n: '05', title: 'PET + CT Super-Additivity', desc: 'CT alone: <10% Dice. PET alone: ~50% Dice. PET + CT: 54–65% Dice. The joint signal exceeds the sum — CT provides anatomical context (where bones are) that disambiguates PET uptake.', color: C.rose },
    ],
    architecture: {
      summary: '6-channel (3 slices × 2 modalities) input → three 2.5D U-Nets (axial / coronal / sagittal) → per-voxel majority vote → 3-class segmentation → connected components + filters → lesion detections.',
      sketch: [
        { l: 'Input PET + CT volume', c: C.cyan, dim: 'pelvic ROI, 1×1×1 mm³' },
        { l: 'Axial 2.5D U-Net (6-ch input)', c: C.emerald, dim: 'axial voxel predictions', arrow: '↓' },
        { l: 'Coronal 2.5D U-Net', c: C.violet, dim: 'coronal voxel predictions', arrow: '↓' },
        { l: 'Sagittal 2.5D U-Net', c: C.rose, dim: 'sagittal voxel predictions', arrow: '↓' },
        { l: 'Majority voting (per voxel)', c: C.amber, dim: 'fusion of 3 view predictions', arrow: '↓' },
        { l: 'CC + volume filter + 10% overlap', c: C.cyan, dim: 'segmentation → lesion detection' },
      ],
    },
    results: {
      intro: 'Detection metrics on the held-out 63-patient test set, balanced across centres. Bone is near-perfect; lymph node very strong; local is clearly the hardest (only 127 examples, low contrast against healthy prostate).',
      tables: [
        {
          title: 'Detection F1 by lesion class', color: C.emerald,
          headers: ['Class', 'Precision', 'Recall', 'F1'],
          rows: [
            { cells: ['Bone', '0.99', '0.99', '0.99'], hl: true },
            { cells: ['Lymph node', '0.94', '0.90', '0.92'] },
            { cells: ['Local prostate', '0.79', '0.61', '0.69'] },
          ],
        },
        {
          title: 'Modality ablation (bone class)', color: C.cyan,
          headers: ['Modality', 'DSC', 'PPV', 'Specificity'],
          rows: [
            { cells: ['CT only', '< 10%', '< 10%', '~12%'] },
            { cells: ['PET only', '51.5%', '61.9%', '54.8%'] },
            { cells: ['PET + CT', '64.5%', '79.9%', '60.6%'], hl: true },
          ],
        },
      ],
    },
    strengths: [
      'Memory-efficient (2.5D over 3D) — can train on full slices, not small patches',
      'Triple-plane ensemble mimics clinician workflow — robust to view-specific features',
      'First multi-center PSMA study — addresses cross-scanner generalisation',
      'Clean detection pipeline via connected components + thresholds',
    ],
    weaknesses: [
      'Pelvic-only — does NOT address whole-body PSMA segmentation',
      'Local lesions only F1=69% (small training set, low PET contrast)',
      'Cross-fold variation high — cohort just large enough for stable training',
      'Manual ground truth itself is imperfect (inter-observer + PVE)',
    ],
    relevance: 'The pelvic precursor to the Honours baseline (Kendrick 2022 cites this as ref [31]). Establishes the >90% sensitivity ceiling for pelvic-only PSMA. Kendrick deliberately traded some pelvic sensitivity (73%) for whole-body coverage — and the Honours project aims to recover that sensitivity using Mamba.',
  },

  // ── 6. Vision Transformer — Dosovitskiy et al. (2021) ────────────────────
  {
    id: 'vit', label: 'Vision Transformer (ViT)', venue: 'ICLR 2021', year: 2021, color: C.violet,
    hero: {
      title: 'An Image is Worth 16×16 Words',
      subtitle: 'Transformers for Image Recognition at Scale',
      authors: 'Dosovitskiy et al. — Google Research, ICLR 2021',
      tags: ['TRANSFORMER', 'PATCH EMBEDDING', 'GLOBAL ATTENTION', 'SCALE WINS', 'NO CONV'],
    },
    tldr: 'A standard Transformer applied to flat 16×16 image patches matches or beats CNNs — proving scale + data can replace CNN inductive biases (locality, equivariance).',
    stats: [
      { val: '88.55%', lbl: 'ImageNet (ViT-H/14)', sub: 'pre-trained on JFT-300M', color: C.violet },
      { val: '4×', lbl: 'Less pre-training compute', sub: 'vs BiT-L, same accuracy', color: C.amber },
      { val: 'O(N²)', lbl: 'Self-attention cost', sub: 'in sequence length N', color: C.rose },
      { val: '86 M – 632 M', lbl: 'ViT-B / L / H params', sub: 'B/16, L/16, H/14', color: C.cyan },
    ],
    motivation: 'CNNs hard-code locality, translation equivariance, and 2D neighbourhood structure. Transformers conquered NLP without similar inductive biases — can they do the same for vision if given enough data? The bet: replace architecture priors with scale + data priors.',
    innovations: [
      { n: '01', title: 'Image as a Sequence of Patches', desc: 'Split image into N = HW/P² patches of P×P pixels (e.g. P=16). Flatten each, linearly project to D-dim. Treat the resulting sequence exactly like a sequence of word tokens.', color: C.violet },
      { n: '02', title: 'Learnable [class] Token + Position Embedding', desc: 'BERT-style: prepend a learnable [class] token whose final representation feeds an MLP head. Add learnable 1D position embeddings — which spontaneously develop 2D row/column structure during training.', color: C.cyan },
      { n: '03', title: 'Pure Transformer Encoder', desc: 'L stacked encoder layers, each = pre-norm + multi-head self-attention + residual + MLP (2-layer GELU) + residual. No image-specific machinery. Standard Transformer toolkit applies directly.', color: C.rose },
      { n: '04', title: 'Scale Beats Inductive Bias', desc: 'On ImageNet-only, ViT loses to ResNets. On ImageNet-21k, roughly tied. On JFT-300M, ViT wins decisively. The bet pays off only at scale — data substitutes for architectural priors.', color: C.amber },
      { n: '05', title: 'Compute-Efficient at Scale', desc: 'ViT-H/14 matches or beats BiT-L and Noisy Student with ~4× less pre-training compute. The compute/accuracy frontier favours Transformers as scale grows.', color: C.emerald },
    ],
    architecture: {
      summary: 'Patch → Linear projection → +PosEmbed → Transformer encoder × L → MLP head on [class] token → class prediction. Almost embarrassingly simple — that\'s the point.',
      sketch: [
        { l: 'Input image  H × W × 3', c: C.violet, dim: 'e.g. 224 × 224 × 3' },
        { l: 'Split into N = HW/P² patches', c: C.cyan, dim: 'e.g. 196 patches of 16×16', arrow: '↓' },
        { l: 'Linear projection → D dims', c: C.rose, dim: 'patch embedding via trainable E', arrow: '↓' },
        { l: 'Prepend [class] + position emb', c: C.amber, dim: '(N+1) × D sequence', arrow: '↓' },
        { l: 'Transformer encoder × L', c: C.emerald, dim: 'pre-norm + MSA + MLP + residual' },
        { l: 'MLP head on [class] token', c: C.violet, dim: 'K-class prediction' },
      ],
    },
    results: {
      intro: 'ViT-H/14 (pre-trained on JFT-300M) wins ImageNet, ImageNet-ReaL, CIFAR-100, Oxford-IIIT Pets, VTAB (19 tasks) at a fraction of the pre-training compute of BiT or Noisy Student.',
      tables: [
        {
          title: 'ViT vs CNN baselines at scale', color: C.violet,
          headers: ['Benchmark', 'ViT-H/14', 'BiT-L', 'Noisy Student'],
          rows: [
            { cells: ['ImageNet', '88.55', '87.54', '88.4'], hl: true },
            { cells: ['ImageNet-ReaL', '90.72', '90.54', '90.55'] },
            { cells: ['CIFAR-100', '94.55', '93.51', '—'] },
            { cells: ['Oxford-IIIT Pets', '97.56', '96.62', '—'] },
            { cells: ['TPUv3-core-days', '2.5 k', '9.9 k', '12.3 k'] },
          ],
        },
      ],
    },
    strengths: [
      'Scales beautifully — performance hasn\'t saturated within tested compute',
      'Transfers the whole Transformer toolkit (caching, MoE, SSL) to vision for free',
      'Spawned an entire research direction — DeiT, Swin, MAE, CLIP all descend from ViT',
      'Compute-efficient at scale (4× less than BiT for same accuracy)',
    ],
    weaknesses: [
      'Data-hungry — loses to ResNets on ImageNet alone',
      'O(N²) self-attention — infeasible for whole-body 3D volumes (millions of voxels)',
      'No native locality bias — must learn it from data',
      'Position embeddings are interpolated at fine-tuning — not a clean 2D solution',
    ],
    relevance: "The architecture whose quadratic cost MOTIVATES Mamba for whole-body PSMA. SwinUNETR (Transformer for 3D medical) is the strongest non-Mamba baseline — but it hits VRAM walls on whole-body PET volumes (SegMamba-V2 paper shows Transformers OOM at 128³). Linear-complexity SSMs (Mamba) are the response.",
  },

  // ── 7. nnU-Net — Isensee et al. (2021) ────────────────────────────────────
  {
    id: 'nnunet', label: 'nnU-Net', venue: 'Nature Methods 2021', year: 2021, color: C.cyan,
    hero: {
      title: 'nnU-Net',
      subtitle: 'A Self-Configuring Method for Deep Learning-Based Biomedical Image Segmentation',
      authors: 'Isensee · Jaeger · Kohl · Petersen · Maier-Hein — DKFZ Heidelberg, Nature Methods 2021',
      tags: ['SELF-CONFIGURING', 'AUTO-ML', '23 DATASETS', 'NO NEW NET', 'FOUNDATIONAL'],
    },
    tldr: '"No new net" — strong segmentation performance comes from systematic auto-configuration, not architectural novelty. Sets SOTA on 33 of 53 tasks across 23 datasets with zero manual tuning.',
    stats: [
      { val: '33 / 53', lbl: 'SOTA targets', sub: '11 international challenges', color: C.cyan },
      { val: '23', lbl: 'Datasets validated', sub: 'CT, MRI, EM, FM across organs', color: C.emerald },
      { val: '1000 × 250', lbl: 'Epochs × mini-batches', sub: 'SGD + Nesterov momentum 0.99', color: C.rose },
      { val: '5-fold CV', lbl: 'Always', sub: '2D / 3D / 3D-cascade auto-chosen', color: C.violet },
    ],
    motivation: 'Deep learning segmentation typically requires expert per-dataset tuning. Configurations from one dataset rarely transfer to another (modality, voxel spacing, image size, class ratio all vary). AutoML approaches need huge compute and large datasets. The need: an out-of-the-box tool that just works.',
    innovations: [
      { n: '01', title: 'Three-Tier Parameter Strategy', desc: '(1) FIXED params (robust common choices: SGD+Nesterov μ=0.99, Dice+CE loss, Poly LR, deep supervision). (2) RULE-BASED params (heuristic functions of dataset fingerprint). (3) EMPIRICAL params (ensemble selection, post-processing — learned from data).', color: C.cyan },
      { n: '02', title: 'Dataset Fingerprint → Pipeline Fingerprint', desc: 'Captures spacing distribution, median shape, intensity stats, modalities, class ratios. Heuristic rules map fingerprint → patch size, batch size, topology, target spacing, normalisation strategy.', color: C.rose },
      { n: '03', title: 'Auto Choice of 2D / 3D / 3D-Cascade', desc: 'Trains up to three configurations; selects best via 5-fold CV. Cascade triggered when full-res patch covers < 12.5% of median image — adds a low-res stage providing global context.', color: C.violet },
      { n: '04', title: 'Memory-Aware Patch + Topology Selection', desc: 'Initialise patch size = median image shape; iteratively reduce while adapting depth/kernels until network fits in GPU with batch ≥ 2. No GPU needed for configuration — memory estimated from feature-map sizes.', color: C.amber },
      { n: '05', title: 'Pipeline Beats Architecture (KiTS Analysis)', desc: 'On KiTS19 (100+ teams): all top-15 used 3D U-Net. Teams using the SAME architecture spanned the whole leaderboard. Pipeline choices (normalisation, patch size, LR) drove the variance, not the architecture.', color: C.emerald },
    ],
    architecture: {
      summary: 'Plain U-Net variants — no residual, dense, attention, dilated, or SE blocks. Instance norm + leaky ReLU + deep supervision. Initial 32 feature maps, doubled per downsample, capped at 320 (3D) / 512 (2D). The novelty is the configuration pipeline, not the network.',
      sketch: [
        { l: 'Training data', c: C.cyan, dim: 'any 2D/3D modality' },
        { l: 'Dataset Fingerprint', c: C.rose, dim: 'spacing, shape, intensity, modality, classes', arrow: '↓' },
        { l: 'Rule-based pipeline config', c: C.violet, dim: 'patch, batch, topology, normalisation', arrow: '↓' },
        { l: 'Train 2D + 3D + (3D-cascade)', c: C.amber, dim: '5-fold CV each', arrow: '↓' },
        { l: 'Empirical: ensemble + post-process', c: C.emerald, dim: 'connected-component suppression', arrow: '↓' },
        { l: 'Pipeline Fingerprint → Predictions', c: C.cyan, dim: 'traceable, reproducible' },
      ],
    },
    results: {
      intro: '11 international challenges, 23 datasets, 53 tasks — first place on 33. On the KiTS 2019 challenge (largest at MICCAI 2019), nnU-Net (submitted after the deadline) reset the leaderboard with a plain 3D U-Net.',
      tables: [
        {
          title: 'Selected challenge rankings (rank / total entries)', color: C.cyan,
          headers: ['Challenge', 'Dataset', 'Rank'],
          rows: [
            { cells: ['LiTS', 'Liver (D14)', '1 / 119'], hl: true },
            { cells: ['KiTS', 'Kidney + tumour (D17)', '1 / 342'], hl: true },
            { cells: ['BCV', '13 abdominal organs (D11)', '1 / 38–46'], hl: true },
            { cells: ['ACDC', 'Cardiac MRI (D13)', '1 / 9–10'] },
            { cells: ['CHAOS', 'MRI organs (D16)', '1 / 46'] },
            { cells: ['MSD', '10 tasks (D1–D10)', 'mostly 1–3'] },
          ],
        },
      ],
    },
    strengths: [
      'No expert tuning needed — out-of-the-box on any new task',
      'Generalises across modalities (CT/MRI/EM/FM) and organ scales',
      'Every decision is TRACEABLE to dataset properties (unlike black-box AutoML)',
      'Open source + pre-trained models published — used as the standard baseline',
    ],
    weaknesses: [
      'Optimised for Dice metric — domain-specific metrics may need adaptation',
      'Some dataset properties remain unconsidered (e.g., EM-specific preprocessing weak on CREMI)',
      'Plain U-Net only — does not benefit from later architectural advances (attention, Mamba)',
      'Massive training cost (1000 × 250 minibatches × 5 folds) — not exploration-friendly',
    ],
    relevance: 'THE baseline framework for the Honours project. The 79.9% lesion F1, 73% sensitivity, 94.5% patient-level accuracy in [[automatic-prognostic-biomarker]] all come from nnU-Net. The proposed Mamba architecture replaces nnU-Net\'s U-Net backbone — but inherits the same self-configuring preprocessing, training schedule, and evaluation pipeline.',
  },

  // ── 8. Kendrick PSMA — Automatic Prognostic Biomarker (2022) ──────────────
  {
    id: 'kendrick', label: 'Kendrick PSMA (Baseline)', venue: 'EJNMMI 2022', year: 2022, color: C.rose,
    hero: {
      title: 'Fully Automatic Prognostic Biomarker Extraction from Whole-Body PSMA-11 PET/CT',
      subtitle: 'nnU-Net 3D cascade for metastatic prostate cancer · the direct Honours baseline',
      authors: 'Kendrick · Francis · Hassan · Rowshanfarzad · Ong · Ebert — UWA & SCGH · EJNMMI 2022',
      tags: ['HONOURS BASELINE', 'WHOLE-BODY PSMA', 'nnU-Net CASCADE', 'mPCa', 'TLV/TLU'],
    },
    tldr: 'First fully-automated whole-body mPCa lesion segmentation pipeline (nnU-Net 3D cascade). Produces biomarkers (TLU, TLV) that stratify overall survival (p < 0.005) — and the 79.9% F1 / 73% sensitivity numbers the Honours project must beat.',
    stats: [
      { val: '94.5%', lbl: 'Patient-level accuracy', sub: '121 / 128 scans correctly classified', color: C.emerald },
      { val: '79.9%', lbl: 'Lesion F1 (BASELINE)', sub: 'PPV 88.2% · Sens 73.0%', color: C.rose },
      { val: '43.5%', lbl: 'Voxel-level DSC', sub: 'modest — small lesions, PVE-limited', color: C.amber },
      { val: 'p < 0.005', lbl: 'TLU survival stratification', sub: 'Spearman r = 0.95 vs manual', color: C.violet },
    ],
    motivation: 'PSMA PET/CT is now standard of care for biochemically recurrent prostate cancer, but manual whole-body lesion segmentation is impractical — labor-intensive, inter-observer-variable, and a prerequisite for radiomics. Prior automation (Zhao 2020 etc.) was pelvic-only. This study extends to whole-body.',
    innovations: [
      { n: '01', title: 'nnU-Net 3D Cascade — Two-Stage Refinement', desc: 'Stage 1 (low-res 5.22×5.22×2 mm) sees more spatial context; produces coarse segmentation. Stage 2 (full-res 4.07×4.07×2 mm) refines, with the upsampled coarse seg as a third input channel alongside PET + CT.', color: C.rose },
      { n: '02', title: 'Three-Level Evaluation Framework', desc: '(1) PATIENT-level classification (scan PSMA-positive vs negative). (2) LESION-level detection (≥10% volumetric overlap with GT). (3) VOXEL-level segmentation (DSC). Separates "did we find it?" from "did we outline it?"', color: C.cyan },
      { n: '03', title: 'PSMA-Negative Scans Test-Only', desc: 'Held all 53 PSMA-negative scans out of training to avoid polluting the loss with massively over-represented negatives. Test set: 75 positive + 53 negative. Patient-level split prevents data leakage.', color: C.violet },
      { n: '04', title: 'Within-Observer-Variability Validation', desc: 'On 28-scan inter-observer subset: auto DSC = 49.3% > observer 2 = 33.1% (p = 0.012). Auto PPV = 67.9% > observer 2 = 31.7% (p < 0.005). The model is BETTER than a second human on those metrics.', color: C.amber },
      { n: '05', title: 'Clinically Validated Biomarkers (TLU + TLV)', desc: 'Total lesional uptake (sum of SUVs over predicted mask) and total lesional volume — both fully automated. Correlate r ≈ 0.95 with manual. Both stratify OS at p < 0.005 (median split).', color: C.emerald },
    ],
    architecture: {
      summary: 'Two-stage 3D nnU-Net cascade. Both stages standard nnU-Net: instance norm + leaky ReLU + deep supervision + Dice + BCE loss. Cap at 320 feature maps. Trained 5-fold CV, 1000 epochs each, SGD μ=0.99, LR 0.01 poly decay.',
      sketch: [
        { l: 'PET + CT  (4.07×4.07×2 mm)', c: C.cyan, dim: 'whole-body input' },
        { l: 'CT → resample to PET grid (B-spline)', c: C.emerald, dim: 'spatial alignment', arrow: '↓' },
        { l: 'Stage 1 — low-res 3D nnU-Net', c: C.violet, dim: '5.22×5.22×2 mm · patch 80×80×224', arrow: '↓' },
        { l: 'Coarse seg upsampled', c: C.amber, dim: 'used as 3rd input channel', arrow: '↓' },
        { l: 'Stage 2 — full-res 3D nnU-Net', c: C.rose, dim: 'PET + CT + coarse · patch 96×96×256', arrow: '↓' },
        { l: 'Final whole-body segmentation', c: C.cyan, dim: '→ TLV / TLU biomarkers' },
      ],
    },
    results: {
      intro: '337 scans / 193 patients (single institution, SCGH Perth). Test set 128 scans (75 PSMA-positive + 53 negative). The 73% sensitivity is the bottleneck — and the direct target for the Honours project.',
      tables: [
        {
          title: 'Multi-level evaluation summary', color: C.rose,
          headers: ['Level', 'Metric', 'Value'],
          rows: [
            { cells: ['Patient', 'Accuracy', '94.5% (121/128)'], hl: true },
            { cells: ['Patient', 'PPV', '97.2%'] },
            { cells: ['Patient', 'Specificity', '96.2%'] },
            { cells: ['Lesion', 'PPV', '88.2% (224/254)'] },
            { cells: ['Lesion', 'Sensitivity', '73.0% (224/307)'], hl: true },
            { cells: ['Lesion', 'F1', '79.9%'], hl: true },
            { cells: ['Voxel', 'DSC', '43.5 ± 21.5%'] },
          ],
        },
        {
          title: 'Lesion-level sensitivity by sub-type', color: C.amber,
          headers: ['Lesion type', 'Sensitivity', 'Count'],
          rows: [
            { cells: ['Local prostate', '90.0%', '36/40'] },
            { cells: ['Distant nodal', '76.2%', '115/151'] },
            { cells: ['Regional nodal', '68.3%', '41/60'] },
            { cells: ['Osseous (bone)', '58.2%', '32/55'], hl: true },
            { cells: ['Visceral', '0%', '0/1'] },
          ],
        },
      ],
    },
    strengths: [
      'First whole-body PSMA segmentation (vs prior pelvic-only)',
      'Clinically validated — TLU/TLV biomarkers stratify OS (p < 0.005)',
      'WITHIN human inter-observer variability for DSC and PPV',
      'Three-level evaluation (patient + lesion + voxel) — separates detection from delineation',
    ],
    weaknesses: [
      'Lesion sensitivity 73% — too low; some metastases missed',
      'Bone lesion F1 only 58.2% — needs HU-aware preprocessing',
      'Single institution (SCGH Perth) — selection bias risk; multi-centre needed',
      'Voxel DSC 43.5% — modest, but partly intrinsic (see [[pve]])',
    ],
    relevance: 'THE direct baseline of the Honours project. Every metric on the OVERVIEW tab (79.9% F1, 88.2% PPV, 73% sensitivity, 94.5% patient accuracy) comes from this paper. The proposed Mamba architecture replaces the nnU-Net backbone in this pipeline. Same dataset (SCGH ~300 patients), same supervisors (Kendrick + Hassan), same evaluation framework. Beat 73% sensitivity → thesis.',
  },

  // ── 9. LRU / "Resurrecting RNNs" — Orvieto et al. (2023) ──────────────────
  {
    id: 'lru', label: 'Linear Recurrent Unit (LRU)', venue: 'ICML 2023', year: 2023, color: C.violet,
    hero: {
      title: 'Resurrecting Recurrent Neural Networks for Long Sequences',
      subtitle: 'Distilling state space models down to a minimum-viable Linear Recurrent Unit',
      authors: 'Orvieto · Smith · Gu · Fernando · Gulcehre · Pascanu · De — DeepMind, ICML 2023',
      tags: ['SSM THEORY', 'LRU', 'ABLATION STUDY', 'COMPLEX DIAGONAL', 'NO HIPPO'],
    },
    tldr: 'Distils S4/S5 down by ablating each ingredient — none of HiPPO, continuous-time, or Δ parameterisation is needed. Just linear recurrence + complex diagonal exponential + careful normalisation matches S4 on Long Range Arena.',
    stats: [
      { val: '5 steps', lbl: 'RNN → LRU', sub: 'each ingredient ablated separately', color: C.violet },
      { val: '~8×', lbl: 'Speedup from diagonalisation', sub: 'via parallel scans on complex λ', color: C.cyan },
      { val: '6 / 6', lbl: 'LRA tasks matched', sub: 'sCIFAR, ListOps, Text, Retrieval, Path, PathX', color: C.emerald },
      { val: '16 K', lbl: 'PathX max sequence', sub: 'cracked with restricted-phase init', color: C.amber },
    ],
    motivation: 'Deep SSMs (S4, S4D, S5) suddenly crushed Long Range Arena in 2021–22 with a lot of machinery — continuous-time formulation, HiPPO init, ZOH discretisation, Δ parameter sharing. Which of these actually matter? Strip them away one by one until you find the minimum needed for long-range modelling.',
    innovations: [
      { n: '01', title: 'Drop the Recurrent Nonlinearity', desc: 'Replace x_k = tanh(A x_{k-1} + B u_k) with x_k = A x_{k-1} + B u_k. Position-wise MLPs between layers supply enough nonlinearity. This step improves accuracy AND unlocks parallel scans.', color: C.violet },
      { n: '02', title: 'Diagonalise in the Complex Plane', desc: 'A dense linear RNN is reparameterised as Λ = diag(λ₁…λ_N) with complex eigenvalues. By Ginibre\'s circular law, Glorot-init dense matrices have eigenvalues ~uniform on the unit disk — so init λⱼ on the unit disk. ~8× speedup.', color: C.cyan },
      { n: '03', title: 'Stable Exponential Parameterisation', desc: 'λⱼ = exp(−exp(ν^log) + i·exp(θ^log)). Outer exp on magnitude guarantees |λⱼ| ≤ 1 (stability). Magnitude/phase decoupling makes Adam happy. Enables init close to the unit disk without training blow-up.', color: C.rose },
      { n: '04', title: 'γ Normalisation', desc: 'Eigenvalues near the unit disk cause forward-pass blow-up by ~1/(1−|λ|²). Fix: scale input projection per-eigendirection — γⱼ = √(1−|λⱼ|²). Proved via random-matrix-style calculation (Prop 3.3).', color: C.amber },
      { n: '05', title: 'Restricted Phase Init for Very Long Sequences', desc: 'For PathX (length 16 K), uniform phase init means most state components oscillate wildly. Restrict θ ∈ [0, π/10] biases toward learning global features. Final ingredient needed to crack PathX.', color: C.emerald },
    ],
    architecture: {
      summary: 'Pedagogical "minimum-viable SSM". Same block-level structure as S4/S5 (linear recurrence inside, MLP outside), but with a much simpler core. The diagram below shows the LRU recipe — each step ablates a piece of standard SSMs.',
      sketch: [
        { l: 'Vanilla tanh RNN', c: C.rose, dim: 'x_k = tanh(A x_{k-1} + B u_k)' },
        { l: '1. Drop nonlinearity', c: C.violet, dim: 'x_k = A x_{k-1} + B u_k', arrow: '↓' },
        { l: '2. Diagonalise (complex Λ)', c: C.cyan, dim: 'Λ = diag(λ₁…λ_N), λⱼ ∈ ℂ', arrow: '↓' },
        { l: '3. Exp parameterisation', c: C.amber, dim: 'λⱼ = exp(−e^ν + i·e^θ)', arrow: '↓' },
        { l: '4. γ normalisation', c: C.emerald, dim: 'γⱼ = √(1 − |λⱼ|²)', arrow: '↓' },
        { l: '5. Restricted phase init', c: C.rose, dim: 'θ ∈ [0, π/10]  (PathX only)' },
      ],
    },
    results: {
      intro: 'LRU matches S4/S4D/S5 across all six Long Range Arena tasks with essentially the same training speed. None of the SSM-specific machinery (HiPPO, continuous-time, ZOH discretisation, Δ parameter sharing) is needed.',
      tables: [
        {
          title: 'Long Range Arena — LRU vs S4 family', color: C.violet,
          headers: ['Task', 'S4 family', 'LRU', 'Outcome'],
          rows: [
            { cells: ['sCIFAR', '~91%', '~91%', 'Tied'] },
            { cells: ['ListOps', '~59%', '~60%', 'Tied'] },
            { cells: ['Text', '~89%', '~89%', 'Tied'] },
            { cells: ['Retrieval', '~91%', '~89%', 'Tied'] },
            { cells: ['PathFinder', '~94%', '~95%', 'Tied'] },
            { cells: ['PathX (16 K)', '~96%', '~94%', 'Tied (with phase init)'] },
          ],
        },
      ],
    },
    strengths: [
      'Clean pedagogical artifact — explains SSM success without HiPPO mystique',
      '"Drop nonlinearity" finding aged well — most modern SSMs are linear',
      '"HiPPO init isn\'t necessary" broadly accepted in the field',
      'Rigorous: each ingredient justified by experiment + theory',
    ],
    weaknesses: [
      'No input-dependent recurrence — pre-dates Mamba selection mechanism',
      'Limited absolute gain over S4/S5 — same accuracy, slightly simpler',
      'Pedagogical not productive — Mamba is what you actually use',
      'Doesn\'t address vision/3D — LRA tasks are all sequential',
    ],
    relevance: "Theoretical grounding for why Mamba's linear recurrence works for long sequences. Tells the Honours project that the SSM core can be simpler than HiPPO-based S4 — but the Mamba selection mechanism IS still needed (LRU doesn't have it). Useful for the literature-review framing of why SSMs matter for whole-body 3D segmentation.",
  },

  // ── 10. Mamba — Gu & Dao (2024) ───────────────────────────────────────────
  {
    id: 'mamba', label: 'Mamba (S6)', venue: 'arXiv 2024', year: 2024, color: C.emerald,
    hero: {
      title: 'Mamba',
      subtitle: 'Linear-Time Sequence Modeling with Selective State Spaces',
      authors: 'Albert Gu (CMU) · Tri Dao (Princeton) · arXiv 2312.00752',
      tags: ['SELECTIVE SSM', 'LINEAR COMPLEXITY', 'PARALLEL SCAN', 'CORE TECH', 'S6 LAYER'],
    },
    tldr: 'A new SSM with input-dependent selection (Δ, B, C are functions of input) + a hardware-aware parallel scan algorithm. Matches Transformer quality at 5× higher inference throughput with linear O(L) scaling.',
    stats: [
      { val: '5×', lbl: 'Inference throughput vs Transformer', sub: 'no KV cache → bigger batches', color: C.emerald },
      { val: 'O(L)', lbl: 'Linear scaling', sub: 'vs O(L²) for attention', color: C.cyan },
      { val: '+4 pts', lbl: 'Mamba-3B vs Pythia-3B avg', sub: 'common-sense reasoning, exceeds Pythia-7B', color: C.rose },
      { val: '1 M', lbl: 'Max sequence length', sub: 'DNA classification, 4000× train length', color: C.violet },
    ],
    motivation: 'Transformers scale O(L²) — infeasible for very long sequences (DNA, audio, whole-body 3D scans). Sub-quadratic alternatives (linear attention, gated conv, RNNs, plain SSMs) all under-perform on dense modalities like language because their parameters are CONSTANT across time. Need: time-varying parameters that enable content-based reasoning, but kept hardware-efficient.',
    innovations: [
      { n: '01', title: 'Selective SSM (S6 Layer)', desc: 'Make Δ, B, C input-dependent: Δ_t = softplus(W_Δ · x_t), B_t = W_B · x_t, C_t = W_C · x_t. A stays input-independent. Large Δ → reset state (forget); small Δ → preserve state. Generalises RNN gating (Theorem 1).', color: C.emerald },
      { n: '02', title: 'Hardware-Aware Parallel Scan', desc: 'Kernel fusion + parallel scan (Blelloch 1990) + recomputation. Load Δ, A, B, C from HBM → discretise in SRAM → scan in SRAM → multiply by C → write y back to HBM. 20–40× speedup vs naive scan.', color: C.cyan },
      { n: '03', title: 'Simplified Homogeneous Block', desc: 'No attention, no MLP. Mamba block = Linear(D→2E) → 1D conv → SiLU → S6 SSM → ⊗ gate → Linear(E→D). Two blocks ≈ params of one Transformer block (MHA + MLP). Stack with residuals + RMSNorm.', color: C.violet },
      { n: '04', title: 'Linear Complexity in Practice', desc: 'O(BLDN) FLOPs (lower constant than convolution\'s O(BLD log L)). Scales linearly with sequence length L. Crucial for whole-body 3D volumes where L ≈ millions of voxels.', color: C.amber },
      { n: '05', title: 'Generalises RNN Gating', desc: 'Setting N=1, A=-1, B=1 reduces selective SSM to h_t = (1 − σ(Wx_t)) h_{t-1} + σ(Wx_t) x_t — exactly the GRU/LSTM gate. Mamba is a strict generalisation of gated RNNs with state expansion + selective B, C.', color: C.rose },
    ],
    architecture: {
      summary: 'Stacked homogeneous Mamba blocks with residual + RMSNorm. Each block does: in_proj → conv1d (depthwise k=4) → SiLU → S6 SSM → out_proj. The S6 layer is where the selectivity lives — Δ, B, C all input-dependent.',
      sketch: [
        { l: 'Input (B, L, D)', c: C.emerald, dim: 'sequence of D-dim tokens' },
        { l: 'RMSNorm', c: C.cyan, dim: 'pre-norm residual stream', arrow: '↓' },
        { l: 'in_proj  Linear(D → 2E)', c: C.rose, dim: 'split → x (data) + z (gate)', arrow: '↓' },
        { l: 'Causal Conv1D (k=4, depthwise)', c: C.amber, dim: 'short local context', arrow: '↓' },
        { l: 'Selective Scan  (S6)', c: C.violet, dim: 'INPUT-DEP Δ, B, C · fixed A · parallel scan' },
        { l: '⊗ gate by SiLU(z) + out_proj', c: C.emerald, dim: 'project E → D + residual' },
      ],
    },
    results: {
      intro: 'SOTA on language modelling (Pile, LAMBADA), audio generation (SC09), and DNA modelling (HG38, Great Apes 1M-length classification) — all with the same architecture.',
      tables: [
        {
          title: 'Zero-shot language modelling (selected)', color: C.emerald,
          headers: ['Model', 'Params', 'LAMBADA acc', 'Avg (6 tasks)'],
          rows: [
            { cells: ['Pythia-2.8B', '2.8 B', '64.7', '59.1'] },
            { cells: ['RWKV-3B', '3.0 B', '63.9', '59.6'] },
            { cells: ['Mamba-2.8B', '2.8 B', '69.2', '63.3'], hl: true },
            { cells: ['Pythia-6.9B', '6.9 B', '67.1', '61.7'] },
            { cells: ['RWKV-7.4B', '7.4 B', '67.2', '62.5'] },
          ],
        },
      ],
    },
    strengths: [
      'Linear complexity makes arbitrarily long sequences feasible',
      'High inference throughput (no KV cache → bigger inference batches)',
      'Generalises gated RNNs (LSTM/GRU) as a special case',
      'Scales to massive sequences (1M tokens, 4000× training length)',
    ],
    weaknesses: [
      "Selectivity HURTS smooth continuous signals (audio waveforms) — LTI S4 better there",
      'Untested at > 3 B params at time of writing — unknown if scaling holds',
      'Recurrence less parallel than attention (chunked scan helps but not free)',
      '1D scanning by default — needs adaptation for 3D (orthogonal-plane scans, etc.)',
    ],
    relevance: "The CORE technology being applied in the Honours project. Mamba\'s linear complexity is what makes whole-body 3D PSMA segmentation feasible — Transformers OOM on these volumes. The selection mechanism is the mechanism by which the model can selectively amplify weak lesion signals over high-intensity background — directly targeting the 73% sensitivity bottleneck.",
  },

  // ── 11. U-Mamba — Ma, Li, Wang (2024) ─────────────────────────────────────
  {
    id: 'u-mamba', label: 'U-Mamba', venue: 'arXiv 2024', year: 2024, color: C.violet,
    hero: {
      title: 'U-Mamba',
      subtitle: 'Enhancing Long-Range Dependency for Biomedical Image Segmentation',
      authors: 'Jun Ma · Feifei Li · Bo Wang — UHN · University of Toronto · Vector Institute',
      tags: ['HYBRID CNN-MAMBA', 'MEDICAL SEGMENTATION', 'nnU-Net BACKBONE', 'FIRST MEDICAL MAMBA', '3D'],
    },
    tldr: 'First hybrid CNN-Mamba architecture for medical image segmentation. Integrates Mamba blocks into nnU-Net\'s encoder with linear complexity — beats nnU-Net, SegResNet, UNETR, SwinUNETR across 4 diverse datasets.',
    stats: [
      { val: '0.8683', lbl: 'Abdomen CT DSC (Bot)', sub: 'beats nnU-Net 0.8615', color: C.violet },
      { val: '0.8501', lbl: 'Abdomen MRI DSC (Enc)', sub: 'beats nnU-Net 0.8309', color: C.rose },
      { val: '4', lbl: 'Diverse datasets', sub: '3D CT, 3D MRI, 2D endoscopy, microscopy', color: C.emerald },
      { val: '1', lbl: 'A100 GPU', sub: '1000 epochs from scratch', color: C.amber },
    ],
    motivation: 'CNNs have inherent locality — limited long-range modelling. Transformers have O(L²) cost — prohibitive for 3D medical volumes. Need a hybrid: CNN for local features, Mamba SSM for long-range context, with linear complexity AND nnU-Net-style self-configuring auto-adaptation.',
    innovations: [
      { n: '01', title: 'CNN + Mamba Hybrid Block', desc: 'Each encoder block: 2× residual conv (conv + IN + leaky ReLU) → flatten 3D → 1D sequence → LayerNorm → in_proj → conv1d + SiLU → SSM ⊗ gate → out_proj → reshape back to 3D. Local conv features + global Mamba context.', color: C.violet },
      { n: '02', title: 'Two Variants — Bot vs Enc', desc: 'U-Mamba_Bot: Mamba block only at the bottleneck (cheaper, captures deep global context). U-Mamba_Enc: Mamba blocks in EVERY encoder stage (more expressive, slightly slower). Different datasets favour different variants.', color: C.cyan },
      { n: '03', title: 'Self-Configuring via nnU-Net', desc: 'Built on the nnU-Net framework — inherits automatic patch size, batch size, topology, target spacing, and 5-fold CV. No per-dataset tuning needed. Plug-in Mamba upgrade for nnU-Net.', color: C.rose },
      { n: '04', title: 'Flatten 3D → 1D for SSM', desc: 'Spatial features (B, C, H, W, D) → flatten + transpose → (B, L=HWD, C) → run SSM → reshape back. Simple but loses some spatial structure (motivating SegMamba\'s tri-directional scan).', color: C.amber },
      { n: '05', title: 'Linear Scaling in Feature Size', desc: 'Replaces Transformer\'s quadratic self-attention with Mamba\'s linear scan. Enables larger 3D patches within the same VRAM budget — directly relevant to whole-body PET\'s memory constraints.', color: C.emerald },
    ],
    architecture: {
      summary: 'U-Mamba_Enc shown: 4 encoder stages each containing a U-Mamba block, bottleneck U-Mamba, 4 decoder stages with residual blocks + transposed conv. Skip connections everywhere. Built on nnU-Net framework for auto-config.',
      sketch: [
        { l: 'Input volume (B, C, H, W, D)', c: C.cyan, dim: 'auto-configured patch size' },
        { l: 'U-Mamba block × 4', c: C.violet, dim: 'conv res + flatten → SSM → reshape', arrow: '↓ + skip₁,₂,₃,₄' },
        { l: 'Bottleneck — U-Mamba block', c: C.rose, dim: 'deep global context' },
        { l: 'Residual blocks + transposed conv × 4', c: C.amber, dim: 'standard nnU-Net decoder', arrow: '↑' },
        { l: 'Conv 1×1×1 + Softmax', c: C.emerald, dim: 'final segmentation map' },
      ],
    },
    results: {
      intro: 'U-Mamba beats nnU-Net, SegResNet, UNETR, SwinUNETR across all 4 datasets. U-Mamba_Bot wins on CT (bottleneck is enough); U-Mamba_Enc wins on MRI and 2D tasks (encoder-wide Mamba helps).',
      tables: [
        {
          title: '3D organ segmentation — DSC (best of two variants bolded)', color: C.violet,
          headers: ['Method', 'CT DSC', 'CT NSD', 'MRI DSC', 'MRI NSD'],
          rows: [
            { cells: ['nnU-Net', '0.8615', '0.8972', '0.8309', '0.8996'] },
            { cells: ['SegResNet', '0.7927', '0.8257', '0.8146', '0.8841'] },
            { cells: ['UNETR', '0.6824', '0.7004', '0.6867', '0.7440'] },
            { cells: ['SwinUNETR', '0.7594', '0.7663', '0.7565', '0.8218'] },
            { cells: ['U-Mamba_Bot', '0.8683', '0.9049', '0.8453', '0.9121'], hl: true },
            { cells: ['U-Mamba_Enc', '0.8638', '0.8980', '0.8501', '0.9171'], hl: true },
          ],
        },
      ],
    },
    strengths: [
      'First medical Mamba — opened the floodgates (SegMamba, SegResMamba followed)',
      'Inherits nnU-Net auto-config — no per-dataset tuning',
      'Linear complexity — bigger patches within same VRAM',
      'Two variants for compute/quality trade-off (Bot cheaper, Enc better)',
    ],
    weaknesses: [
      'Single 1D scan direction — loses spatial structure on flatten',
      'No multi-directional / orthogonal-plane scanning',
      'Mamba only in encoder — decoder is plain conv (no symmetric global context)',
      'Transformer baselines (UNETR/SwinUNETR) underperformed — possibly due to train-from-scratch setting',
    ],
    relevance: 'Direct architectural template for the Honours project. U-Mamba already shows that a CNN-Mamba hybrid beats nnU-Net (the PSMA baseline) on multiple medical datasets. The Honours work extends this to whole-body PSMA + adds the 6-directional / tri-orthogonal scanning that SegMamba-V2 and SegResMamba developed.',
  },

  // ── 12. SegMamba-V2 — Xing et al. (2026) ──────────────────────────────────
  {
    id: 'seg-mamba-v2', label: 'SegMamba-V2', venue: 'IEEE TMI 2026', year: 2026, color: C.amber,
    hero: {
      title: 'SegMamba-V2',
      subtitle: 'Long-Range Sequential Modeling Mamba for General 3D Medical Image Segmentation',
      authors: 'Xing · Ye · Yang · Cai · Gai · Wu · Gao · Zhu — HKUST · Sun Yat-sen Univ. · IEEE TMI 2026',
      tags: ['TRI-ORTHO MAMBA', 'HIERARCHICAL DOWNSAMPLING', 'CRC-2000 DATASET', 'SOTA 3D MEDICAL', 'EFFICIENT'],
    },
    tldr: 'Four-stage hybrid Convolution-Mamba with Tri-orientated Ortho Mamba (Coronal + Sagittal + Axial scans) and parallel multi-kernel hierarchical downsampling — sets SOTA on BraTS, AbdomenAtlas, AIIB, and the new CRC-2000.',
    stats: [
      { val: '91.60%', lbl: 'BraTS2023 avg Dice', sub: 'beats SegMamba 91.32% + SwinUNETR-V2 89.39%', color: C.amber },
      { val: '88.84%', lbl: 'AIIB23 airway IoU', sub: 'beats U-Mamba 88.60%, SegMamba 88.59%', color: C.cyan },
      { val: '13.3 GB', lbl: 'Training memory', sub: 'vs 34 GB SwinUNETR, OOM for Transformer', color: C.emerald },
      { val: '2000', lbl: 'CRC-2000 dataset volumes', sub: 'new fine-grained colorectal cancer dataset', color: C.rose },
    ],
    motivation: '1D Mamba scans capture global context in one direction — but 3D medical volumes have rich anatomical info across all three orthogonal planes (axial, coronal, sagittal). Single-direction scanning misses cross-axis dependencies. Need: full 3D long-range coverage at Mamba\'s efficiency.',
    innovations: [
      { n: '01', title: 'Tri-orientated Ortho Mamba (ToOM)', desc: 'Extends Tri-oriented Mamba from one plane to THREE orthogonal planes — ToM-Coronal + ToM-Sagittal + ToM-Axial, summed. Within each plane: forward + reverse + cross-group scans. Captures full 3D long-range structure.', color: C.amber },
      { n: '02', title: 'Hierarchical Scale Downsampling (HSDownsampling)', desc: 'Three parallel CNN downsampling branches with kernel sizes 5×5×5, 3×3×3, 2×2×2 — wide receptive field + medium + local retention. Fused by 1×1×1 conv. Expands receptive field while preserving fine info.', color: C.cyan },
      { n: '03', title: 'Gated Spatial Convolution (GSC)', desc: 'Before each Mamba layer: GSC = z + Conv3³(Conv3³(z) · Conv1³(z)). Multiplicative gate captures spatial relationships BEFORE flattening to 1D (which loses spatial info).', color: C.violet },
      { n: '04', title: '4-Stage Hybrid Architecture', desc: 'Bottom 2 stages (high-res, detailed info): depthwise convolution blocks. Top 2 stages (low-res, semantic info): TSMamba blocks. Mamba on top of high-res features is inefficient — only use it where it earns its cost.', color: C.rose },
      { n: '05', title: 'Feature-level Uncertainty Estimation (FUE)', desc: 'Compute uncertainty map u = -z̄·log(z̄) on channel-mean of each encoder skip. Output is z + z·(1-u) — boosts confident features along skip connections, dampens uncertain ones.', color: C.emerald },
    ],
    architecture: {
      summary: '4-stage encoder (HSDownsampling + DWConv at stages 1-2, HSDownsampling + TSMamba at stages 3-4). Decoder with transposed convs + FUE-enhanced skip connections. TSMamba block = GSC → ToOM → MLP with residuals.',
      sketch: [
        { l: 'Input volume (D × H × W)', c: C.cyan, dim: '128³ training crop' },
        { l: 'HSDownsampling × 4 (5³+3³+2³ parallel)', c: C.violet, dim: 'multi-kernel parallel branches', arrow: '↓' },
        { l: 'Stages 1–2 — DWConv blocks', c: C.rose, dim: 'high-res, detailed features' },
        { l: 'Stages 3–4 — TSMamba (GSC + ToOM + MLP)', c: C.amber, dim: 'low-res, semantic + global', arrow: '↓' },
        { l: 'FUE-enhanced skip connections', c: C.emerald, dim: 'uncertainty-weighted features', arrow: '↑' },
        { l: 'Decoder + Seg head', c: C.cyan, dim: 'final 3D segmentation' },
      ],
    },
    results: {
      intro: 'SOTA on BraTS2023, AbdomenAtlas-1.0, AIIB2023 (airway), and the new CRC-2000. Also the most memory-efficient global-modelling method tested — Transformer OOMs at 128³, SwinUNETR uses 34 GB, SegMamba-V2 uses 13.3 GB.',
      tables: [
        {
          title: 'BraTS2023 — average Dice (↑)', color: C.amber,
          headers: ['Method', 'Dice-WT', 'Dice-TC', 'Dice-ET', 'Avg'],
          rows: [
            { cells: ['nnU-Net', '93.50', '91.20', '86.70', '90.46'] },
            { cells: ['SwinUNETR-V2', '93.35', '89.65', '85.17', '89.39'] },
            { cells: ['U-Mamba-Bot', '93.67', '91.96', '87.26', '90.96'] },
            { cells: ['SegMamba (V1)', '93.61', '92.65', '87.71', '91.32'] },
            { cells: ['SegMamba-V2', '94.02', '92.83', '87.93', '91.60'], hl: true },
          ],
        },
        {
          title: 'Efficiency — global modelling modules (128³ input)', color: C.emerald,
          headers: ['Method', 'Train mem', 'Infer mem', 'Infer time'],
          rows: [
            { cells: ['UX-Net (large conv)', '18.9 GB', '5.8 GB', '1.02 s'] },
            { cells: ['SwinUNETR', '34.0 GB', '9.5 GB', '1.68 s'] },
            { cells: ['Pure Transformer', 'OOM', '—', '—'] },
            { cells: ['TSMamba (V1)', '18.0 GB', '6.3 GB', '1.51 s'] },
            { cells: ['SegMamba-V2', '13.3 GB', '6.1 GB', '1.38 s'], hl: true },
          ],
        },
      ],
    },
    strengths: [
      'Full 3D coverage via three orthogonal-plane Mamba scans',
      'Multi-kernel parallel downsampling — receptive field without info loss',
      'Best memory efficiency among global-modelling methods (Transformer OOMs)',
      'New CRC-2000 dataset (4× larger than CRC-500) — major benchmark contribution',
    ],
    weaknesses: [
      'Complex block design — many sub-components (GSC + ToOM + HSDown + FUE)',
      'Mamba slower than conv on high-res stages (hence the hybrid stage split)',
      'Ablation gains modest (+0.1–0.5%) per module — most benefit from ToOM (+1.27%)',
      'Sum-fusion vs linear-fusion not clearly better (dataset-dependent)',
    ],
    relevance: 'Strong architectural alternative for the Honours project. The tri-orthogonal scan directly addresses the limitation of U-Mamba\'s single-direction 1D flatten. ToOM is a plausible replacement for the 6-directional scan in the proposed PSMA architecture — and at 13.3 GB training memory, it would comfortably fit on the SCGH HPC hardware.',
  },
];

// ─── Strengths / Limitations side-by-side ─────────────────────────────────────
function StrengthsWeaknesses({ strengths, weaknesses }) {
  return (
    <div className="ho-sw-grid">
      <div className="ho-sw-col ho-sw-col--good">
        <p className="ho-sw-h" style={{ color: C.emerald }}>✓ STRENGTHS</p>
        <ul className="ho-sw-list">
          {strengths.map((s, i) => (
            <li key={i} className="ho-sw-item">
              <span className="ho-sw-bullet" style={{ color: C.emerald }}>+</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="ho-sw-col ho-sw-col--bad">
        <p className="ho-sw-h" style={{ color: C.rose }}>✗ LIMITATIONS</p>
        <ul className="ho-sw-list">
          {weaknesses.map((w, i) => (
            <li key={i} className="ho-sw-item">
              <span className="ho-sw-bullet" style={{ color: C.rose }}>−</span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Uniform paper renderer ─────────────────────────────────────────────────
function PaperRenderer({ paper }) {
  return (
    <div>
      {/* Hero */}
      <div
        className="ho-paper-hero"
        style={{
          borderColor: `${paper.color}40`,
          background: `linear-gradient(135deg, ${paper.color}15 0%, ${paper.color}05 100%)`,
        }}
      >
        <span
          className="ho-paper-venue"
          style={{ color: paper.color, borderColor: `${paper.color}50`, background: `${paper.color}1a` }}
        >
          {paper.venue}
        </span>
        <h2 className="ho-paper-title">{paper.hero.title}</h2>
        <p className="ho-paper-subtitle">{paper.hero.subtitle}</p>
        <p className="ho-paper-authors">{paper.hero.authors}</p>
        <div className="ho-tags" style={{ marginTop: '0.75rem' }}>
          {paper.hero.tags.map(t => <span key={t} className="ho-tag">{t}</span>)}
        </div>
      </div>

      {/* TL;DR */}
      <SH color={paper.color}>TL;DR</SH>
      <InfoBox color={paper.color}>{paper.tldr}</InfoBox>

      {/* Headline numbers */}
      {paper.stats && (
        <>
          <SH color={C.amber}>Headline Numbers</SH>
          <div className="ho-stat-grid">
            {paper.stats.map(s => (
              <div key={s.lbl} className="ho-stat-card" style={{ borderColor: s.color }}>
                <p className="ho-stat-val" style={{ color: s.color }}>{s.val}</p>
                <p className="ho-stat-lbl">{s.lbl}</p>
                <p className="ho-stat-sub">{s.sub}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Motivation */}
      <SH color={C.violet}>Motivation</SH>
      <InfoBox color={C.violet}>{paper.motivation}</InfoBox>

      {/* Key innovations */}
      <SH color={C.cyan}>Key Innovations</SH>
      <div className="ho-aims">
        {paper.innovations.map(i => (
          <div key={i.n} className="ho-aim">
            <span className="ho-aim-num" style={{ color: i.color }}>{i.n}</span>
            <div>
              <p className="ho-aim-title">{i.title}</p>
              <p className="ho-aim-desc">{i.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Architecture sketch */}
      {paper.architecture && (
        <>
          <SH color={C.emerald}>Architecture at a Glance</SH>
          <InfoBox color={C.emerald}>{paper.architecture.summary}</InfoBox>
          <div className="ho-card">
            <p className="ho-card-h" style={{ color: C.emerald }}>// Data flow</p>
            <div className="ho-arch-sketch">
              {paper.architecture.sketch.map((r, i) => (
                <div key={i} className="ho-sketch-row">
                  {r.arrow && <span className="ho-sketch-arrow">{r.arrow}</span>}
                  <div className="ho-sketch-box" style={{ borderColor: r.c }}>
                    <span className="ho-sketch-lbl" style={{ color: r.c }}>{r.l}</span>
                    <span className="ho-sketch-dim">{r.dim}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Results */}
      {paper.results && (
        <>
          <SH color={C.amber}>Key Results</SH>
          {paper.results.intro && <InfoBox color={C.amber}>{paper.results.intro}</InfoBox>}
          {paper.results.tables && paper.results.tables.map((tbl, i) => (
            <div key={i} className="ho-card">
              <p className="ho-card-h" style={{ color: tbl.color || C.amber }}>// {tbl.title}</p>
              <table className="ho-table">
                <thead>
                  <tr>{tbl.headers.map((h, k) => <th key={k}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {tbl.rows.map((r, j) => (
                    <tr key={j} style={r.hl ? { background: `${tbl.color || C.amber}14` } : {}}>
                      {r.cells.map((c, k) => (
                        <td
                          key={k}
                          className={k === 0 ? 'ho-td-key' : ''}
                          style={r.hl ? { color: tbl.color || C.amber, fontWeight: k === 0 ? 700 : 600 } : {}}
                        >
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}

      {/* Strengths & Limitations */}
      <SH color={C.emerald}>Strengths &amp; Limitations</SH>
      <StrengthsWeaknesses strengths={paper.strengths} weaknesses={paper.weaknesses} />

      {/* Relevance */}
      <SH color={paper.color}>Relevance to PSMA Honours</SH>
      <InfoBox color={paper.color}>{paper.relevance}</InfoBox>
    </div>
  );
}

// ─── Paper picker grid ──────────────────────────────────────────────────────
function PaperPicker({ papers, current, onSelect }) {
  return (
    <div className="ho-paper-picker">
      {papers.map(p => (
        <button
          key={p.id}
          className={`ho-paper-pick${current === p.id ? ' ho-paper-pick--on' : ''}`}
          style={{ '--pick-color': p.color }}
          onClick={() => onSelect(p.id)}
        >
          <span className="ho-paper-pick-year">{p.year}</span>
          <span className="ho-paper-pick-label">{p.label}</span>
          <span className="ho-paper-pick-venue">{p.venue}</span>
          {p.deepDive && <span className="ho-paper-pick-badge">DEEP DIVE</span>}
        </button>
      ))}
    </div>
  );
}

function TabResearchPapers() {
  // SegResMamba has its own interactive deep-dive view; all other papers use the uniform PaperRenderer
  const PICKER_PAPERS = [
    ...PAPERS_DATA.map(p => ({ id: p.id, label: p.label, venue: p.venue, year: p.year, color: p.color })),
    { id: 'seg-res-mamba', label: 'SegResMamba', venue: 'MIDL 2025', year: 2025, color: C.violet, deepDive: true },
  ].sort((a, b) => a.year - b.year);

  const [paper, setPaper] = useState('kendrick'); // start on the direct Honours baseline
  const selected = PAPERS_DATA.find(p => p.id === paper);

  return (
    <div>
      <SH color={C.violet}>Research Papers — Literature Review</SH>
      <InfoBox color={C.violet}>
        <strong>13 papers</strong> reviewed for the Honours research program — from foundational <strong>U-Net (2015)</strong> through the
        full <strong>Mamba</strong> lineage (Mamba, U-Mamba, SegResMamba, SegMamba-V2) to the latest 3D medical SOTA <strong>SegMamba-V2 (2026)</strong>.
        Each card gives an at-a-glance breakdown of <strong>motivation</strong>, <strong>key innovations</strong>, <strong>architecture</strong>,
        <strong> results</strong>, <strong>strengths &amp; limitations</strong>, and direct <strong>relevance to PSMA</strong>. Sorted chronologically — start with
        Kendrick (the direct baseline) or any tile below.
      </InfoBox>

      <PaperPicker papers={PICKER_PAPERS} current={paper} onSelect={setPaper} />

      {paper === 'seg-res-mamba' && <PaperSegResMamba />}
      {selected && <PaperRenderer paper={selected} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const TABS = ['OVERVIEW', 'ARCHITECTURE', '3D ADAPTATION', 'DATA PIPELINE', 'IMPLEMENTATION', 'ROADMAP', 'RESEARCH PAPERS'];

export default function Honours() {
  const [tab, setTab] = useState('OVERVIEW');
  const navigate = useNavigate();

  return (
    <div className="ho-root">
      {/* Sticky header */}
      <header className="ho-header">
        <div className="ho-header-inner">
          <div className="ho-header-top">
            <button className="ho-back" onClick={() => navigate('/hub')}>← HUB</button>
            <div className="ho-htitle">
              <span className="ho-hcode">CITS4010</span>
              <span className="ho-hname">Honours Research — Mamba PSMA Segmentation</span>
            </div>
          </div>
          <div className="ho-tabs">
            {TABS.map(t => (
              <button
                key={t}
                className={`ho-tab${tab === t ? ' ho-tab--on' : ''}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="ho-main">
        {tab === 'OVERVIEW'         && <TabOverview />}
        {tab === 'ARCHITECTURE'     && <TabArchitecture />}
        {tab === '3D ADAPTATION'    && <TabAdaptation />}
        {tab === 'DATA PIPELINE'    && <TabPipeline />}
        {tab === 'IMPLEMENTATION'   && <TabImplementation />}
        {tab === 'ROADMAP'          && <TabRoadmap />}
        {tab === 'RESEARCH PAPERS'  && <TabResearchPapers />}
      </main>
    </div>
  );
}
