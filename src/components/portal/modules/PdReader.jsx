import { useState, Fragment } from 'react';
import Icon from '../icons';

/* ============================================================================
   PD READER — pupillary-distance-from-a-face-scan  (Personal section)
   ----------------------------------------------------------------------------
   A build/train plan for a custom AI model that reads pupillary distance (PD)
   accurately enough to dispense prescription lenses from a single self-captured
   face scan — for Safestyle (prescription safety eyewear). This is a PLANNING
   DELIVERABLE: it documents the most-accurate achievable approach and the order
   to build in, not the work itself.

   Self-contained (the constants below are the source of truth) and rendered with
   the portal's Reading Room tokens via the shared .pt-* / .syl-* plan-document
   classes (same language as the Portara Business Plan tab), plus a small,
   token-driven .pdr-* block in portal.css for the comparison tables + pipeline
   flow. No new pattern — it themes for free with every portal palette.
   ========================================================================== */

const HEAD = {
  tag: 'Safestyle · AI R&D',
  title: 'PD Reader — pupillary distance from a face scan',
  thesis:
    'A custom model that reads a user’s pupillary distance from a single self-captured face scan, ' +
    'accurately enough to dispense prescription lenses without an in-store pupillometer. The hard part ' +
    'is not finding the eyes — it’s establishing real-world scale and correcting head pose. The plan ' +
    'prioritises the most accurate achievable solution, not the easiest.',
  phase: 'Plan · pre-build',
};

const SIGNALS = [
  { value: '≤ ±1.0 mm', label: 'target PD error (MAE)', accent: true },
  { value: '478', label: 'MediaPipe landmarks (with iris)' },
  { value: '~11.7 mm', label: 'iris HVID — the built-in ruler' },
  { value: '~63 mm', label: 'average adult PD (54–74)' },
];

const VIEWS = ['Overview', 'Scale Reference', 'Landmarks', 'Data', 'Model & Training', 'Pipeline & Edge Cases', 'Roadmap'];

// ── Overview ─────────────────────────────────────────────────────────────────
const PRINCIPLES = [
  'Optical dispensing needs mm-level truth — treat ±0.5 mm as the goal and ±1.0 mm as the ceiling; a wrong PD decentres the lens and induces unwanted prism.',
  'Never trust a photo’s pixels as absolute — every measurement is gated on a known real-world scale reference in the same plane as the eyes.',
  'Pupil centre ≈ iris centre — locate the iris precisely and PD falls out of geometry; the hard problems are scale and head pose, not detecting the eyes.',
  'Correct head pose before measuring — yaw/pitch foreshorten the inter-pupil vector, roll rotates it. Frontalise or reject.',
  'Measure many frames, return one number with a confidence — abstain and re-prompt rather than hand back a bad PD.',
  'Ship classical geometry first; add a learned correction only where it beats geometry on held-out pupillometer data.',
];

// ── Scale reference — the crux of PD accuracy ────────────────────────────────
const SCALE_HEAD = ['Reference', 'Basis / real size', 'Best accuracy', 'Friction', 'Scale-error / spoof risk'];
const SCALE_ROWS = [
  ['Credit / ID card', 'ISO/IEC 7810 ID-1 · 85.60 × 53.98 mm', '±0.5–1 mm', 'Low — everyone has one', 'Med — held off the eye plane (parallax); a non-ID-1 card silently breaks scale'],
  ['Printed fiducial', 'ArUco / AprilTag, known edge (e.g. 40 mm)', '±0.3–0.7 mm', 'Med — needs a printer', 'Low — detector rejects wrong/distorted markers; pose recovered directly'],
  ['Iris diameter', 'HVID biometric constant ~11.7 mm (±0.5)', '±0.7–1.5 mm', 'None — no object', 'Low spoof, but ±0.5 mm population variance floors accuracy'],
  ['Depth sensor', 'TrueDepth / LiDAR / stereo — metric depth', '±0.3–0.6 mm', 'None on supported phones', 'Low — true metric scale, no held object; device-gated'],
  ['Coin / ruler', 'Country-specific coin / printed ruler', '±1–2 mm', 'Low–Med', 'High — coin size varies by country; easy to use the wrong one'],
];

