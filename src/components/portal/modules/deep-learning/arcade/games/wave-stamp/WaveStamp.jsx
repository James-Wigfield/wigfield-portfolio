import { useEffect, useId, useMemo, useState } from 'react';
import manifest from './index.js';
import { useRound } from '../../kit/useRound';
import { RoundShell, Prompt, Feedback } from '../../kit/RoundShell';
import { Keypad, ShapePad } from '../../kit/Keypad';
import { Choice } from '../../kit/Choice';
import { Maths, MLine, MEq } from '../../kit/Maths';
import { Why } from '../../kit/WhyText';
import { Tex, Code } from '../../../kit';
import { rng } from '../../core/rng';
import { makeItems } from '../../maths/waveStamp';
import { COPY } from '../../content/wave-stamp';
import { EQUATIONS, CODE } from '../../content/lecture8';
import { cellFill } from '../../../lecture8-study/svgFill';
import './wave-stamp.css';

/* ============================================================================
   WAVE STAMP (Lecture 8 slides 31–36, 44–47) — positional-encoding barcodes
   ----------------------------------------------------------------------------
   Each position p has one barcode: the row P[p, ·] of slide 32's matrix,
   inked in the L8 position colour (negative values in slate).
   Level 1  match a stamp to its position (rack face up, then face down),
            P[0, i], sine or cosine with its exponent, the angle inside
            P[p, i], P[p, 0 or 1]; why sinusoids (slides 31–33)
   Level 2  slide 32's base 1000 vs slide 35's 10_000: twin racks, which
            angle is larger, the code's i = 2·arange trick, the code's
            angle, pos_emb / call() shapes, slide 36's addition
   Level 3  bonus stage, ViT (slide 46): 768, the pipeline, the patch
            count for this page's own image sizes (beyond), data hunger,
            visual attention (44–45), slide 47's exam note
   Items: maths/waveStamp.js · copy: content/wave-stamp.js.
   ========================================================================== */
const INTRO = { line: COPY.intro, controls: COPY.controls };
const fmtAns = (a, it) => (it.format ? it.format(a) : String(a));
const f2 = (x) => (Math.abs(x) < 0.005 ? '0.00' : x.toFixed(2)).replace('-', '−');
const CODE_TEXT = Object.fromEntries(CODE.map((c) => [c.id, c.text]));
const CODE_SLIDE = Object.fromEntries(CODE.map((c) => [c.id, `slide ${c.src.slides.join(', ')}`]));

export default function WaveStamp({ seed, level, mode, durationMs, onRoundEnd, host }) {
  const items = useMemo(() => makeItems(rng(seed), level), [seed, level]);
  const round = useRound({ gameId: manifest.id, seed, level, mode, durationMs, onRoundEnd, items });
  const item = round.current;
  return (
    <RoundShell game={manifest} round={round} host={host} intro={INTRO} stageClass="dla-ws">
      {item && <ItemStage key={item.id} item={item} round={round} />}
    </RoundShell>
  );
}

