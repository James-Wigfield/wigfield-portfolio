import { useMemo, useState } from 'react';
import Scene from '../../scene/Scene';
import { bracket } from '../../scene/geom';

/* ============================================================================
   SCENE — the GRU encoder–decoder, training vs test (mechanism)
   Two stacked GRU layers read the 72 input months; each layer's final state
   becomes the initial state of the matching decoder layer (layer 1 → layer 1,
   layer 2 → layer 2). The decoder then runs 12 steps, the Dense head
   (next_month) turning each step's top output into that month's (min, max).
     train  teacher forcing: the decoder's inputs are the true months
            [72, 73 … 83] = concat(X[:, -1:], y[:, :-1]), all known up front,
            so encoder + decoder are ONE call of model3 (one frame); the
            decoder's final states are thrown away (decoded1, _)
     test   free running: one encoder call, then twelve separate one-step
            decoder calls (twelve frames); each call's ŷ and both states leave
            the model and the Python loop feeds them into the next call, so
            here the state lines break at every frame edge (an arrow out, an
            arrow back in; the encoder → call 1 break is labelled state1,
            state2) where the training pane draws them unbroken. The test
            pane spaces its calls wider to make room for the breaks.
   Months are drawn as two-channel chips, min (blue) | max (orange): truth is
   solid, the model's own output is hollow. No values are drawn; the test
   pane's score line carries the printed test MAE, 1.321 (Out [17]).
   The toggle swaps two scenes (both print). `start` names the first decoder
   input as the notebook words it.
   ========================================================================== */

const W = 800;
const H = 396;
const ENC = [{ t: 1, x: 52 }, { t: 2, x: 98 }, { t: 3, x: 144 }, { gap: true, x: 190 }, { t: 71, x: 236 }, { t: 72, x: 282 }];
const DEC_TRAIN = [{ k: 1, x: 438 }, { k: 2, x: 492 }, { k: 3, x: 546 }, { gap: true, x: 600 }, { k: 11, x: 654 }, { k: 12, x: 708 }];
const DEC_TEST = [{ k: 1, x: 440 }, { k: 2, x: 508 }, { k: 3, x: 576 }, { gap: true, x: 632 }, { k: 11, x: 688 }, { k: 12, x: 756 }];
const OUT = 98; // ŷ row
const L2 = 170; // layer 2 row
const L1 = 238; // layer 1 row
const IN = 306; // input row
const CWE = 34; // encoder cell width
const CWD = 30; // decoder cell width
const CH = 26;
const FR = 20; // half-width of a one-step decoder frame
const STUB = FR + 6; // a state arrow leaving / entering a call frame ends this far from the cell's centre
const EFR = ENC[5].x + CWE / 2 + 10; // right edge of the encoder's call frame (test)
const FTOP = 62;
const FBOT = 338;
const BRY = 348; // under-brackets
const FOOT = 382;
const LOOPS = [[0, 1], [1, 2], [4, 5]]; // DEC index pairs with a drawn feedback loop
const DIM = 0.35;

const month = (k) => 72 + k; // decoder step k outputs month 72 + k
const headRight = (x, y) => `M${x - 6} ${y - 3.5}L${x} ${y}L${x - 6} ${y + 3.5}Z`;
// the decoder link that leads INTO step k (both gap segments belong to step 11)
const linkInto = (DEC, i) => (DEC[i + 1].gap ? 11 : DEC[i + 1].k);

function Chip({ x, y, hollow = false }) {
  if (!hollow) {
    return (
      <g>
        <rect className="sv-fmin" x={x - 9} y={y - 9} width={9} height={18} />
        <rect className="sv-fmax" x={x} y={y - 9} width={9} height={18} />
      </g>
    );
  }
  const st = { fill: 'var(--surface)', strokeWidth: 1.4 };
  return (
    <g>
      <rect className="sv-min" x={x - 8.3} y={y - 8.3} width={7.6} height={16.6} style={st} />
      <rect className="sv-max" x={x + 0.7} y={y - 8.3} width={7.6} height={16.6} style={st} />
    </g>
  );
}