const SCALE_TRADEOFF = {
  name: 'Hold a reference object  vs  reference-free (iris / depth)',
  lacks:
    'A held card is universal but sits off the eye plane, so perspective and a mis-sized card quietly corrupt scale — and the user can’t see the error.',
  edge:
    'Prefer the iris (HVID ~11.7 mm) as an always-present, in-plane ruler, and the phone depth sensor where available for true metric scale. Keep the ISO card as a universal fallback, validated by its aspect ratio.',
};

// ── Landmark detection ───────────────────────────────────────────────────────
const LM_HEAD = ['Detector', 'Iris landmarks?', 'Pupil-centre basis', 'In-browser', 'Verdict'];
const LM_ROWS = [
  ['MediaPipe Face Mesh', 'Yes — 5/iris, 478 total', 'Iris-centre landmark, sub-pixel', 'Yes (WASM/JS)', 'Recommended — pupil centres AND iris diameter for scale, one model'],
  ['dlib 68-point', 'No', 'Eye-corner centroid (coarse)', 'No (native)', 'Legacy — no iris, pupil guessed from lids, less accurate'],
  ['MTCNN / RetinaFace', 'No — 5 keypoints', 'Eye-centre keypoint (coarse)', 'Partial', 'Great for detection, too coarse for PD on its own'],
  ['Apple ARKit / ML Kit', 'Partial — eye transforms', 'Eye contours + depth', 'No (native SDK)', 'Strong on-device + depth, but platform-locked'],
  ['Classical (Haar + Hough)', 'n/a', 'Hough circle on the iris', 'Yes (OpenCV.js)', 'Brittle to lighting/glasses — fallback cross-check only'],
];

const LM_REC =
  'MediaPipe Face Mesh with refined iris landmarks is the spine: one model yields both pupil centres ' +
  '(iris centre) and the iris diameter that doubles as the scale ruler, and it runs client-side so scans ' +
  'never leave the device. Layer a learned sub-pixel refinement on the iris crop where accuracy demands it.';

// ── Data strategy ────────────────────────────────────────────────────────────
const DATA = [
  { name: 'Ground-truth PD (gold standard)', tag: 'labels', hot: true,
    body: 'Measure each subject with a calibrated digital pupillometer (±0.5 mm) — distance + near PD and monocular L/R. This is the label everything trains and validates against.' },
  { name: 'Paired capture protocol', tag: 'collection',
    body: 'Per subject: phone selfies with each scale reference (card, printed fiducial) at 2–3 distances and head poses, plus a depth-sensor capture where available. Log camera intrinsics.' },
  { name: 'Volume & coverage', tag: 'sizing',
    body: 'A few thousand labelled subjects suffices for a correction head on frozen landmarks (not an end-to-end CNN). Stratify by ethnicity / iris colour, age (incl. children — smaller PD), and eyewear.' },
  { name: 'Synthetic augmentation', tag: 'pre-train',
    body: 'Render 3D head scans with known PD and known camera params for large volumes with perfect ground truth and controllable pose/lighting/glasses. Pre-train on synthetic, calibrate on real.' },
  { name: 'Image augmentation', tag: 'robustness',
    body: 'Yaw/pitch/roll, distance, exposure/white-balance, motion blur, JPEG, occlusion, and glasses/reflection overlays so the model survives real capture conditions.' },
];

const DATA_HYGIENE = [
  'Bootstrap weak labels from reference-object geometry to grow the set, but keep a pupillometer-measured hold-out for honest evaluation.',
  'De-duplicate by subject across splits — never let the same face leak train → test.',
  'Consent + on-device processing by default; face scans are biometric data — store only what’s needed.',
  'Track per-subgroup error from day one so accuracy gaps (dark irises, children, glasses) are visible, not averaged away.',
];