function ItemStage({ item, round }) {
  const live = !round.feedback && round.state === 'play';
  const shown = !!round.feedback;
  const [value, setValue] = useState('');
  const [shape, setShape] = useState(() => (item.kind === 'shape' ? item.answer.map(() => '') : []));
  const [order, setOrder] = useState(() => (item.order ? item.order.start.slice() : []));

  // ordering keys: 1–5 move a card up, Enter submits
  useEffect(() => {
    if (!live || !item.order) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= order.length) { e.preventDefault(); setOrder((o) => moveUp(o, n - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); round.submit(order); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const choices = useMemo(() => (item.choices ?? []).map((c) => ({
    value: c.value,
    label: String(c.label).includes('$') ? <Why text={c.label} /> : c.label,
    aria: c.plain ?? c.label,
  })), [item]);

  const kicker = `${round.index + 1} / ${round.total}${item.beyond ? ` · ${COPY.beyond}` : ''}${item.notExamined ? ` · ${COPY.notExamined}` : ''}`;
  const submitNumber = () => { if (value !== '' && value !== '-' && value !== '.') round.submit(Number(value)); };

  return (
    <>
      <div className="dla-floor dla-ws__floor">
        <Picture item={item} shown={shown} />
      </div>
      <div className="dla-stagegrid">
        <div className="dla-ws__ask">
          <Prompt k={kicker}>
            {String(item.question).includes('$') ? <Why text={item.question} /> : item.question}
          </Prompt>
          <Feedback feedback={round.feedback} format={fmtAns} />
          {item.kind === 'choice' && (
            <Choice choices={choices} onPick={(v) => round.submit(v)} picked={shown ? round.feedback.given : null} answer={shown ? item.answer : null} active={live} columns={choices.length === 2 || choices.every((c) => String(c.aria).length <= 12) ? 2 : 1} label="Answers" />
          )}
          {item.order && (
            <OrderCards steps={item.order.steps} order={order} onMove={(k) => live && setOrder((o) => moveUp(o, k))} onSubmit={() => live && round.submit(order)} disabled={!live} />
          )}
          <MathsDrawer item={item} />
        </div>
        {item.kind === 'number' && (
          <Keypad value={value} onChange={setValue} onSubmit={submitNumber} decimal={!!item.decimal} negative={!!item.negative} disabled={!live} active={live} label="Your answer" />
        )}
        {item.kind === 'shape' && (
          <ShapePad value={shape} onChange={setShape} onSubmit={() => round.submit(shape.map(Number))} labels={['axis 0', 'axis 1', 'axis 2']} disabled={!live} active={live} ariaLabel="Shape" />
        )}
      </div>
      {item.stage?.own && <p className="dla-own">{COPY.ownImage}</p>}
    </>
  );
}

const moveUp = (o, k) => (k <= 0 ? o : [...o.slice(0, k - 1), o[k], o[k - 1], ...o.slice(k + 1)]);

function MathsDrawer({ item }) {
  const m = item.maths;
  if (!m) return null;
  const eq = m.eq ? EQUATIONS[m.eq] : null;
  const st = item.stage;
  const numbers = st?.type === 'match' ? st.row : null;
  return (
    <Maths>
      {eq && eq.tex.map((t) => <MEq key={t} tex={t} />)}
      {eq && <MLine text={`Slide ${eq.src.slides.join(', ')}${m.eq === 'posencCode' ? COPY.codeAsMaths : ''}.`} />}
      {m.lines.map((l) => <MLine key={l} text={l} />)}
      {numbers && <MLine text={`The stamp’s numbers: ${numbers.map((v, i) => `$\\mathbf{P}_{?,${i}} = ${(Math.abs(v) < 0.005 ? 0 : v).toFixed(2)}$`).join(', ')}.`} />}
    </Maths>
  );
}

/* ── the pictures ────────────────────────────────────────────────────── */
function Picture({ item, shown }) {
  const st = item.stage;
  switch (st?.type) {
    case 'match': return <MatchPic st={st} shown={shown} />;
    case 'stamp': return <StampPic st={st} shown={shown} />;
    case 'pair': return <PairPic st={st} shown={shown} />;
    case 'twin': return <TwinPic st={st} shown={shown} />;
    case 'wall': return <WallPic st={st} />;
    case 'code': return <CodePic st={st} shown={shown} />;
    case 'formula': return <FormulaPic />;
    case 'patches': return <PatchPic st={st} shown={shown} />;
    case 'caption': return <CaptionPic st={st} shown={shown} />;
    default: return null;
  }
}

/* one barcode: d cells in a row (inked = filled by value) */
function Bars({ x, y, row, d, cw, ch, target = null, inked = true, reveal = false, className = '' }) {
  return (
    <g className={`dla-ws__bars ${className}`} transform={`translate(${x} ${y})`}>
      {Array.from({ length: d }, (_, k) => {
        const v = row ? row[k] : null;
        const isT = k === target;
        const fill = inked && v !== null ? cellFill('pos', v, 1) : undefined;
        return (
          <g key={k}>
            <rect
              className={`dla-ws__cell${inked && v !== null ? '' : ' dla-ws__cell--blank'}${isT ? ' dla-ws__cell--target' : ''}`}
              x={k * cw + 1} y={1} width={cw - 2} height={ch - 2} rx={3}
              style={fill ? { fill } : undefined}
            />
            {isT && !reveal && ch >= 18 && <text x={k * cw + cw / 2} y={ch / 2 + 5} textAnchor="middle" className="dla-t dla-t--b dla-ws__q">?</text>}
            {isT && reveal && v !== null && ch >= 18 && <text x={k * cw + cw / 2} y={ch / 2 + 4} textAnchor="middle" className="dla-t dla-t--xs dla-halo">{f2(v)}</text>}
          </g>
        );
      })}
    </g>
  );
}

function ColLabels({ x, y, d, cw, target = null }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {Array.from({ length: d }, (_, k) => (
        <text key={k} x={k * cw + cw / 2} y={0} textAnchor="middle" className={`dla-t dla-t--xs dla-t--m${k === target ? ' dla-ws__tl' : ''}`}>{k}</text>
      ))}
    </g>
  );
}

function MatchPic({ st, shown }) {
  const { d, rack, row, p, faceUp } = st;
  const cw = 40;
  const lx = 64;
  const W = lx + d * cw + 8;
  const rh = 19;
  const rackY = 128;
  const H = rackY + rack.length * rh + 6;
  const label = `The stamp: a barcode of ${d} components for an unknown position. The rack below holds positions 0 to ${rack.length - 1}${faceUp || shown ? '' : ', face down'}.`;
  return (
    <svg className="dl8s-svg dla-ws__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ maxWidth: W * 1.25 }}>
      <text x={lx} y={12} className="dla-t dla-t--xs dla-t--m">{COPY.stampLabel}</text>
      <g className="dla-ws__press">
        <text x={lx - 10} y={52} textAnchor="end" className="dla-t dla-t--b">{shown ? `p = ${p}` : 'p = ?'}</text>
        <Bars x={lx} y={20} row={row} d={d} cw={cw} ch={56} />
      </g>
      <ColLabels x={lx} y={90} d={d} cw={cw} />
      <text x={lx} y={rackY - 12} className="dla-t dla-t--xs dla-t--m">{faceUp || shown ? COPY.rackLabel : COPY.rackHidden}</text>
      {rack.map((r, q) => (
        <g key={q}>
          {shown && q === p && <rect className="dla-ws__band" x={4} y={rackY + q * rh - 1} width={W - 8} height={rh} rx={4} />}
          <text x={lx - 10} y={rackY + q * rh + 13} textAnchor="end" className="dla-t dla-t--xs dla-t--m">p = {q}</text>
          <Bars x={lx} y={rackY + q * rh} row={r} d={d} cw={cw} ch={rh - 2} inked={faceUp || shown} />
        </g>
      ))}
    </svg>
  );
}

function StampPic({ st, shown }) {
  const { d, row, p, target } = st;
  const cw = Math.min(44, Math.floor(296 / d));
  const lx = 64;
  const W = lx + d * cw + 8;
  const H = 128;
  const label = `A blank stamp for ${p === null ? 'position p' : `position ${p}`}: ${d} components, component ${target} marked with a question mark.`;
  return (
    <svg className="dl8s-svg dla-ws__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ maxWidth: W * 1.3 }}>
      <text x={lx} y={12} className="dla-t dla-t--xs dla-t--m">{COPY.stampLabel} · d = {d}</text>
      <g className="dla-ws__press">
        <text x={lx - 10} y={60} textAnchor="end" className="dla-t dla-t--b">{p === null ? 'p' : `p = ${p}`}</text>
        <Bars x={lx} y={22} row={row} d={d} cw={cw} ch={70} target={target} inked={shown} reveal={shown} />
      </g>
      <ColLabels x={lx} y={108} d={d} cw={cw} target={target} />
      <text x={lx - 10} y={108} textAnchor="end" className="dla-t dla-t--xs dla-t--m">i</text>
    </svg>
  );
}

function PairPic({ st, shown }) {
  const { d, p, target, slide, code } = st;
  const cw = 44;
  const lx = 8;
  const W = lx + d * cw + 8;
  const H = 166;
  const label = `Position ${p} stamped twice with d = ${d}: once with slide 32’s base 1000, once with slide 35’s code (base 10_000).`;
  return (
    <svg className="dl8s-svg dla-ws__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ maxWidth: W * 1.2 }}>
      <text x={lx} y={12} className="dla-t dla-t--xs dla-t--m">{COPY.slideBase} · p = {p}</text>
      <Bars x={lx} y={18} row={slide} d={d} cw={cw} ch={44} target={target} reveal={shown} />
      <text x={lx} y={86} className="dla-t dla-t--xs dla-t--m">{COPY.codeBase} · p = {p}</text>
      <Bars x={lx} y={92} row={code} d={d} cw={cw} ch={44} target={target} reveal={shown} />
      <ColLabels x={lx} y={156} d={d} cw={cw} target={target} />
    </svg>
  );
}

function RackBlock({ x, y, rack, d, cw, ch, title, sub }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <text x={0} y={-8} className="dla-t dla-t--s dla-t--b">{title}</text>
      {sub && <text x={d * cw} y={-8} textAnchor="end" className="dla-t dla-t--xs dla-t--m">{sub}</text>}
      {rack.map((r, q) => <Bars key={q} x={0} y={q * ch} row={r} d={d} cw={cw} ch={ch} />)}
    </g>
  );
}

function TwinPic({ st, shown }) {
  const { d, n, A, B } = st;
  const cw = 19;
  const ch = 10;
  const lx = 40;
  const gap = 34;
  const W = lx + 2 * d * cw + gap + 8;
  const H = 30 + n * ch + 30;
  const baseOf = (v) => (v === 'code' ? COPY.codeBase : COPY.slideBase);
  return (
    <svg className="dl8s-svg dla-ws__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Two racks of positional encodings, p = 0 to ${n - 1} down, ${d} components across: rack A and rack B.`} style={{ maxWidth: W * 1.4 }}>
      <text x={lx - 8} y={34} textAnchor="end" className="dla-t dla-t--xs dla-t--m">p = 0</text>
      <text x={lx - 8} y={30 + n * ch - 2} textAnchor="end" className="dla-t dla-t--xs dla-t--m">{n - 1}</text>
      <RackBlock x={lx} y={26} rack={A.rack} d={d} cw={cw} ch={ch} title={COPY.rackA} />
      <RackBlock x={lx + d * cw + gap} y={26} rack={B.rack} d={d} cw={cw} ch={ch} title={COPY.rackB} />
      {shown && <text x={lx} y={H - 8} className="dla-t dla-t--xs dla-t--m dla-ws__tl">{baseOf(A.variant)}</text>}
      {shown && <text x={lx + d * cw + gap} y={H - 8} className="dla-t dla-t--xs dla-t--m dla-ws__tl">{baseOf(B.variant)}</text>}
      {!shown && <text x={lx} y={H - 8} className="dla-t dla-t--xs dla-t--m">{COPY.across.replace('{n}', d - 1)}</text>}
    </svg>
  );
}

function WallPic({ st }) {
  const { d, n, rack } = st;
  const cw = 19;
  const ch = 8;
  const lx = 44;
  const W = lx + d * cw + 8;
  const H = 30 + n * ch + 10;
  return (
    <svg className="dl8s-svg dla-ws__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`The rack: slide 32’s P for positions 0 to ${n - 1} (down) and components 0 to ${d - 1} (across), d = ${d}.`} style={{ maxWidth: W * 1.4 }}>
      <text x={lx} y={12} className="dla-t dla-t--xs dla-t--m">P · d = {d} · base 1000 · i →</text>
      <text x={lx - 8} y={30 + 7} textAnchor="end" className="dla-t dla-t--xs dla-t--m">p = 0</text>
      <text x={lx - 8} y={30 + n * ch} textAnchor="end" className="dla-t dla-t--xs dla-t--m">{n - 1}</text>
      {rack.map((r, q) => <Bars key={q} x={lx} y={30 + q * ch} row={r} d={d} cw={cw} ch={ch} />)}
    </svg>
  );
}

function CodePic({ st, shown }) {
  const all = (CODE_TEXT[st.code.id] ?? '').split('\n');
  const picked = st.code.lines.map((k) => all[k] ?? '');
  const indent = Math.min(...picked.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  const out = [];
  st.code.lines.forEach((k, j) => {
    if (j > 0 && k !== st.code.lines[j - 1] + 1) out.push('...');
    let line = picked[j].slice(indent);
    if (st.mask && !shown) line = line.split(st.mask).join('▢');
    out.push(line);
  });
  return (
    <div className="dla-ws__code">
      <Code code={out.join('\n')} label="python" meta={CODE_SLIDE[st.code.id]} />
      {st.stamp && (
        <StampPic st={{ ...st.stamp, row: st.stamp.row }} shown={shown} />
      )}
    </div>
  );
}

function FormulaPic() {
  const tex = EQUATIONS.posenc.tex[0].split('1000').join('\\square');
  return (
    <figure className="dla-ws__formula" aria-label="Slide 32’s formula with the base hidden">
      <Tex block src={tex} />
      <figcaption className="dla-k">{COPY.formulaHidden}</figcaption>
    </figure>
  );
}

/* ── ViT: an image chopped into 16 × 16 squares (slide 46) ─────────────── */
function PatchPic({ st, shown }) {
  const uid = useId().replace(/:/g, '');
  const { H, W, focus } = st;
  const s = Math.min(170 / W, 120 / H, 3);
  const iw = W * s;
  const ih = H * s;
  const ox = 34;
  const oy = 20;
  const cols = W / 16;
  const rows = H / 16;
  const grid = focus !== 'count' || shown;
  const right = focus === 'all' || focus === 'flatten' || focus === 'linear';
  const rx = ox + iw + 30;
  const Wv = right ? rx + 196 : ox + iw + 16;
  const Hv = Math.max(oy + ih + 34, right ? 176 : 0);
  const hidden = (f) => !shown && focus === f;
  const strips = [0, 1, 2, 3];
  const label = `This page’s example image, ${H} by ${W} pixels${grid ? `, chopped into ${rows} × ${cols} squares of 16 × 16` : ', with one 16 × 16 square outlined'}${right ? '; the squares flattened into a sequence of vectors' : ''}${focus === 'all' ? ', through a linear layer, plus positional embeddings, into the transformer' : ''}.`;
  return (
    <svg className="dl8s-svg dla-ws__svg" viewBox={`0 0 ${Wv} ${Hv}`} role="img" aria-label={label} style={{ maxWidth: Wv * 1.3 }}>
      <defs>
        <clipPath id={`ws-img-${uid}`}><rect x={ox} y={oy} width={iw} height={ih} rx={3} /></clipPath>
      </defs>
      <g clipPath={`url(#ws-img-${uid})`}>
        <rect className="dla-ws__sky" x={ox} y={oy} width={iw} height={ih} />
        <circle className="dla-ws__sun" cx={ox + iw * 0.72} cy={oy + ih * 0.32} r={Math.min(iw, ih) * 0.16} />
        <path className="dla-ws__hill" d={`M${ox} ${oy + ih * 0.72} Q ${ox + iw * 0.3} ${oy + ih * 0.42} ${ox + iw * 0.6} ${oy + ih * 0.7} T ${ox + iw} ${oy + ih * 0.62} V ${oy + ih} H ${ox} Z`} />
        <path className="dla-ws__hill dla-ws__hill--near" d={`M${ox} ${oy + ih * 0.86} Q ${ox + iw * 0.45} ${oy + ih * 0.66} ${ox + iw} ${oy + ih * 0.88} V ${oy + ih} H ${ox} Z`} />
      </g>
      {grid && (
        <g className="dla-ws__grid">
          {Array.from({ length: cols - 1 }, (_, k) => <line key={`c${k}`} x1={ox + (k + 1) * 16 * s} y1={oy} x2={ox + (k + 1) * 16 * s} y2={oy + ih} />)}
          {Array.from({ length: rows - 1 }, (_, k) => <line key={`r${k}`} x1={ox} y1={oy + (k + 1) * 16 * s} x2={ox + iw} y2={oy + (k + 1) * 16 * s} />)}
        </g>
      )}
      <rect className="dla-ws__patch" x={ox} y={oy} width={16 * s} height={16 * s} />
      <text x={ox + iw / 2} y={oy + ih + 16} textAnchor="middle" className="dla-t dla-t--xs dla-t--m">{W} px</text>
      <text x={ox - 8} y={oy + ih / 2 + 4} textAnchor="end" className="dla-t dla-t--xs dla-t--m">{H} px</text>
      <text x={ox} y={oy - 7} className="dla-t dla-t--xs dla-t--m">{COPY.patchSide} squares</text>
      {right && (
        <g transform={`translate(${rx} 0)`}>
          <path className="dla-ws__arrow" d={`M${-24} ${oy + 22} H ${-6} M ${-11} ${oy + 17} L ${-6} ${oy + 22} L ${-11} ${oy + 27}`} />
          <text x={0} y={oy - 7} className="dla-t dla-t--xs dla-t--m">{COPY.seqLabel}</text>
          {strips.map((k) => <rect key={k} className="dla-ws__strip" x={k * 16} y={oy + 2} width={11} height={42} rx={2} />)}
          <text x={66} y={oy + 26} className="dla-t dla-t--s">…</text>
          <text x={84} y={oy + 26} className="dla-t dla-t--b">{hidden('flatten') ? '? each' : `${COPY.vecLabel} each`}</text>
          {(focus === 'all' || focus === 'linear') && (
            <g transform={`translate(0 ${oy + 58})`}>
              <rect className="dla-ws__box" width={58} height={26} rx={6} />
              <text x={29} y={17} textAnchor="middle" className="dla-t dla-t--s">{COPY.linear}</text>
              <text x={70} y={17} className="dla-t dla-t--b">→ {hidden('linear') ? '? each' : `${COPY.vecLabel} each`}</text>
            </g>
          )}
          {focus === 'all' && (
            <>
              <g transform={`translate(0 ${oy + 96})`}>
                {strips.map((k) => <rect key={k} className="dla-ws__strip dla-ws__strip--pos" x={k * 16} y={0} width={11} height={18} rx={2} />)}
                <text x={72} y={14} className="dla-t dla-t--s">{COPY.plusPos}</text>
              </g>
              <g transform={`translate(0 ${oy + 126})`}>
                <rect className="dla-ws__box dla-ws__box--tf" width={110} height={26} rx={6} />
                <text x={55} y={17} textAnchor="middle" className="dla-t dla-t--s dla-t--b">→ {COPY.toTransformer}</text>
              </g>
            </>
          )}
        </g>
      )}
    </svg>
  );
}

/* ── visual attention: CNN → feature maps → decoder RNN with attention (slides 44–45) ── */
function CaptionPic({ st, shown }) {
  const uid = useId().replace(/:/g, '');
  const hide = !shown && st.focus === 'decoder';
  const ox = 10;
  const oy = 24;
  const iw = 96;
  const ih = 64;
  const cy = oy + ih / 2;
  const cx = ox + iw + 22; // CNN box
  const fx = cx + 74; // feature maps
  const dx = fx + 62; // decoder box
  const dw = 156;
  const Wv = dx + dw + 10;
  const Hv = oy + ih + 34;
  const arrow = (x1, x2) => `M${x1} ${cy} H ${x2} M ${x2 - 5} ${cy - 5} L ${x2} ${cy} L ${x2 - 5} ${cy + 5}`;
  const label = hide
    ? 'An image goes in; something hidden writes the caption, one word at a time.'
    : 'An image goes into a CNN, which outputs feature maps; a decoder RNN with an attention mechanism looks back at them and writes the caption, one word at a time.';
  return (
    <svg className="dl8s-svg dla-ws__svg" viewBox={`0 0 ${Wv} ${Hv}`} role="img" aria-label={label} style={{ maxWidth: Wv * 1.3 }}>
      <defs>
        <clipPath id={`ws-cap-${uid}`}><rect x={ox} y={oy} width={iw} height={ih} rx={3} /></clipPath>
      </defs>
      <text x={ox} y={oy - 7} className="dla-t dla-t--xs dla-t--m">{COPY.capImage}</text>
      <g clipPath={`url(#ws-cap-${uid})`}>
        <rect className="dla-ws__sky" x={ox} y={oy} width={iw} height={ih} />
        <circle className="dla-ws__sun" cx={ox + iw * 0.72} cy={oy + ih * 0.32} r={ih * 0.16} />
        <path className="dla-ws__hill" d={`M${ox} ${oy + ih * 0.72} Q ${ox + iw * 0.3} ${oy + ih * 0.42} ${ox + iw * 0.6} ${oy + ih * 0.7} T ${ox + iw} ${oy + ih * 0.62} V ${oy + ih} H ${ox} Z`} />
        <path className="dla-ws__hill dla-ws__hill--near" d={`M${ox} ${oy + ih * 0.86} Q ${ox + iw * 0.45} ${oy + ih * 0.66} ${ox + iw} ${oy + ih * 0.88} V ${oy + ih} H ${ox} Z`} />
      </g>
      <path className="dla-ws__arrow" d={arrow(ox + iw + 4, cx - 4)} />
      {hide ? (
        <>
          <rect className="dla-ws__box" x={cx} y={cy - 13} width={dx + dw - cx} height={26} rx={6} />
          <text x={(cx + dx + dw) / 2} y={cy + 4} textAnchor="middle" className="dla-t dla-t--s dla-t--b">?</text>
        </>
      ) : (
        <>
          <rect className="dla-ws__box" x={cx} y={cy - 13} width={50} height={26} rx={6} />
          <text x={cx + 25} y={cy + 4} textAnchor="middle" className="dla-t dla-t--s">{COPY.capCnn}</text>
          <path className="dla-ws__arrow" d={arrow(cx + 54, fx - 4)} />
          {[0, 1, 2].map((k) => <rect key={k} className="dla-ws__strip" x={fx + k * 5} y={cy - 19 + k * 5} width={28} height={28} rx={2} />)}
          <text x={fx + 19} y={oy + ih + 12} textAnchor="middle" className="dla-t dla-t--xs dla-t--m">{COPY.capMaps}</text>
          <path className="dla-ws__arrow" d={arrow(fx + 42, dx - 4)} />
          <rect className="dla-ws__box dla-ws__box--tf" x={dx} y={cy - 13} width={dw} height={26} rx={6} />
          <text x={dx + dw / 2} y={cy + 4} textAnchor="middle" className="dla-t dla-t--s dla-t--b">{COPY.capDecoder}</text>
          <path className="dla-ws__arrow" strokeDasharray="3 3" d={`M${dx + 30} ${cy - 14} C ${dx + 20} ${oy - 14} ${fx + 30} ${oy - 14} ${fx + 22} ${cy - 22}`} />
          <text x={(fx + dx) / 2 + 22} y={oy - 12} textAnchor="middle" className="dla-t dla-t--xs dla-t--m">{COPY.capAttention}</text>
        </>
      )}
      <text x={dx} y={cy + 30} className="dla-t dla-t--xs dla-t--m">{COPY.capCaption}:</text>
      {COPY.capWords.map((w, k) => (
        <g key={w} transform={`translate(${dx + k * 46} ${cy + 36})`}>
          <rect className="dla-ws__strip" width={42} height={16} rx={3} />
          <text x={21} y={12} textAnchor="middle" className="dla-t dla-t--xs">{w}</text>
        </g>
      ))}
      <text x={dx + 140} y={cy + 48} className="dla-t dla-t--s">…</text>
    </svg>
  );
}

function OrderCards({ steps, order, onMove, onSubmit, disabled }) {
  return (
    <div className="dla-ws__order" role="group" aria-label="Order: press a card to move it up one place">
      {order.map((k, i) => (
        <button key={k} type="button" className="dla-ws__card" onClick={() => onMove(i)} disabled={disabled || i === 0} aria-label={`${i + 1}: ${steps[k]}; move up`}>
          <span className="dla-choice__n" aria-hidden="true">{i + 1}</span>
          <span>{steps[k]}</span>
          {i > 0 && <span className="dla-ws__up" aria-hidden="true">▲</span>}
        </button>
      ))}
      <button type="button" className="dla-btn dla-btn--primary" onClick={onSubmit} disabled={disabled}>{COPY.submitOrder} <span className="dla-btn__key">Enter</span></button>
    </div>
  );
}