function makeArt(mode, start, units) {
  const train = mode === 'train';
  const DEC = train ? DEC_TRAIN : DEC_TEST;
  const DSTEPS = DEC.filter((c) => !c.gap);
  const DMID = (DEC[0].x + DEC[5].x) / 2;
  // the hand-over: unbroken inside model3 (train); in the test pane the states
  // leave the encoder's call and enter decoder call 1, labelled in the break
  const HX0 = ENC[5].x + CWE / 2;
  const HX1 = DEC[0].x - CWD / 2;
  const HM = (EFR + DEC[0].x - FR) / 2;
  const hand = (y) => (train ? `M${HX0} ${y}H${HX1 - 2}` : `M${HX0} ${y}H${HM - 29}M${HM + 25} ${y}H${HX1 - 5}`);
  return function art(step) {
    const on = (b) => (step >= b ? 1 : 0);
    const lit = (k) => (train ? step >= 2 : k === 1 ? step >= 2 : step >= 3);
    const shown = (k) => (lit(k) ? 1 : 0);
    const dim = (k) => (lit(k) ? 1 : DIM);
    const score = train ? step >= 3 : step >= 4;
    return (
      <>
        <text className="sv-cap" x={24} y={24}>Encoder · 72 months</text>
        <text className="sv-cap" x={420} y={24}>Decoder · 12 steps · {train ? 'training (teacher forcing)' : 'test (free running)'}</text>

        {/* ── frames: one call of model3 (train) / one encoder call + twelve decoder calls (test) ── */}
        {train ? (
          <g className="ed-frame" opacity={on(3)}>
            <rect x={14} y={FTOP} width={DEC[5].x + CWD / 2 + 10 - 14} height={FBOT - FTOP} rx={6} style={{ fill: 'none', stroke: 'var(--ink-3)', strokeWidth: 1.2, strokeDasharray: '4 3' }} />
            <text className="sv-lab-strong" x={26} y={FTOP + 18}>model3 · one call</text>
          </g>
        ) : (
          <>
            <g className="ed-eframe" opacity={on(0)}>
              <rect x={14} y={120} width={ENC[5].x + CWE / 2 + 10 - 14} height={FBOT - 120} rx={6} style={{ fill: 'none', stroke: 'var(--ink-3)', strokeWidth: 1.2, strokeDasharray: '4 3' }} />
              <text className="sv-lab-strong" x={26} y={138}>encoder · one call</text>
            </g>
            {DSTEPS.map((c) => (
              <g key={c.k} className={`ed-dframe ed-dframe-${c.k}`} opacity={shown(c.k)}>
                <rect x={c.x - FR} y={FTOP} width={FR * 2} height={FBOT - FTOP} rx={5} style={{ fill: 'none', stroke: 'var(--ink-3)', strokeWidth: 1.2, strokeDasharray: '4 3' }} />
                {/* one "decoder call" label, then bare call numbers, so 11 and 12 do not run together */}
                {c.k === 1 && <text className="sv-lab" x={c.x - FR - 8} y={362} textAnchor="end">decoder call</text>}
                <text className="sv-lab-strong" x={c.x} y={362} textAnchor="middle">{c.k}</text>
              </g>
            ))}
          </>
        )}

        {/* ── encoder ── */}
        <g className="ed-enc">
          {ENC.map((c) =>
            c.gap ? (
              <g key="gap">
                <text className="sv-lab" x={c.x} y={L1 + 4} textAnchor="middle">· ·</text>
                <text className="sv-lab" x={c.x} y={L2 + 4} textAnchor="middle">· ·</text>
                <text className="sv-lab" x={c.x} y={IN + 4} textAnchor="middle">· ·</text>
              </g>
            ) : (
              <g key={c.t}>
                <path className="sv-faint" d={`M${c.x} ${IN - 10}V${L1 + CH / 2}`} />
                <path className="sv-faint" d={`M${c.x} ${L1 - CH / 2}V${L2 + CH / 2}`} />
                <Chip x={c.x} y={IN} />
                <text className="sv-lab" x={c.x} y={IN + 25} textAnchor="middle">{c.t}</text>
                <rect className="sv-box-strong ed-ecell" x={c.x - CWE / 2} y={L1 - CH / 2} width={CWE} height={CH} rx={3} />
                <rect className="sv-box-strong ed-ecell" x={c.x - CWE / 2} y={L2 - CH / 2} width={CWE} height={CH} rx={3} />
              </g>
            ),
          )}
          {ENC.slice(0, -1).map((a, i) => {
            const b = ENC[i + 1];
            const x0 = a.x + (a.gap ? 11 : CWE / 2);
            const x1 = b.x - (b.gap ? 11 : CWE / 2);
            return (
              <g key={i}>
                <path className="sv-faint" d={`M${x0} ${L1}H${x1}`} />
                <path className="sv-faint" d={`M${x0} ${L2}H${x1}`} />
              </g>
            );
          })}
          <path className="sv-ink2" d={bracket(ENC[0].x - 17, ENC[5].x + 17, BRY, -6)} strokeWidth="1.1" />
          <text className="sv-lab" x={(ENC[0].x + ENC[5].x) / 2} y={BRY + 14} textAnchor="middle">X · months 1–72</text>
          <text className="sv-lab" x={24} y={FOOT}>{train ? `two GRU(${units || 16}) layers, return_state=True` : 'state1, state2 = encoder(X)'}</text>
        </g>

        {/* ── the hand-over: final states → decoder initial states ── */}
        <g className="ed-hand" opacity={on(1)}>
          <path className="sv-accent ed-h1" d={hand(L1)} strokeWidth="2" fill="none" />
          <path className="sv-accent ed-h2" d={hand(L2)} strokeWidth="2" fill="none" />
          {train ? (
            <g className="ed-hlab">
              <text className="sv-lab-strong" x={360} y={L1 - 8} textAnchor="middle">h¹(72)</text>
              <text className="sv-lab-strong" x={360} y={L2 - 8} textAnchor="middle">h²(72)</text>
              <text className="sv-lab" x={360} y={L1 + 18} textAnchor="middle">initial_state</text>
            </g>
          ) : (
            <g className="ed-hlab">
              {[
                [L1, 'h¹(72)', 'state1'],
                [L2, 'h²(72)', 'state2'],
              ].map(([y, h, n]) => (
                <g key={n}>
                  <path d={headRight(HM - 24, y)} style={{ fill: 'var(--dlp2-mark)' }} />
                  <path d={headRight(HX1, y)} style={{ fill: 'var(--dlp2-mark)' }} />
                  <text className="sv-lab-strong" x={HM} y={y + 4} textAnchor="middle">{n}</text>
                  <text className="sv-lab" x={HM} y={y - 12} textAnchor="middle">{h}</text>
                </g>
              ))}
              <text className="sv-lab" x={HM} y={L1 + 22} textAnchor="middle">initial_state</text>
            </g>
          )}
        </g>

        {/* ── decoder structure (dim until a step runs) ── */}
        {DEC.map((c) =>
          c.gap ? (
            <g key="gap" className="ed-dlink ed-dlink-11" opacity={dim(11)}>
              <text className="sv-lab" x={c.x} y={L1 + 4} textAnchor="middle">· ·</text>
              <text className="sv-lab" x={c.x} y={L2 + 4} textAnchor="middle">· ·</text>
            </g>
          ) : (
            <g key={c.k} className={`ed-dcell ed-dcell-${c.k}`} opacity={dim(c.k)}>
              <path className="sv-faint" d={`M${c.x} ${IN - 10}V${L1 + CH / 2}`} />
              <path className="sv-faint" d={`M${c.x} ${L1 - CH / 2}V${L2 + CH / 2}`} />
              <path className="sv-faint" d={`M${c.x} ${L2 - CH / 2}V${OUT + 10}`} />
              <rect className="sv-box-strong" x={c.x - CWD / 2} y={L1 - CH / 2} width={CWD} height={CH} rx={3} />
              <rect className="sv-box-strong" x={c.x - CWD / 2} y={L2 - CH / 2} width={CWD} height={CH} rx={3} />
            </g>
          ),
        )}
        {DEC.slice(0, -1).map((a, i) => {
          const b = DEC[i + 1];
          const k = linkInto(DEC, i);
          if (train) {
            // inside one call the GRU carries its state itself: one unbroken line
            const x0 = a.x + (a.gap ? 11 : CWD / 2);
            const x1 = b.x - (b.gap ? 11 : CWD / 2);
            return (
              <g key={i} className={`ed-dlink ed-dlink-${k}`} opacity={dim(k)}>
                <path className="sv-faint" d={`M${x0} ${L1}H${x1}`} strokeWidth={1} />
                <path className="sv-faint" d={`M${x0} ${L2}H${x1}`} strokeWidth={1} />
              </g>
            );
          }
          // test: each call is its own run, so both states leave its frame
          // (arrow out) and enter the next call's frame (arrow in)
          const segs = [];
          if (!a.gap) segs.push([a.x + CWD / 2, a.x + STUB]);
          if (!b.gap) segs.push([b.x - STUB, b.x - CWD / 2]);
          return (
            <g key={i} className={`ed-dlink ed-dlink-${k}`} opacity={dim(k)}>
              {[L1, L2].map((y) =>
                segs.map(([x0, x1]) => (
                  <g key={`${y}-${x0}`}>
                    <path className="sv-accent" d={`M${x0} ${y}H${x1 - 5}`} strokeWidth={1.4} />
                    <path d={headRight(x1, y)} style={{ fill: 'var(--dlp2-mark)' }} />
                  </g>
                )),
              )}
            </g>
          );
        })}
        {/* the head's label arrives with the first outputs it labels */}
        <text className="sv-lab ed-nmlab" x={DEC[0].x - 30} y={OUT + 4} textAnchor="end" opacity={on(2)}>next_month → (min, max)</text>

        {/* ── decoder inputs and outputs ── */}
        {DSTEPS.map((c) => {
          const truth = train || c.k === 1;
          const inLab = c.k === 1 ? '72' : truth ? String(month(c.k - 1)) : `ŷ${month(c.k - 1)}`;
          return (
            <g key={c.k}>
              <g className={`ed-in ed-in-${c.k}`} opacity={shown(c.k)}>
                <Chip x={c.x} y={IN} hollow={!truth} />
                <text className="sv-lab" x={c.x} y={IN + 25} textAnchor="middle">{inLab}</text>
              </g>
              <g className={`ed-out ed-out-${c.k}`} opacity={shown(c.k)}>
                <Chip x={c.x} y={OUT} hollow />
                <text className="sv-lab-strong" x={c.x} y={OUT - 16} textAnchor="middle">ŷ{month(c.k)}</text>
              </g>
            </g>
          );
        })}

        {train ? (
          <>
            {/* what decoder_inputs builds */}
            <g className="ed-br" opacity={on(2)}>
              <path className="sv-ink2" d={bracket(DEC[0].x - 15, DEC[0].x + 15, BRY, -6)} strokeWidth="1.1" />
              <text className="sv-lab-strong" x={DEC[0].x} y={BRY + 14} textAnchor="middle">X[:, -1:]</text>
              <path className="sv-ink2" d={bracket(DEC[1].x - 15, DEC[5].x + 15, BRY, -6)} strokeWidth="1.1" />
              <text className="sv-lab-strong" x={(DEC[1].x + DEC[5].x) / 2} y={BRY + 14} textAnchor="middle">y[:, :-1]</text>
              <text className="sv-lab" x={DMID} y={FOOT} textAnchor="middle">decoder_inputs(X, y) = concat(X[:, -1:], y[:, :-1])</text>
            </g>
            {/* nothing follows step 12: the final decoder states are dropped */}
            <g className="ed-drop" opacity={on(3)}>
              {[L1, L2].map((y) => (
                <g key={y}>
                  <path className="sv-faint" d={`M${DEC[5].x + CWD / 2} ${y}H${DEC[5].x + 40}`} />
                  <text className="sv-lab-strong" x={DEC[5].x + 46} y={y + 4}>_</text>
                </g>
              ))}
              <text className="sv-lab" x={DEC[5].x + 36} y={(L1 + L2) / 2 - 3}>thrown</text>
              <text className="sv-lab" x={DEC[5].x + 36} y={(L1 + L2) / 2 + 11}>away</text>
            </g>
          </>
        ) : (
          <>
            {/* the Python loop: each call's ŷ becomes the next call's input */}
            {LOOPS.map(([a, b]) => {
              const xa = DEC[a].x;
              const xb = DEC[b].x;
              const xm = (xa + xb) / 2;
              return (
                <g key={b} className={`ed-loopg ed-loopg-${DEC[b].k}`} opacity={shown(DEC[b].k)}>
                  <path className="sv-accent ed-loop" d={`M${xa + 9} ${OUT}H${xm}V${IN}H${xb - 12}`} strokeWidth="1.4" fill="none" />
                  <path className="ed-loophead" d={headRight(xb - 10, IN)} style={{ fill: 'var(--dlp2-mark)' }} />
                </g>
              );
            })}
            <text className="sv-lab ed-foot-r" x={DEC[5].x + FR} y={FOOT} textAnchor="end" opacity={on(3)}>month, state1, state2 = decoder([month, state1, state2])</text>
          </>
        )}

        {/* ── scoring ── */}
        <g className="ed-score" opacity={score ? 1 : 0}>
          <path className="sv-ink2" d={`M${DEC[0].x - 12} 58V52H${DEC[5].x + 12}V58`} fill="none" strokeWidth="1.2" />
          {/* test: the printed score, In [17]'s output (the caption says it comes after call 12) */}
          <text className="sv-lab-strong" x={DMID} y={44} textAnchor="middle">
            {train ? (
              'MSE loss against months 73–84 · one forward pass'
            ) : (
              <>
                MAE vs y_test, months 73–84 = 1.321 °C <tspan className="sv-lab">· Out [17]</tspan>
              </>
            )}
          </text>
        </g>
      </>
    );
  };
}