// ── Model & training ─────────────────────────────────────────────────────────
const MODEL = [
  { name: 'Two-stage hybrid (recommended)', tag: 'architecture', hot: true,
    body: 'Frozen MediaPipe landmarks → a lightweight regression head. Interpretable, and needs far less data than an end-to-end image→PD network.' },
  { name: 'Inputs', tag: 'io',
    body: 'Iris-centre coordinates (both eyes), iris diameters, eye-crop pixels, head-pose angles (yaw/pitch/roll), and the scale factor (mm/px) from the chosen reference.' },
  { name: 'Outputs', tag: 'io',
    body: 'Distance PD, monocular L & R, near PD, plus a per-scan uncertainty (σ) so the app can abstain and re-prompt when confidence is low.' },
  { name: 'Loss', tag: 'training',
    body: 'Huber / L1 in millimetres (robust to label noise) + a consistency term (L + R ≈ total PD) + heteroscedastic NLL for calibrated uncertainty.' },
  { name: 'Evaluation', tag: 'metrics',
    body: 'MAE (mm), % within ±0.5 / ±1.0 mm, signed bias, and error sliced by head pose, distance, iris colour, and glasses on/off — against the pupillometer hold-out.' },
];

const MODEL_WHY =
  'An end-to-end CNN from image → PD needs far more data and hides its failure modes. Freezing a proven ' +
  'landmark model and learning only the corrections — sub-pixel pupil, pose foreshortening, reference-plane ' +
  'depth — concentrates the data budget where geometry alone falls short, and every stage stays inspectable.';

// ── Pipeline & edge cases ────────────────────────────────────────────────────
const PIPELINE = [
  'Guided capture',
  'Landmark detection',
  'Iris pupil centres',
  'Scale calibration',
  'Pose correction & PD',
  'Multi-frame + confidence',
];

const EDGE = [
  { name: 'Head tilt (roll / yaw / pitch)', tag: 'geometry', hot: true,
    body: 'Roll rotates the eye line; yaw/pitch foreshorten the inter-pupil vector. Estimate pose from landmarks, frontalise, and reject scans beyond a yaw/pitch threshold.' },
  { name: 'Camera distance & perspective', tag: 'optics',
    body: 'Close cameras add perspective distortion and reference-plane parallax. Standardise capture distance, keep the reference in the eye plane, and prefer depth-sensor scale when present.' },
  { name: 'Glasses on', tag: 'occlusion',
    body: 'Frames and lens reflections occlude the iris and shift apparent centres. Detect eyewear, prompt removal for the measurement, and reject frames with speculars over the iris.' },
  { name: 'Lighting', tag: 'capture',
    body: 'Low light and harsh shadows degrade iris detection and sub-pixel centring. Gate on exposure/contrast, guide the user to even light, and average over good frames.' },
  { name: 'Capture-quality gate', tag: 'capture',
    body: 'Reject blink, off-centre gaze, motion blur and one-eye occlusion; require both irises visible and stable across N frames before returning a result.' },
];

// ── Roadmap ──────────────────────────────────────────────────────────────────
const PHASES = [
  { label: 'Phase 0 · MVP (± ~1.5 mm)', state: 'now',
    body: 'MediaPipe iris in-browser + iris-diameter scale (ISO card fallback), classical geometry, a single good frame and a simple capture guide. Proves the flow end-to-end and gives a working demo.' },
  { label: 'Phase 1 · Accuracy (± ~1.0 mm)', state: 'next',
    body: 'Multi-frame averaging, head-pose correction, quality gating, and a learned correction head trained on pupillometer labels. Add monocular + near PD and a per-scan confidence.' },
  { label: 'Phase 2 · Best-in-class (≤ ±0.5 mm)', state: 'later',
    body: 'Depth-sensor path (TrueDepth/LiDAR), synthetic-data pre-training, calibrated uncertainty, and per-subgroup validation against pupillometer ground truth — a dispensing-grade sign-off.' },
];

const ACTIONS = [
  'Access to a calibrated digital pupillometer + a small consented capture cohort for ground-truth labels.',
  'Decide the primary capture surface — iOS unlocks TrueDepth depth; web maximises reach.',
  'Sign off a biometric-data policy (on-device processing, consent, retention) before collecting faces.',
  'Agree the dispensing acceptance bar with the optical team — the mm tolerance the lens lab will accept.',
];

