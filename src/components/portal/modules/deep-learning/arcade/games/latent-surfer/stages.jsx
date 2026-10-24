import { useEffect, useMemo, useState } from 'react';
import { Prompt, Feedback } from '../../kit/RoundShell';
import { Keypad } from '../../kit/Keypad';
import { Choice } from '../../kit/Choice';
import { Maths, MLine, MEq } from '../../kit/Maths';
import { Why } from '../../kit/WhyText';
import {
  fill, fmt, snap, decodePx, pixelMse, sliceCoding, mapTiles, findLoss, findLines, sigmaOf,
  samplingTrap, samplingLine, lossTraps, lossSub, choicePx, stripPx, EQ,
} from '../../maths/latentSurfer';
import { UI, FIND, SAMPLING, INTERP, LOSS } from '../../content/latent-surfer';
import { Px, SliceMap, Meter, SampleWire, NumberLine, Bells, Heat } from './parts.jsx';

/* ============================================================================
   LATENT SURFER — THE FIVE STATIONS (one per item type; each is keyed by the
   item id, so its local state resets per item). Numbers and words come from
   maths/latentSurfer.js and content/latent-surfer.js.
   ========================================================================== */

const fmtAns = (a, it) => (typeof it?.format === 'function' ? it.format(a) : String(a));
const isLive = (round) => !round.feedback && round.state === 'play';
const count = (round) => `${round.index + 1} / ${round.total}`;

// MSE on a log scale for the meter: 0.0005 (left) … 0.3 (right)
const LOG_LO = Math.log10(0.0005);
const LOG_HI = Math.log10(0.3);
const logFrac = (v) => (Math.log10(Math.max(v, 1e-6)) - LOG_LO) / (LOG_HI - LOG_LO);

