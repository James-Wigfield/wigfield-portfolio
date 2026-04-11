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
//  ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const TABS = ['OVERVIEW', 'ARCHITECTURE', '3D ADAPTATION', 'DATA PIPELINE', 'IMPLEMENTATION', 'ROADMAP'];

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
        {tab === 'OVERVIEW'       && <TabOverview />}
        {tab === 'ARCHITECTURE'   && <TabArchitecture />}
        {tab === '3D ADAPTATION'  && <TabAdaptation />}
        {tab === 'DATA PIPELINE'  && <TabPipeline />}
        {tab === 'IMPLEMENTATION' && <TabImplementation />}
        {tab === 'ROADMAP'        && <TabRoadmap />}
      </main>
    </div>
  );
}