/* ── Presentational helpers (mirror PortaraBusinessPlan / SyllabiteGTM) ──────── */
function Northstar({ kicker, accent, children }) {
  return (
    <div className="pt-card syl-northstar">
      <span className={`syl-kicker${accent ? ' syl-kicker--accent' : ''}`}>{kicker}</span>
      <p>{children}</p>
    </div>
  );
}
function BulletCard({ kicker, accent, items }) {
  return (
    <div className="pt-card syl-guardrails">
      <span className={`syl-kicker${accent ? ' syl-kicker--accent' : ''}`}>{kicker}</span>
      <ul className="syl-guardrails__list">
        {items.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </div>
  );
}
function FeatureList({ items }) {
  return (
    <div className="syl-features">
      {items.map((f, i) => (
        <div key={f.name} className={`pt-card syl-feature${f.hot ? ' syl-feature--hot' : ''}`}>
          <span className="syl-feature__n">{String(i + 1).padStart(2, '0')}</span>
          <div className="syl-feature__body">
            <div className="syl-feature__top">
              <h5 className="syl-feature__name">{f.name}</h5>
              <span className="syl-tag">{f.tag}</span>
            </div>
            <p className="syl-feature__text">{f.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
function Tradeoff({ t }) {
  return (
    <div className="syl-rivals">
      <div className="pt-card syl-rival">
        <h5 className="syl-rival__name">{t.name}</h5>
        <p className="syl-rival__line syl-rival__line--lacks">{t.lacks}</p>
        <p className="syl-rival__line syl-rival__line--edge">
          <Icon name="arrowRight" size={14} className="syl-rival__arrow" />
          {t.edge}
        </p>
      </div>
    </div>
  );
}
// PD-Reader-specific widgets: a comparison table + the pipeline flow strip.
function CompareTable({ head, rows }) {
  return (
    <div className="pdr-tablewrap">
      <table className="pdr-table">
        <thead>
          <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Flow({ steps }) {
  return (
    <div className="pdr-flow">
      {steps.map((s, i) => (
        <Fragment key={s}>
          <div className="pdr-flow__step">
            <span className="pdr-flow__n">{String(i + 1).padStart(2, '0')}</span>
            <span className="pdr-flow__label">{s}</span>
          </div>
          {i < steps.length - 1 && (
            <span className="pdr-flow__arrow"><Icon name="arrowRight" size={14} /></span>
          )}
        </Fragment>
      ))}
    </div>
  );
}

export default function PdReader() {
  const [view, setView] = useState('Overview');

  return (
    <div className="pt-module syl">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="pt-card syl-head">
        <div className="syl-head__meta">
          <p className="syl-head__tag">{HEAD.tag}</p>
          <h3 className="syl-head__title">{HEAD.title}</h3>
          <p className="syl-head__thesis">{HEAD.thesis}</p>
        </div>
        <div className="syl-head__phase">
          <span className="syl-head__phase-label">Status</span>
          <span className="syl-phasechip">{HEAD.phase}</span>
        </div>
      </header>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="syl-seg" role="tablist" aria-label="PD Reader plan sections">
        {VIEWS.map((v) => (
          <button key={v} role="tab" aria-selected={v === view}
                  className={`syl-seg__tab${v === view ? ' syl-seg__tab--active' : ''}`}
                  onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ────────────────────────────────────────────────────── */}
      {view === 'Overview' && (
        <div className="syl-panel" role="tabpanel">
          <div className="syl-signals">
            {SIGNALS.map((s) => (
              <div key={s.label} className={`pt-card syl-signal${s.accent ? ' syl-signal--accent' : ''}`}>
                <span className="syl-signal__v">{s.value}</span>
                <span className="syl-signal__l">{s.label}</span>
              </div>
            ))}
          </div>
          <Northstar kicker="The goal" accent>
            Read a user’s <strong>distance PD</strong> (plus monocular L/R and near PD) from a single
            self-captured face scan, accurately enough to dispense prescription lenses without an in-store
            pupillometer. Success = agreement with a pupillometer within <strong>±1.0 mm</strong>, ideally ±0.5 mm.
          </Northstar>
          <Northstar kicker="What “accurate” means">
            PD is the distance between pupil centres in millimetres. Report <strong>distance PD</strong> (default),
            <strong> monocular PD</strong> (each pupil to the nasal bridge — needed for progressive / high-index
            lenses) and <strong>near PD</strong> (converged, ~3–4 mm less). Accuracy is mean absolute error vs a
            calibrated pupillometer <em>and</em> the % of scans within ±0.5 / ±1.0 mm — not just an average, since a
            2 mm tail still ruins a lens.
          </Northstar>
          <BulletCard kicker="Design principles" items={PRINCIPLES} />
        </div>
      )}

      {/* ── SCALE REFERENCE ─────────────────────────────────────────────── */}
      {view === 'Scale Reference' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            A photo has no absolute scale — you recover millimetres from pixels only via a known real-world
            reference at the eye plane. This choice, more than landmark accuracy, sets the error floor.
          </p>
          <CompareTable head={SCALE_HEAD} rows={SCALE_ROWS} />
          <div>
            <span className="syl-kicker">The trade-off</span>
            <Tradeoff t={SCALE_TRADEOFF} />
          </div>
          <Northstar kicker="The call" accent>
            Default to a <strong>layered scale</strong>: depth sensor if present → else iris diameter (in-plane,
            zero friction) → else the ISO card as a universal fallback. Cross-check whichever two are available and
            flag any disagreement &gt; 1 mm as low-confidence.
          </Northstar>
        </div>
      )}

      {/* ── LANDMARKS ───────────────────────────────────────────────────── */}
      {view === 'Landmarks' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            The pupil centre is well-approximated by the iris centre, so the detector’s job is to locate both
            irises precisely (and, ideally, hand back the iris diameter for scale).
          </p>
          <CompareTable head={LM_HEAD} rows={LM_ROWS} />
          <Northstar kicker="The call" accent>{LM_REC}</Northstar>
        </div>
      )}

      {/* ── DATA ────────────────────────────────────────────────────────── */}
      {view === 'Data' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            The scarce, valuable asset is pupillometer-measured ground truth paired with real capture conditions.
            Synthetic data supplies volume; real data calibrates and validates.
          </p>
          <FeatureList items={DATA} />
          <BulletCard kicker="Labelling & data hygiene" items={DATA_HYGIENE} />
        </div>
      )}

      {/* ── MODEL & TRAINING ────────────────────────────────────────────── */}
      {view === 'Model & Training' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            A hybrid: a frozen, proven landmark model does perception; a small learned head does calibrated
            correction and outputs PD with an uncertainty it can act on.
          </p>
          <FeatureList items={MODEL} />
          <Northstar kicker="Why hybrid, not end-to-end">{MODEL_WHY}</Northstar>
        </div>
      )}

      {/* ── PIPELINE & EDGE CASES ───────────────────────────────────────── */}
      {view === 'Pipeline & Edge Cases' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            End-to-end flow, from capture to a PD number with a confidence. Below-threshold scans re-prompt rather
            than return a value.
          </p>
          <div className="pt-card syl-monet">
            <span className="syl-kicker syl-kicker--accent">The pipeline</span>
            <Flow steps={PIPELINE} />
          </div>
          <div>
            <span className="syl-kicker">Edge cases &amp; how each is handled</span>
            <FeatureList items={EDGE} />
          </div>
        </div>
      )}

      {/* ── ROADMAP ─────────────────────────────────────────────────────── */}
      {view === 'Roadmap' && (
        <div className="syl-panel" role="tabpanel">
          <p className="syl-intro">
            Three phases, each raising the accuracy bar — a working demo first, then dispensing-grade precision.
          </p>
          <div className="syl-phases">
            {PHASES.map((p) => (
              <div key={p.label} className={`pt-card syl-phase syl-phase--${p.state}`}>
                <span className="syl-phase__marker" />
                <div>
                  <h5 className="syl-phase__label">{p.label}</h5>
                  <p className="syl-phase__body">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
          <BulletCard kicker="Requires a decision / resource (not build work)" accent items={ACTIONS} />
        </div>
      )}
    </div>
  );
}