/* ── find ──────────────────────────────────────────────────────────────── */
export function FindStage({ item, round, model }) {
  const [a, setA] = useState(item.start[0]);
  const [b, setB] = useState(item.start[1]);
  const live = isLive(round);
  const [A, B] = item.dimNames;
  const [lo, hi] = FIND.range;
  const targetPx = useMemo(() => decodePx(model, item.base), [model, item]);
  const px = useMemo(() => decodePx(model, sliceCoding(item, a, b)), [model, item, a, b]);
  const err = useMemo(() => pixelMse(px, targetPx), [px, targetPx]);
  const tiles = useMemo(() => mapTiles(model, item, item.tiles), [model, item]);
  const heatMax = useMemo(() => Math.max(...[[lo, lo], [lo, hi], [hi, lo], [hi, hi]].map(([x, y]) => findLoss(item, x, y))), [item, lo, hi]);
  const heat = findLoss(item, a, b);
  const ok = err <= item.tau;
  const lock = () => { if (live) round.submit([a, b]); };

  // arrows steer (Shift = 4 steps), Enter locks in
  useEffect(() => {
    if (!live) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter') {
        if (e.target && /^(button|textarea|select)$/i.test(e.target.tagName)) return;
        e.preventDefault();
        round.submit([a, b]);
        return;
      }
      if (e.target && /^(input|textarea|select)$/i.test(e.target.tagName)) return;
      const d = FIND.step * (e.shiftKey ? 4 : 1);
      if (e.key === 'ArrowLeft') { e.preventDefault(); setA((v) => snap(v - d)); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setA((v) => snap(v + d)); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setB((v) => snap(v - d)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setB((v) => snap(v + d)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [live, a, b, round]);

  const slider = (dim, v, set) => (
    <label className="dla-ls__slider">
      <span className="dla-ls__sk">μ<sub>{dim}</sub></span>
      <input
        type="range" min={lo} max={hi} step={FIND.step} value={v}
        onChange={(e) => set(snap(Number(e.target.value)))}
        disabled={!live}
        aria-label={fill(UI.sliderLabel, { d: dim })}
      />
      <output className="dla-ls__sv">{fmt(v, 2)}</output>
    </label>
  );

  return (
    <>
      <Prompt k={count(round)} sub={item.held}>{item.prompt}</Prompt>
      <div className={`dla-floor dla-ls__floor${ok ? ' dla-ls__floor--hot' : ''}`}>
        <div className="dla-ls__find">
          {item.tiles > 0 && (
            <figure className="dla-ls__fig dla-ls__fig--map">
              <SliceMap
                tiles={tiles} n={item.tiles} range={FIND.range} a={a} b={b}
                onPick={(x, y) => { if (live) { setA(snap(x)); setB(snap(y)); } }}
                label={fill(UI.mapAria, { a: item.dimSubs[0], b: item.dimSubs[1] })}
                axisA={`μ${item.dimSubs[0]}`} axisB={`μ${item.dimSubs[1]}`}
              />
              <figcaption><span className="dla-ls__lab">{UI.map}</span> <span className="dla-own">{UI.own}</span></figcaption>
            </figure>
          )}
          <figure className="dla-ls__fig dla-ls__fig--you">
            <Px px={px} label={`${UI.yours} (${UI.own})`} className="dla-ls__px--big" />
            <figcaption><span className="dla-ls__lab">{UI.yours}</span> <span className="dla-own">{UI.own}</span></figcaption>
          </figure>
          <figure className="dla-ls__fig dla-ls__fig--tgt">
            <Px px={targetPx} label={`${fill(UI.targetCaption, { idx: item.idx, cls: item.cls })} (${UI.own})`} className="dla-ls__px--mid" />
            <figcaption><span className="dla-ls__lab">{fill(UI.targetCaption, { idx: item.idx, cls: item.cls })}</span> <span className="dla-own">{UI.own}</span></figcaption>
          </figure>
        </div>
        <div className="dla-ls__gauges">
          <Meter label={UI.mse} value={err.toFixed(4)} sub={fill(UI.mseNeed, { tau: item.tau })} frac={logFrac(err)} mark={logFrac(item.tau)} ok={ok} />
          <Meter label={UI.heatFind} value={heat.toFixed(2)} frac={heatMax ? heat / heatMax : 0} />
        </div>
      </div>
      <Feedback feedback={round.feedback} format={fmtAns} />
      <div className="dla-ls__controls">
        {slider(A, a, setA)}
        {slider(B, b, setB)}
        <button type="button" className="dla-btn dla-btn--primary dla-ls__lock" onClick={lock} disabled={!live}>
          {UI.lockIn} <span className="dla-btn__key">{UI.lockKey}</span>
        </button>
      </div>
      <Maths>
        <MEq tex={EQ.gamma} />
        {findLines(item, a, b, err).map((l, i) => <MLine key={i} text={l} />)}
      </Maths>
    </>
  );
}

/* ── sample ────────────────────────────────────────────────────────────── */
export function SampleStage({ item, round }) {
  const [value, setValue] = useState('');
  const live = isLive(round);
  const reveal = !!round.feedback;
  const v = item.values;
  const given = reveal ? Number(round.feedback.given) : null;
  const trap = reveal && !round.feedback.correct ? samplingTrap(item, round.feedback.given) : null;
  const lo = Math.floor(v.mu - 6.5);
  const hi = Math.ceil(v.mu + 6.5);
  const markers = [{ v: v.mu, label: UI.lineMu, cls: 'dla-ls__m-mu' }];
  if (reveal) {
    markers.push({ v: item.answer, label: UI.lineZ, cls: 'dla-ls__m-z' });
    if (!round.feedback.correct && Number.isFinite(given)) markers.push({ v: given, label: UI.you, cls: 'dla-ls__m-you', ring: true });
  }
  const gText = fill(UI.gammaLine, { var: v.variance, g: fmt(v.gamma, 3) });
  return (
    <>
      <Prompt k={count(round)}>{item.prompt}</Prompt>
      <div className="dla-stagegrid">
        <div className="dla-ls__col">
          <div className="dla-floor dla-ls__floor">
            <SampleWire
              muText={fill(UI.muVal, { v: fmt(v.mu) })}
              sigmaText={reveal ? fill(UI.sigmaVal, { v: fmt(v.sigma, 3) }) : UI.sigmaUnknown}
              noiseText={fill(UI.noiseVal, { v: fmt(v.eps) })}
              outText={reveal ? fmt(item.answer, 3) : UI.outUnknown}
              gammaText={gText}
              reveal={reveal}
              words={{ mu: UI.muBox, sigma: UI.sigmaBox, noise: UI.noiseLabel, out: UI.codingsOut, aria: UI.diagramAria }}
            />
            <NumberLine lo={lo} hi={hi} markers={markers} aria={UI.lineAria} />
          </div>
          <Feedback feedback={round.feedback} format={fmtAns} />
          {trap && <p className="dla-ls__trap"><span className="dla-dot" aria-hidden="true" />{SAMPLING.traps[trap]}</p>}
        </div>
        <Keypad value={value} onChange={setValue} onSubmit={() => value !== '' && value !== '-' && round.submit(Number(value))} decimal negative disabled={!live} active={live} label={UI.codingsOut} />
      </div>
      <Maths>
        {EQ.sampling.map((t, i) => <MEq key={i} tex={t} />)}
        <MLine text={samplingLine(item, reveal)} />
        <MLine text={SAMPLING.draw} />
      </Maths>
    </>
  );
}

/* ── interpolation ─────────────────────────────────────────────────────── */
export function InterpStage({ item, round, model }) {
  const live = isLive(round);
  const reveal = !!round.feedback;
  const strip = useMemo(() => stripPx(model, item), [model, item]);
  const thumbs = useMemo(() => item.choices.map((c) => (c.how ? choicePx(model, item, c) : null)), [model, item]);
  const midPx = useMemo(() => (item.type === 'mid' ? decodePx(model, item.c0.map((v, i) => (v + item.c1[i]) / 2)) : null), [model, item]);
  const pictures = item.type !== 'interpT';
  const choices = item.choices.map((c, j) => (pictures
    ? { value: c.value, label: <Px px={thumbs[j]} label={fill(UI.imageAria, { v: c.value })} className="dla-ls__px--choice" />, aria: fill(UI.imageAria, { v: c.value }), sub: reveal ? c.text : undefined }
    : { value: c.value, label: <Why text={c.label} />, aria: c.text }));
  return (
    <>
      <Prompt k={count(round)} sub={item.pairText}>{item.prompt}</Prompt>
      <figure className="dla-floor dla-ls__floor dla-ls__stripfig">
        {item.type === 'mid' ? (
          <div className="dla-ls__strip dla-ls__strip--3">
            <Cell px={strip[0]} label={UI.ends[0]} />
            <Cell px={reveal ? midPx : null} label={UI.midSlot} hot />
            <Cell px={strip[strip.length - 1]} label={UI.ends[1]} />
          </div>
        ) : (
          <div className="dla-ls__strip">
            {strip.map((p, k) => (
              <Cell key={k} px={reveal || k === 0 || k === strip.length - 1 ? p : null} label={fill(UI.slot, { k })} hot={k === item.slot} small />
            ))}
          </div>
        )}
        <figcaption><span className="dla-ls__lab">{UI.stripCaption}</span> <span className="dla-own">{UI.own}</span></figcaption>
      </figure>
      <Feedback feedback={round.feedback} format={fmtAns} />
      <div className={pictures ? `dla-ls__thumbs dla-ls__thumbs--${choices.length}` : 'dla-ls__tchoices'}>
        <Choice choices={choices} onPick={(v) => live && round.submit(v)} picked={reveal ? round.feedback.given : null} answer={reveal ? item.answer : null} active={live} columns={2} label={UI.pick} />
        {pictures && <p className="dla-ls__cap"><span className="dla-own">{UI.own}</span> <span className="dla-ls__lab">{UI.choicesCaption}</span></p>}
      </div>
      <Maths>
        <MLine text={INTERP.steps} />
        {item.type !== 'mid' && <MLine><code className="dla-code">{INTERP.code}</code></MLine>}
        <MLine text={INTERP.general} />
        {reveal && <MLine text={item.why} />}
      </Maths>
    </>
  );
}

function Cell({ px, label, hot = false, small = false }) {
  return (
    <span className={`dla-ls__cell${hot ? ' dla-ls__cell--hot' : ''}${small ? ' dla-ls__cell--s' : ''}`}>
      {px ? <Px px={px} label={`${label} (${UI.own})`} /> : <span className="dla-ls__blank" aria-label={label} role="img">{hot ? '?' : ''}</span>}
      <span className="dla-ls__celllab">{label}</span>
    </span>
  );
}

/* ── latent loss ───────────────────────────────────────────────────────── */
export function LossStage({ item, round }) {
  const [value, setValue] = useState('');
  const live = isLive(round);
  const reveal = !!round.feedback;
  const given = reveal ? Number(round.feedback.given) : null;
  const traps = reveal && !round.feedback.correct ? lossTraps(item, round.feedback.given) : [];
  const dims = item.dims.map((d, i) => ({
    mu: d.mu,
    sigma: sigmaOf(Math.log(d.variance)),
    label: fill(UI.bellLabel, { i: i + 1, mu: fmt(d.mu), var: d.variance }),
  }));
  return (
    <>
      <Prompt k={count(round)}>{item.prompt}</Prompt>
      <div className="dla-stagegrid">
        <div className="dla-ls__col">
          <div className="dla-floor dla-ls__floor dla-ls__lossfloor">
            <Bells dims={dims} aria={UI.bellsAria} words={{ target: UI.bellTarget, coding: UI.bellCoding }} />
            <Heat value={fmt(item.answer, 3)} given={given} max={LOSS.meterMax} label={UI.heat} aria={UI.heatAria} reveal={reveal} unknown={UI.meterUnknown} />
          </div>
          <Feedback feedback={round.feedback} format={fmtAns} />
          {traps.map((k) => <p key={k} className="dla-ls__trap"><span className="dla-dot" aria-hidden="true" />{LOSS.traps[k]}</p>)}
        </div>
        <Keypad value={value} onChange={setValue} onSubmit={() => value !== '' && value !== '-' && round.submit(Number(value))} decimal negative disabled={!live} active={live} label={UI.heat} />
      </div>
      <Maths>
        <MEq tex={EQ.sigma} />
        <MEq tex={EQ.gamma} />
        <MLine text={lossSub(item.dims, reveal)} />
        <MLine text={LOSS.bellsNote.text} />
      </Maths>
    </>
  );
}

/* ── formula questions ─────────────────────────────────────────────────── */
export function FactStage({ item, round }) {
  const live = isLive(round);
  const reveal = !!round.feedback;
  const choices = item.choices.map((c) => ({
    value: c.value,
    label: c.label.startsWith('`') ? <code className="dla-code">{c.label.replace(/`/g, '')}</code> : <Why text={c.label} />,
    aria: c.aria ?? c.text,
  }));
  return (
    <>
      <Prompt k={count(round)}>{item.prompt}</Prompt>
      {item.tex && (
        <div className="dla-floor dla-floor--tight dla-ls__eqfloor">
          {item.tex.map((t, i) => <MEq key={i} tex={t} />)}
        </div>
      )}
      <Feedback feedback={round.feedback} format={fmtAns} />
      <Choice choices={choices} onPick={(v) => live && round.submit(v)} picked={reveal ? round.feedback.given : null} answer={reveal ? item.answer : null} active={live} columns={2} label={UI.pick} />
    </>
  );
}