const makeBuild = (mode) =>
  function build(tl, { q, beat }) {
    const train = mode === 'train';
    const draw = (el, at, dur) => {
      if (!el) return;
      const L = el.getTotalLength();
      tl.fromTo(el, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: dur, ease: 'power2.inOut', immediateRender: true }, at);
    };
    const light = (k, at) => {
      tl.fromTo(q(`.ed-dcell-${k}, .ed-dlink-${k}`), { opacity: DIM }, { opacity: 1, duration: 0.3 }, at);
    };
    tl.set(q('.ed-hand, .ed-hlab, .ed-in, .ed-out, .ed-nmlab, .ed-score, .ed-frame, .ed-drop, .ed-br, .ed-eframe, .ed-dframe, .ed-loopg, .ed-loophead, .ed-foot-r'), { opacity: 0, immediateRender: true }, 0);
    tl.set(q('.ed-dcell, .ed-dlink'), { opacity: DIM, immediateRender: true }, 0);

    // 0 · the encoder reads the window
    beat(0, 0);
    tl.fromTo(q('.ed-enc'), { opacity: 0.25 }, { opacity: 1, duration: 0.4 }, 'b0');
    tl.fromTo(q('.ed-ecell'), { opacity: 0.3 }, { opacity: 1, duration: 0.25, stagger: 0.08 }, 'b0+=0.2');
    if (!train) tl.fromTo(q('.ed-eframe'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b0+=0.9');

    // 1 · hand over the states
    beat(1, '+=0.5');
    tl.fromTo(q('.ed-hand'), { opacity: 0 }, { opacity: 1, duration: 0.2 }, 'b1');
    draw(q('.ed-h1')[0], 'b1', 0.8);
    draw(q('.ed-h2')[0], 'b1+=0.25', 0.8);
    tl.fromTo(q('.ed-hlab'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b1+=0.7');

    if (train) {
      // 2 · teacher forcing: all twelve true inputs at once
      beat(2, '+=0.7');
      tl.fromTo(q('.ed-in'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.05 }, 'b2');
      tl.fromTo(q('.ed-br'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b2+=0.4');
      tl.fromTo(q('.ed-dcell, .ed-dlink'), { opacity: DIM }, { opacity: 1, duration: 0.35 }, 'b2+=0.6');
      tl.fromTo(q('.ed-out'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.04 }, 'b2+=0.9');
      tl.fromTo(q('.ed-nmlab'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b2+=0.9');
      // 3 · one call; the final decoder states are dropped
      beat(3, '+=0.9');
      tl.fromTo(q('.ed-frame'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 'b3');
      tl.fromTo(q('.ed-drop'), { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.4 }, 'b3+=0.5');
      tl.fromTo(q('.ed-score'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b3+=0.9');
    } else {
      // 2 · call 1 starts from month 72
      beat(2, '+=0.7');
      tl.fromTo(q('.ed-dframe-1'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 'b2');
      tl.fromTo(q('.ed-in-1'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45 }, 'b2+=0.2');
      light(1, 'b2+=0.5');
      tl.fromTo(q('.ed-out-1'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45 }, 'b2+=0.8');
      tl.fromTo(q('.ed-nmlab'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b2+=0.8');
      // 3 · feed back, carry the states, one call at a time
      beat(3, '+=0.6');
      tl.fromTo(q('.ed-foot-r'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b3');
      [2, 3, 11, 12].forEach((k, j) => {
        // one summed offset per position: GSAP reads 'b3+=0.95+=0.4' as 'b3+=0.95'
        const at = (d = 0) => `b3+=${(j * 0.95 + d).toFixed(2)}`;
        tl.fromTo(q(`.ed-dframe-${k}`), { opacity: 0 }, { opacity: 1, duration: 0.25 }, at());
        const g = q(`.ed-loopg-${k}`);
        if (g.length) {
          tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: 0.05 }, at());
          tl.fromTo(q(`.ed-loopg-${k} .ed-loophead`), { opacity: 0 }, { opacity: 1, duration: 0.1 }, at(0.4));
          draw(q(`.ed-loopg-${k} .ed-loop`)[0], at(), 0.45);
        }
        light(k, at(0.35));
        tl.fromTo(q(`.ed-in-${k}`), { opacity: 0 }, { opacity: 1, duration: 0.25 }, at(0.4));
        tl.fromTo(q(`.ed-out-${k}`), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3 }, at(0.6));
      });
      // 4 · only now is anything compared with the truth
      beat(4, '+=0.5');
      tl.fromTo(q('.ed-score'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'b4');
    }
    tl.to({}, { duration: 1.2 });
  };

// narrow screens show about half the stage: the decoder beats frame every call
// and the code line under them
const FX_DEC = 0.97;
const BEATS = {
  train: (start) => [
    { t: 'Encoder reads 72 months', fx: 0, c: 'Two stacked GRU layers run over the input window; only their final states are passed on.' },
    { t: 'Hand over the states', fx: 0.45, c: 'Layer 1’s final state starts decoder layer 1 and layer 2’s starts decoder layer 2, so matching layers need the same number of units.' },
    {
      t: 'Teacher forcing',
      fx: FX_DEC,
      c: `The decoder is fed the true months: ${start}, then 73 to 83 (X[:, -1:] then y[:, :-1]). Step k reads month 72 + k − 1 and outputs month 72 + k.`,
    },
    {
      t: 'One call, states dropped',
      fx: FX_DEC,
      c: 'It is all one call of model3: fit scores the twelve outputs against months 73–84 at once. Nothing follows step 12, so the final states are dropped: decoded1, _ = decoder_gru1(…).',
    },
  ],
  test: (start) => [
    { t: 'Encoder reads 72 months', fx: 0, c: 'At test time the encoder is a model of its own: one call turns the window into state1 and state2.' },
    { t: 'Hand over the states', fx: 0.45, c: 'The encoder hands back state1 and state2, and they become the decoder’s starting states, layer to layer, exactly as in training.' },
    { t: 'First call', fx: 0.8, c: `The one-step decoder gets ${start} (X[:, -1:]) and the two states, and returns ŷ73 with two updated states.` },
    {
      t: 'Feed back, carry the states',
      fx: FX_DEC,
      c: 'Each call returns a month and two new states; the loop feeds all three into the next call, a separate run, so the state arrows cross from frame to frame.',
    },
    {
      t: 'No truth goes in',
      fx: FX_DEC,
      c: 'The true months only score the twelve outputs, after call 12: test MAE 1.321 °C. The decoder’s own errors are inputs unlike any it trained on; they carry forward: exposure bias.',
    },
  ],
};

export default function EncDecScene({ id = 'm3-encdec', start = 'month 72', units }) {
  const [mode, setMode] = useState('train');
  const arts = useMemo(() => ({ train: makeArt('train', start, units), test: makeArt('test', start, units) }), [start, units]);
  const builds = useMemo(() => ({ train: makeBuild('train'), test: makeBuild('test') }), []);
  const beats = useMemo(() => ({ train: BEATS.train(start), test: BEATS.test(start) }), [start]);
  return (
    <div className="dlp2-toggle-scene">
      <div className="dlp2-seg dlp2-seg--big" role="group" aria-label="Which phase to show">
        {['train', 'test'].map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} data-shows={`${id}-${m}`} onClick={() => setMode(m)}>
            {m === 'train' ? 'Training · teacher forcing' : 'Test · free running'}
          </button>
        ))}
      </div>
      {['train', 'test'].map((m) => (
        <div key={m} className={`dlp2-toggle-scene__pane${mode === m ? ' dlp2-toggle-scene__pane--on' : ''}`}>
          <p className="dlp2-toggle-scene__printlab">{m === 'train' ? 'Training · teacher forcing' : 'Test · free running'}</p>
          <Scene
            id={`${id}-${m}`}
            label={
              m === 'train'
                ? 'GRU encoder-decoder in training: the encoder final states initialise the decoder layer by layer, teacher forcing feeds month 72 and the true months 73 to 83 as decoder inputs, and the whole thing is one call of the training model'
                : 'GRU encoder-decoder at test time: one encoder call, then twelve one-step decoder calls, each feeding its prediction and both states into the next call'
            }
            viewBox={`0 0 ${W} ${H}`}
            beats={beats[m]}
            art={arts[m]}
            build={builds[m]}
            keyframes={m === 'train' ? [3] : [2, 4]}
          />
        </div>
      ))}
    </div>
  );
}
